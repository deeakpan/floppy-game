import React, { useEffect, useRef, useCallback, useState } from 'react';
import styles from './FloppyGame.module.css';

export const FloppyGame: React.FC = () => {
  const [isMobile, setIsMobile] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastUpdateRef = useRef<number>(0); // Keeps track of last timestamp for delta time
  const restartButtonRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
  const animationFrameIdRef = useRef<number | null>(null); // Add ref for animation frame ID
  
  // Image refs
  const birdImage = useRef<HTMLImageElement | null>(null);
  const pipeImage = useRef<HTMLImageElement | null>(null);
  const backgroundImage = useRef<HTMLImageElement | null>(null);
  const sadFloppyImage = useRef<HTMLImageElement | null>(null);
  const platformImage = useRef<HTMLImageElement | null>(null);
  const powerUpImage = useRef<HTMLImageElement | null>(null); // For the 20-point item

  // Game state
  const birdY = useRef(225);
  const velocity = useRef(0);
  const pipes = useRef<Array<{ x: number; height: number; passed: boolean }>>([]);
  const powerUps = useRef<Array<{ x: number; y: number; collected: boolean }>>([]); // State for power-ups
  const score = useRef(0);
  const gameOver = useRef(false);
  const isDying = useRef(false);
  const showRestartScreen = useRef(false);
  const gameStarted = useRef(false); // New ref to track game start
  const rotation = useRef(0);

  // Game constants
  const CANVAS_WIDTH = 800;
  const CANVAS_HEIGHT = 500;
  const PIPE_WIDTH = 60;
  const PIPE_HEIGHT = 400;
  const PIPE_GAP = 120;
  const BIRD_WIDTH = 40;
  const BIRD_HEIGHT = 30;
  const COLLISION_PADDING = 0; // Not currently used, but kept for reference
  const SHOW_DEBUG = false;
  const GRAVITY = 0.35;
  const JUMP_FORCE = -5;
  const ROTATION_SPEED = 0.01;
  const PIPE_SPEED = 3.5;
  const PLATFORM_HEIGHT = 60;
  const POWERUP_SIZE = 30;
  const POWERUP_SPAWN_CHANCE = 0.3; // 30% chance to spawn a power-up with each new pipe

  // Helper function to load images
  const loadImage = useCallback((src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        console.log(`FloppyGame: Image loaded successfully: ${src}`);
        resolve(img);
      };
      img.onerror = (e) => {
        console.error(`FloppyGame: Error loading image: ${src}`, e);
        reject(new Error(`Failed to load image: ${src}`));
      };
      // Ensure image paths are correct for deployment (relative to public folder)
      img.src = src.startsWith('/') ? src : `/${src}`;
    });
  }, []);

  // Game Functions (useCallback for stability and to avoid re-renders)
  const checkCollision = useCallback((birdX: number, birdY: number, itemX: number, itemY: number, itemWidth: number, itemHeight: number) => {
    const birdLeft = birdX;
    const birdRight = birdX + BIRD_WIDTH;
    const birdTop = birdY;
    const birdBottom = birdY + BIRD_HEIGHT;

    const itemLeft = itemX;
    const itemRight = itemX + itemWidth;
    const itemTop = itemY;
    const itemBottom = itemY + itemHeight;

    // Basic AABB collision detection
    return birdRight > itemLeft && birdLeft < itemRight &&
           birdBottom > itemTop && birdTop < itemBottom;
  }, [BIRD_WIDTH, BIRD_HEIGHT]);

  const spawnPipe = useCallback(() => {
    const minHeight = 100;
    const maxHeight = 300;
    const randomHeight = Math.floor(Math.random() * (maxHeight - minHeight + 1)) + minHeight;
    pipes.current.push({
      x: CANVAS_WIDTH,
      height: randomHeight,
      passed: false,
    });
  }, [CANVAS_WIDTH, pipes]);

  const getScoreMessage = useCallback((currentScore: number): string => {
    if (currentScore < 50) return "That didn't feel comfy...";
    if (currentScore < 100) return "You must like privacy!";
    if (currentScore < 200) return "Real INCO gang!";
    if (currentScore < 300) return "INCO Master!";
    if (currentScore < 500) return "INCO Legend!";
    return "INCO GOD!";
  }, []);

  const drawRestartScreen = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Game Over!', CANVAS_WIDTH / 2, 105);

    ctx.font = '24px Arial';
    ctx.fillText(`Score: ${score.current}`, CANVAS_WIDTH / 2, 155);

    ctx.font = 'bold 20px Arial';
    ctx.fillText(getScoreMessage(score.current), CANVAS_WIDTH / 2, 185);

    if (sadFloppyImage.current) {
      const imageSize = 100;
      ctx.drawImage(
        sadFloppyImage.current,
        CANVAS_WIDTH / 2 - imageSize / 2,
        195,
        imageSize,
        imageSize
      );
    }

    const buttonWidth = 200;
    const buttonHeight = 50;
    const buttonX = CANVAS_WIDTH / 2 - buttonWidth / 2;
    const buttonY = 310;

    const gradient = ctx.createLinearGradient(buttonX, buttonY, buttonX, buttonY + buttonHeight);
    gradient.addColorStop(0, '#2196F3');
    gradient.addColorStop(1, '#1976D2');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.roundRect(buttonX, buttonY, buttonWidth, buttonHeight, 10);
    ctx.fill();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px Arial';
    ctx.fillText('Play Again', CANVAS_WIDTH / 2, buttonY + buttonHeight / 2 + 7);

    restartButtonRef.current = {
      x: buttonX,
      y: buttonY,
      width: buttonWidth,
      height: buttonHeight
    };
  }, [CANVAS_WIDTH, CANVAS_HEIGHT, score, getScoreMessage, sadFloppyImage, restartButtonRef]);

  const drawPipes = useCallback((ctx: CanvasRenderingContext2D) => {
    if (!pipeImage.current) return;

    pipes.current.forEach(pipe => {
      ctx.save();
      ctx.translate(pipe.x, pipe.height);
      ctx.scale(1, -1);
      ctx.drawImage(pipeImage.current!, 0, 0, PIPE_WIDTH, PIPE_HEIGHT);
      ctx.restore();

      ctx.drawImage(
        pipeImage.current!,
        pipe.x,
        pipe.height + PIPE_GAP,
        PIPE_WIDTH,
        PIPE_HEIGHT
      );
    });
  }, [pipeImage, PIPE_WIDTH, PIPE_HEIGHT, PIPE_GAP, pipes]);

  const drawInstructionsScreen = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'; // Darker overlay
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Floppy Game', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 60);

    ctx.font = '30px Arial';
    ctx.fillText('Press SPACE or CLICK to Start', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 20);

    ctx.font = '20px Arial';
    ctx.fillText('(Avoid pipes, collect special items for 20 points!)', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 70);
  }, [CANVAS_WIDTH, CANVAS_HEIGHT]);

  // Main Game Loop
  const gameLoop = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');

    if (!ctx) {
      console.log('FloppyGame: Game loop: Canvas context not available. Stopping loop.');
      return;
    }

    // Game logic is paused until gameStarted is true
    if (!gameStarted.current) {
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      if (backgroundImage.current) {
        ctx.drawImage(backgroundImage.current, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      }
      drawInstructionsScreen(ctx); 
      requestAnimationFrame(gameLoop); // Keep looping to draw instructions
      return; // Exit game logic until started
    }

    // --- Game continues from here if started ---
    // Clear canvas for next frame
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw background
    if (backgroundImage.current) {
      ctx.drawImage(backgroundImage.current, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }

    // Draw pipes
    drawPipes(ctx);

    // Draw platform (moved after pipes to appear on top)
    if (platformImage.current) {
      ctx.drawImage(
        platformImage.current,
        0,
        CANVAS_HEIGHT - PLATFORM_HEIGHT,
        CANVAS_WIDTH,
        PLATFORM_HEIGHT
      );
    }

    // Draw power-ups
    if (powerUpImage.current) {
      powerUps.current.forEach((powerUp: { x: number; y: number; collected: boolean }) => {
        if (!powerUp.collected) {
          ctx.drawImage(powerUpImage.current!, powerUp.x, powerUp.y, POWERUP_SIZE, POWERUP_SIZE);
        }
      });
    }

    // Update bird position
    if (!gameOver.current) {
      velocity.current += GRAVITY;
      birdY.current += velocity.current;

      // Smoother rotation based on velocity
      const targetRotation = velocity.current * ROTATION_SPEED;
      rotation.current += (targetRotation - rotation.current) * 0.1;
      rotation.current = Math.min(Math.PI / 4, Math.max(-Math.PI / 4, rotation.current));
    } else if (isDying.current) {
      // Death animation - bird falls
      velocity.current += GRAVITY;
      birdY.current += velocity.current;

      // Stop bird at platform
      if (birdY.current > CANVAS_HEIGHT - PLATFORM_HEIGHT - BIRD_HEIGHT) {
        birdY.current = CANVAS_HEIGHT - PLATFORM_HEIGHT - BIRD_HEIGHT;
        velocity.current = 0;
        isDying.current = false;
        showRestartScreen.current = true;
      }
    }

    // Spawn new pipes
    if (!gameOver.current) {
      if (pipes.current.length === 0 || pipes.current[pipes.current.length - 1].x < CANVAS_WIDTH - 300) {
        spawnPipe();

        // Randomly spawn a power-up with 30% chance, positioned between pipes
        if (Math.random() < POWERUP_SPAWN_CHANCE) {
          const minY = 50; // Minimum distance from top
          const maxY = CANVAS_HEIGHT - PLATFORM_HEIGHT - POWERUP_SIZE - 50; // Maximum distance from platform
          powerUps.current.push({
            x: CANVAS_WIDTH + 150, // Position power-up between pipes
            y: Math.random() * (maxY - minY) + minY, // Random Y within safe bounds
            collected: false,
          });
        }
      }
    }

    // Update pipes
    if (!gameOver.current) {
      pipes.current = pipes.current.filter(pipe => {
        pipe.x -= PIPE_SPEED;
        if (!pipe.passed && pipe.x + PIPE_WIDTH < 50) {
          pipe.passed = true;
          score.current += 10;
        }
        return pipe.x > -PIPE_WIDTH;
      });

      // Update power-ups and check for collection
      powerUps.current = powerUps.current.filter((powerUp: { x: number; y: number; collected: boolean }) => {
        if (powerUp.collected) return false; // Already collected
        powerUp.x -= PIPE_SPEED;

        // Check collision with bird
        if (checkCollision(50, birdY.current, powerUp.x, powerUp.y, POWERUP_SIZE, POWERUP_SIZE)) {
          score.current += 20;
          return false; // Remove collected power-up
        }
        return powerUp.x > -POWERUP_SIZE; // Remove if off-screen
      });
    }

    // Check for pipe collisions
    if (!gameOver.current) {
      for (const pipe of pipes.current) {
        if (
          checkCollision(
            50, birdY.current,
            pipe.x + 5, // Small offset for pipe graphic
            pipe.height - 10, // Top pipe bottom part
            PIPE_WIDTH - 10, // Width of collision area
            10 // Height of collision area
          ) ||
          checkCollision(
            50, birdY.current,
            pipe.x + 5,
            pipe.height + PIPE_GAP,
            PIPE_WIDTH - 10,
            PIPE_HEIGHT - 10 // Bottom pipe top part
          )
        ) {
          gameOver.current = true;
          isDying.current = true;
          velocity.current = 0;
          break;
        }
      }
    }

    // Check for floor/ceiling collisions
    if (birdY.current < 0 || birdY.current + BIRD_HEIGHT > CANVAS_HEIGHT - PLATFORM_HEIGHT) {
      if (!gameOver.current) {
        gameOver.current = true;
        isDying.current = true;
        velocity.current = 0;
      }
    }

    // Draw bird
    if (birdImage.current) {
      ctx.save();
      ctx.translate(50 + BIRD_WIDTH / 2, birdY.current + BIRD_HEIGHT / 2);
      ctx.rotate(rotation.current);
      ctx.drawImage(
        birdImage.current,
        -BIRD_WIDTH / 2,
        -BIRD_HEIGHT / 2,
        BIRD_WIDTH,
        BIRD_HEIGHT
      );
      ctx.restore();
    }

    // Draw score
    ctx.fillStyle = 'white';
    ctx.font = '48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(score.current.toString(), CANVAS_WIDTH / 2, 50);

    // Draw restart screen
    if (showRestartScreen.current) {
      drawRestartScreen(ctx);
    }

    // Store the animation frame ID in the ref
    animationFrameIdRef.current = requestAnimationFrame(gameLoop);
  }, [backgroundImage, birdImage, birdY, CANVAS_HEIGHT, CANVAS_WIDTH, checkCollision, drawRestartScreen, drawPipes, drawInstructionsScreen, gameOver, GRAVITY, isDying, PIPE_GAP, PIPE_HEIGHT, PIPE_SPEED, PIPE_WIDTH, pipes, platformImage, PLATFORM_HEIGHT, POWERUP_SIZE, POWERUP_SPAWN_CHANCE, powerUpImage, powerUps, rotation, score, showRestartScreen, spawnPipe, velocity, BIRD_HEIGHT, BIRD_WIDTH, ROTATION_SPEED, gameStarted]);

  const handleJump = useCallback(() => {
    if (!gameOver.current) {
      velocity.current = JUMP_FORCE;
      rotation.current = -Math.PI / 4;
    } else if (showRestartScreen.current) {
      // Reset game state on restart
      gameOver.current = false;
      isDying.current = false;
      showRestartScreen.current = false;
      gameStarted.current = false; // Reset gameStarted so instructions show again
      birdY.current = CANVAS_HEIGHT / 2;
      velocity.current = 0;
      rotation.current = 0;
      pipes.current = [];
      powerUps.current = []; // Clear power-ups on restart
      score.current = 0;
    }
  }, [CANVAS_HEIGHT, JUMP_FORCE, birdY, gameOver, isDying, pipes, rotation, score, showRestartScreen, velocity, powerUps, gameStarted]);

  // Event Listeners and Game Initialization
  useEffect(() => {
    console.log('FloppyGame: Setting up event listeners.');
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        if (!gameStarted.current) {
          gameStarted.current = true;
          velocity.current = JUMP_FORCE;
        }
        handleJump();
      }
    };

    const handleClick = () => {
      if (!gameStarted.current) {
        gameStarted.current = true;
        velocity.current = JUMP_FORCE;
      }
      handleJump();
    };

    window.addEventListener('keydown', handleKeyPress);
    canvas.addEventListener('click', handleClick);

    // Initial setup to load assets and start the main game loop
    const initGame = async () => {
      try {
        birdImage.current = await loadImage('/floppy1.png');
        pipeImage.current = await loadImage('/pipe.svg');
        backgroundImage.current = await loadImage('/background.svg');
        sadFloppyImage.current = await loadImage('/sad floppy.png');
        platformImage.current = await loadImage('/platform.svg');
        powerUpImage.current = await loadImage('/Screenshot 2025-06-17 142218.png');
        console.log('FloppyGame: All images loaded. Initiating game loop.');
        animationFrameIdRef.current = requestAnimationFrame(gameLoop);
      } catch (error) {
        console.error('FloppyGame: Error during game initialization (image loading):', error);
      }
    };

    initGame();

    // Cleanup function
    return () => {
      console.log('FloppyGame: Cleaning up event listeners and animation frame.');
      window.removeEventListener('keydown', handleKeyPress);
      canvas.removeEventListener('click', handleClick);
      
      // Cancel animation frame if it exists
      if (animationFrameIdRef.current !== null) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
    };
  }, [handleJump, gameStarted, velocity, loadImage, gameLoop]);

  // Screen size check effect
  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 850);
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);

    return () => {
      window.removeEventListener('resize', checkScreenSize);
    };
  }, []);

  // If mobile, show message instead of game
  if (isMobile) {
    return (
      <div className={styles.mobileMessage}>
        <h2>Not Available on Mobile</h2>
        <p>Please play on desktop for the best experience!</p>
        <p>Minimum screen width: 850px</p>
      </div>
    );
  }

  return (
    <main>
      <div className={styles.gameContainer}>
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className={styles.gameCanvas}
        ></canvas>
      </div>
    </main>
  );
}; 