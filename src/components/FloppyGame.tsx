import React, { useEffect, useRef, useState } from 'react';
import styles from './FloppyGame.module.css';

export const FloppyGame: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastUpdateRef = useRef<number>(0);
  const restartButtonRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
  const birdImage = useRef<HTMLImageElement | null>(null);
  const pipeImage = useRef<HTMLImageElement | null>(null);
  const backgroundImage = useRef<HTMLImageElement | null>(null);
  const sadFloppyImage = useRef<HTMLImageElement | null>(null);
  const platformImage = useRef<HTMLImageElement | null>(null);

  // Game state
  const birdY = useRef(225);
  const velocity = useRef(0);
  const pipes = useRef<Array<{ x: number; height: number; passed: boolean }>>([]);
  const score = useRef(0);
  const gameOver = useRef(false);
  const isDying = useRef(false);
  const showRestartScreen = useRef(false);
  const rotation = useRef(0);

  const CANVAS_WIDTH = 800;
  const CANVAS_HEIGHT = 500;
  const PIPE_WIDTH = 60;
  const PIPE_HEIGHT = 400;
  const PIPE_GAP = 120;
  const BIRD_WIDTH = 40;
  const BIRD_HEIGHT = 30;
  const COLLISION_PADDING = 0;
  const SHOW_DEBUG = true;
  const GRAVITY = 0.35;
  const JUMP_FORCE = -5;
  const ROTATION_SPEED = 0.01;
  const PIPE_SPEED = 2;
  const PLATFORM_HEIGHT = 60;

  const handleJump = () => {
    if (!gameOver.current) {
      velocity.current = JUMP_FORCE;
      // Add jump animation
      rotation.current = -Math.PI / 4;  // Point upward immediately
    } else if (showRestartScreen.current) {
      // Reset game
      gameOver.current = false;
      isDying.current = false;
      showRestartScreen.current = false;
      birdY.current = CANVAS_HEIGHT / 2;
      velocity.current = 0;
      rotation.current = 0;
      pipes.current = [];
      score.current = 0;
    }
  };

  const drawRestartScreen = (ctx: CanvasRenderingContext2D) => {
    // Semi-transparent overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)'; // Balanced opacity for visibility but not full block
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Game over text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Game Over!', CANVAS_WIDTH / 2, 105); // Adjusted Y

    // Score text
    ctx.font = '24px Arial';
    ctx.fillText(`Score: ${score.current}`, CANVAS_WIDTH / 2, 155); // Adjusted Y

    // Restart button
    const buttonWidth = 200;
    const buttonHeight = 50;
    const buttonX = CANVAS_WIDTH / 2 - buttonWidth / 2;
    const buttonY = 310; // Adjusted Y, positioned below the image

    // Draw sad floppy image
    if (sadFloppyImage.current) {
      const imageSize = 100;
      ctx.drawImage(
        sadFloppyImage.current,
        CANVAS_WIDTH / 2 - imageSize / 2,
        195, // Adjusted Y to be just above the button
        imageSize,
        imageSize
      );
    }

    // Button background with gradient
    const gradient = ctx.createLinearGradient(buttonX, buttonY, buttonX, buttonY + buttonHeight);
    gradient.addColorStop(0, '#2196F3');  // Light blue
    gradient.addColorStop(1, '#1976D2');  // Darker blue
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.roundRect(buttonX, buttonY, buttonWidth, buttonHeight, 10);
    ctx.fill();

    // Button border
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Button text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px Arial';
    ctx.fillText('Play Again', CANVAS_WIDTH / 2, buttonY + buttonHeight / 2 + 7);

    // Click detection area
    restartButtonRef.current = {
      x: buttonX,
      y: buttonY,
      width: buttonWidth,
      height: buttonHeight
    };
  };

  const drawPipes = (ctx: CanvasRenderingContext2D) => {
    if (!pipeImage.current) return;

    pipes.current.forEach(pipe => {
      // Draw top pipe
      ctx.save();
      ctx.translate(pipe.x, pipe.height);
      ctx.scale(1, -1);
      ctx.drawImage(pipeImage.current!, 0, 0, PIPE_WIDTH, PIPE_HEIGHT);
      ctx.restore();

      // Draw bottom pipe
      ctx.drawImage(
        pipeImage.current!,
        pipe.x,
        pipe.height + PIPE_GAP,
        PIPE_WIDTH,
        PIPE_HEIGHT
      );

      // Debug collision boxes
      if (SHOW_DEBUG) {
        ctx.strokeStyle = 'red';
        ctx.lineWidth = 2;
        ctx.strokeRect(pipe.x + 55, 0, PIPE_WIDTH - 110, pipe.height - 10);
        ctx.strokeRect(
          pipe.x + 55,
          pipe.height + PIPE_GAP + 10,
          PIPE_WIDTH - 110,
          CANVAS_HEIGHT - (pipe.height + PIPE_GAP + 10)
        );
      }
    });
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Load images
    const loadImage = (src: string): Promise<HTMLImageElement> => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
        img.src = src;
      });
    };

    const init = async () => {
      try {
        birdImage.current = await loadImage('/floppy1.png');
        pipeImage.current = await loadImage('/pipe.svg');
        backgroundImage.current = await loadImage('/background.svg');
        sadFloppyImage.current = await loadImage('/sad floppy.png');
        platformImage.current = await loadImage('/platform.svg');
        console.log('All images loaded successfully');
      } catch (error) {
        console.error('Error loading images:', error);
      }
    };

    init();

    let lastPipeSpawn = 0;
    let animationFrameId: number;
    let deathTime = 0;

    const checkCollision = (birdX: number, birdY: number, pipe: { x: number; height: number }) => {
      const birdLeft = birdX;
      const birdRight = birdX + BIRD_WIDTH;
      const birdTop = birdY;
      const birdBottom = birdY + BIRD_HEIGHT;

      const pipeLeft = pipe.x;
      const pipeRight = pipe.x + PIPE_WIDTH;
      const topPipeBottom = pipe.height;
      const bottomPipeTop = pipe.height + PIPE_GAP;

      // Check if bird is horizontally aligned with the pipe
      if (birdRight > pipeLeft && birdLeft < pipeRight) {
        // Check if bird hits the top pipe
        if (birdTop < topPipeBottom) {
          return true;
        }
        // Check if bird hits the bottom pipe
        if (birdBottom > bottomPipeTop) {
          return true;
        }
      }

      // Check if bird hits top or bottom of screen (excluding platform area)
      if (birdTop < 0 || birdBottom > CANVAS_HEIGHT - PLATFORM_HEIGHT) {
        return true;
      }

      return false;
    };

    const spawnPipe = () => {
      // Random height between 100 and 300
      const minHeight = 100;
      const maxHeight = 300;
      const randomHeight = Math.floor(Math.random() * (maxHeight - minHeight + 1)) + minHeight;

      pipes.current.push({
        x: CANVAS_WIDTH,
        height: randomHeight,
        passed: false
      });
    };

    const gameLoop = (timestamp: number) => {
      if (!lastPipeSpawn) {
        lastPipeSpawn = timestamp;
      }

      const deltaTime = timestamp - lastPipeSpawn;
      lastPipeSpawn = timestamp;

      // Clear canvas
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Draw background
      if (backgroundImage.current) {
        ctx.drawImage(backgroundImage.current, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      }

      // Draw pipes
      drawPipes(ctx);

      // Draw platform - Moved to be above pipes
      if (platformImage.current) {
        ctx.drawImage(
          platformImage.current,
          0,
          CANVAS_HEIGHT - PLATFORM_HEIGHT,
          CANVAS_WIDTH,
          PLATFORM_HEIGHT
        );
      }

      // Update bird position
      if (!gameOver.current) {
        velocity.current += GRAVITY;
        birdY.current += velocity.current;

        // Smoother rotation based on velocity
        const targetRotation = velocity.current * ROTATION_SPEED;
        rotation.current += (targetRotation - rotation.current) * 0.1;  // Smooth interpolation
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
        }
      }

      // Update pipes - only if game is not over
      if (!gameOver.current) {
        pipes.current = pipes.current.filter(pipe => {
          pipe.x -= PIPE_SPEED;
          return pipe.x > -PIPE_WIDTH;
        });
      }

      // Check for collisions
      if (!gameOver.current) {
        for (const pipe of pipes.current) {
          if (checkCollision(50, birdY.current, pipe)) {
            gameOver.current = true;
            isDying.current = true;
            velocity.current = 0;  // Reset velocity for death animation
            break;
          }
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

      // Draw restart screen only after bird has fallen
      if (showRestartScreen.current) {
        drawRestartScreen(ctx);
      }

      animationFrameId = requestAnimationFrame(gameLoop);
    };

    animationFrameId = requestAnimationFrame(gameLoop);

    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        handleJump();
      }
    };

    window.addEventListener('keydown', handleKeyPress);

    return () => {
      window.removeEventListener('keydown', handleKeyPress);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  useEffect(() => {
    // Load bird image
    const birdImg = new Image();
    birdImg.src = '/floppy1.png';
    birdImg.onload = () => {
      console.log('Bird image loaded');
      birdImage.current = birdImg;
    };

    // Load pipe image
    const pipeImg = new Image();
    pipeImg.src = '/pipe.svg';
    pipeImg.onload = () => {
      console.log('Pipe image loaded');
      pipeImage.current = pipeImg;
    };

    // Load background image
    const bgImg = new Image();
    bgImg.src = '/background.svg';
    bgImg.onload = () => {
      console.log('Background image loaded');
      backgroundImage.current = bgImg;
    };

    // Load sad floppy image
    const sadImg = new Image();
    sadImg.src = '/sad floppy.png';
    sadImg.onload = () => {
      console.log('Sad floppy image loaded');
      sadFloppyImage.current = sadImg;
    };
    sadImg.onerror = (e) => {
      console.error('Failed to load sad floppy:', e);
    };

    // Load platform image
    const platformImg = new Image();
    platformImg.src = '/platform.svg';
    platformImg.onload = () => {
      console.log('Platform image loaded');
      platformImage.current = platformImg;
    };
    platformImg.onerror = (e) => {
      console.error('Failed to load platform:', e);
    };
  }, []);

  return (
    <div className={styles.gameContainer}>
      <canvas
        ref={canvasRef}
        className={styles.gameCanvas}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        onClick={(e) => {
          if (gameOver.current) {
            const rect = canvasRef.current?.getBoundingClientRect();
            if (rect) {
              const x = e.clientX - rect.left;
              const y = e.clientY - rect.top;
              
              const buttonX = CANVAS_WIDTH / 2 - 110;
              const buttonY = CANVAS_HEIGHT / 2 + 40;
              
              if (x > buttonX && x < buttonX + 220 &&
                  y > buttonY && y < buttonY + 60) {
                console.log('Click detected on restart button');
                handleJump();
              }
            }
          } else {
            handleJump();
          }
        }}
      />
    </div>
  );
}; 