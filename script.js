// --- Constants and Setup ---
const SCREEN_WIDTH = 800;
const SCREEN_HEIGHT = 600;

const BLACK = 'rgb(0, 0, 0)';
const WHITE = 'rgb(255, 255, 255)';
const RED = 'rgb(255, 0, 0)';
const GREEN = 'rgb(0, 255, 0)';
const BLUE = 'rgb(0, 0, 255)';
const YELLOW = 'rgb(255, 255, 0)';

const DEFAULT_BALL_SPEED = 3;
const DEFAULT_PADDLE_SPEED = 6;
const PADDLE_SPEED_RATIO = DEFAULT_PADDLE_SPEED / DEFAULT_BALL_SPEED;

const PADDLE_WIDTH = 100;
const PADDLE_HEIGHT = 10;
const PADDLE_VERTICAL_HEIGHT = 100;
const PADDLE_VERTICAL_WIDTH = 10;

const BALL_RADIUS = 10;

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = SCREEN_WIDTH;
canvas.height = SCREEN_HEIGHT;

const FONT_SIZE = 36;
const FONT_FAMILY = "Arial"; 

// --- Game State Variables ---
let balls = [];
let paddles = [];
let paddleBottom, paddleTop, paddleLeft, paddleRight;

let globalStartTime;
let score = 0; // Score is not updated in the original logic, but displayed
let gameOver = false;
let autoFollowMode = false;
let lastRandomOffsetTime = 0;
let randomOffset = 0;

const keysPressed = {}; // To track continuous key presses

// --- Classes ---
class Paddle {
    constructor(x, y, width, height, color) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.color = color;
        this.speed = DEFAULT_PADDLE_SPEED;
        this.lives = 9;
    }

    move(dx, dy) {
        this.x += dx;
        this.y += dy;

        // Keep paddle within screen bounds
        if (this.width > this.height) { // Horizontal paddle
            if (this.x < 0) this.x = 0;
            if (this.x + this.width > SCREEN_WIDTH) this.x = SCREEN_WIDTH - this.width;
        } else { // Vertical paddle
            if (this.y < 0) this.y = 0;
            if (this.y + this.height > SCREEN_HEIGHT) this.y = SCREEN_HEIGHT - this.height;
        }
    }

    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);
    }

    get rect() { // Mimics Pygame's rect for easier collision logic
        return {
            left: this.x,
            right: this.x + this.width,
            top: this.y,
            bottom: this.y + this.height,
            centerx: this.x + this.width / 2,
            centery: this.y + this.height / 2,
            width: this.width,
            height: this.height
        };
    }
}

class Ball {
    constructor(x, y, radius, color) {
        this.x = x; // center x
        this.y = y; // center y
        this.radius = radius;
        this.color = color;
        this.dx = DEFAULT_BALL_SPEED * (Math.random() < 0.5 ? 1 : -1);
        this.dy = DEFAULT_BALL_SPEED * (Math.random() < 0.5 ? 1 : -1);
        this.speed = Math.sqrt(this.dx ** 2 + this.dy ** 2);
    }

    move() {
        this.x += this.dx;
        this.y += this.dy;
    }

    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
    }
    
    resetPosition() { // Resets a single ball to center with new random direction
        this.x = SCREEN_WIDTH / 2;
        this.y = SCREEN_HEIGHT / 2;
        this.dx = DEFAULT_BALL_SPEED * (Math.random() < 0.5 ? 1 : -1);
        this.dy = DEFAULT_BALL_SPEED * (Math.random() < 0.5 ? 1 : -1);
        this.speed = Math.sqrt(this.dx ** 2 + this.dy ** 2);
    }

    get rect() { // Mimics Pygame's rect for a circular ball
        return {
            left: this.x - this.radius,
            right: this.x + this.radius,
            top: this.y - this.radius,
            bottom: this.y + this.radius,
            centerx: this.x,
            centery: this.y,
            width: this.radius * 2,
            height: this.radius * 2
        };
    }
}

// --- Helper Functions ---
function resetGame(numBalls = 1) {
    balls = [];
    for (let i = 0; i < numBalls; i++) {
        balls.push(new Ball(SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2, BALL_RADIUS, WHITE));
    }

    paddles.forEach(paddle => {
        paddle.speed = DEFAULT_PADDLE_SPEED;
        paddle.lives = 9;
    });
    
    // Reset paddle positions
    paddleBottom.x = SCREEN_WIDTH / 2 - PADDLE_WIDTH / 2;
    paddleBottom.y = SCREEN_HEIGHT - 50;
    paddleTop.x = SCREEN_WIDTH / 2 - PADDLE_WIDTH / 2;
    paddleTop.y = 40;
    paddleLeft.x = 40;
    paddleLeft.y = SCREEN_HEIGHT / 2 - PADDLE_VERTICAL_HEIGHT / 2;
    paddleRight.x = SCREEN_WIDTH - 50; // Left edge of the right paddle
    paddleRight.y = SCREEN_HEIGHT / 2 - PADDLE_VERTICAL_HEIGHT / 2;

    gameOver = false;
    // Python's global_start_time is not reset on 'N', so JS version matches this.
}

function toggleAutoFollow() {
    autoFollowMode = !autoFollowMode;
}

function handleBallPaddleCollision(ball, paddle) {
    const paddleRect = paddle.rect;

    if (paddle.width > paddle.height) { // Horizontal Paddles (Top/Bottom)
        let relativeIntersectX = (ball.x - paddleRect.left) / paddleRect.width - 0.5;
        relativeIntersectX = Math.max(-0.5, Math.min(0.5, relativeIntersectX)); // Clamp to [-0.5, 0.5]

        const angleRange = 130; // degrees, as in Python

        if (Math.abs(relativeIntersectX) < 0.05) { // Center hit zone
            // Simple reflection of dy for near-center hits
            ball.dy = -ball.dy; 
        } else {
            let bounceAngleDegrees = relativeIntersectX * angleRange; // Angle from vertical normal
            let bounceAngleRadians = bounceAngleDegrees * (Math.PI / 180);

            ball.dx = ball.speed * Math.sin(bounceAngleRadians);
            if (paddle === paddleBottom) { // Ball hits bottom paddle, should go up
                ball.dy = -ball.speed * Math.cos(bounceAngleRadians);
            } else { // Ball hits top paddle, should go down
                ball.dy = ball.speed * Math.cos(bounceAngleRadians);
            }
        }
    } else { // Vertical Paddles (Left/Right)
        // Simple reflection of dx, as in Python
        ball.dx = -ball.dx;
        // Optional: Add slight change to dy based on hit position for more variety
        // let relativeIntersectY = (ball.y - paddleRect.top) / paddleRect.height - 0.5;
        // ball.dy += relativeIntersectY * (ball.speed * 0.2); 
    }

    // Ensure ball speed is conserved after angle calculations
    const currentSpeedSq = ball.dx ** 2 + ball.dy ** 2;
    if (currentSpeedSq > 0) { // Avoid division by zero if speed is zero
        const currentSpeedMagnitude = Math.sqrt(currentSpeedSq);
        const factor = ball.speed / currentSpeedMagnitude;
        ball.dx *= factor;
        ball.dy *= factor;
    }
}

function checkCollision(obj1Rect, obj2Rect) { // Axis-Aligned Bounding Box collision
    return obj1Rect.left < obj2Rect.right &&
           obj1Rect.right > obj2Rect.left &&
           obj1Rect.top < obj2Rect.bottom &&
           obj1Rect.bottom > obj2Rect.top;
}

// --- Input Handling ---
window.addEventListener('keydown', (event) => {
    keysPressed[event.key.toLowerCase()] = true; // Use toLowerCase for case-insensitivity

    // Handle single-press actions (not continuous)
    if (event.key === ' ') { // Space bar: Launch ball from player paddle
        balls.forEach(ball => {
            ball.x = paddleBottom.rect.centerx;
            ball.y = paddleBottom.y - ball.radius - 10; // Position above paddleBottom (paddleBottom.y is its top)
            ball.dx = 0;
            // Ensure ball shoots up with its current speed, or default if speed is 0
            if (ball.speed === 0) ball.speed = DEFAULT_BALL_SPEED; 
            ball.dy = -ball.speed;
        });
    }
    if (event.key.toLowerCase() === 'n') { // 'N' key: Reset game
        resetGame(balls.length > 0 ? balls.length : 1); // Keep current ball count or default to 1
    }
    if (event.key.toLowerCase() === 'a') { // 'A' key: Toggle auto-follow mode
        toggleAutoFollow();
    }
    const numKey = parseInt(event.key); // Number keys 1-5: Set number of balls and reset
    if (!isNaN(numKey) && numKey >= 1 && numKey <= 5) {
        resetGame(numKey);
    }
});

window.addEventListener('keyup', (event) => {
    keysPressed[event.key.toLowerCase()] = false;
});

// --- Game Initialization ---
function initGameObjects() {
    paddleBottom = new Paddle(SCREEN_WIDTH / 2 - PADDLE_WIDTH / 2, SCREEN_HEIGHT - 50, PADDLE_WIDTH, PADDLE_HEIGHT, BLUE);
    paddleTop = new Paddle(SCREEN_WIDTH / 2 - PADDLE_WIDTH / 2, 40, PADDLE_WIDTH, PADDLE_HEIGHT, GREEN);
    paddleLeft = new Paddle(40, SCREEN_HEIGHT / 2 - PADDLE_VERTICAL_HEIGHT / 2, PADDLE_VERTICAL_WIDTH, PADDLE_VERTICAL_HEIGHT, YELLOW);
    paddleRight = new Paddle(SCREEN_WIDTH - 50, SCREEN_HEIGHT / 2 - PADDLE_VERTICAL_HEIGHT / 2, PADDLE_VERTICAL_WIDTH, PADDLE_VERTICAL_HEIGHT, RED);

    paddles = [paddleBottom, paddleTop, paddleLeft, paddleRight];
    resetGame(1); // Start with 1 ball
    globalStartTime = performance.now(); // Record game start time
}

// --- Game Loop Functions ---
function update() {
    if (gameOver) {
        return; // Stop updates if game is over
    }

    const currentTime = performance.now();

    // Update random offset for auto-follow mode periodically
    if (currentTime - lastRandomOffsetTime > 2000) { // Every 2 seconds
        randomOffset = Math.floor(Math.random() * 101) - 50; // Random value between -50 and 50
        lastRandomOffsetTime = currentTime;
    }

    // Player paddle (paddleBottom) movement
    if (autoFollowMode) {
        if (balls.length > 0) {
            const targetX = balls[0].x + randomOffset; // AI follows the first ball with an offset
            if (targetX < paddleBottom.rect.centerx) {
                paddleBottom.move(-paddleBottom.speed, 0);
            }
            if (targetX > paddleBottom.rect.centerx) {
                paddleBottom.move(paddleBottom.speed, 0);
            }
        }
    } else { // Manual control
        if (keysPressed['arrowleft']) {
            paddleBottom.move(-paddleBottom.speed, 0);
        }
        if (keysPressed['arrowright']) {
            paddleBottom.move(paddleBottom.speed, 0);
        }
    }

    // AI Paddles (top, left, right) movement
    if (balls.length > 0) {
        const mainBall = balls[0]; // AI follows the first ball

        [paddleTop, paddleLeft, paddleRight].forEach(paddle => {
            if (paddle === paddleTop) { // Horizontal AI paddle (top)
                if (mainBall.x < paddle.rect.centerx) paddle.move(-paddle.speed, 0);
                if (mainBall.x > paddle.rect.centerx) paddle.move(paddle.speed, 0);
            } else { // Vertical AI paddles (left, right)
                if (mainBall.y < paddle.rect.centery) paddle.move(0, -paddle.speed);
                if (mainBall.y > paddle.rect.centery) paddle.move(0, paddle.speed);
            }
        });
    }
    
    // Ball speed control with ArrowUp/ArrowDown
    let ballSpeedChanged = false;
    if (keysPressed['arrowup']) {
        balls.forEach(ball => ball.speed += 0.1);
        ballSpeedChanged = true;
    }
    if (keysPressed['arrowdown']) {
        balls.forEach(ball => {
            if (ball.speed > 0.2) ball.speed -= 0.1; else ball.speed = 0.1; // Min speed 0.1
        });
        ballSpeedChanged = true;
    }

    if (ballSpeedChanged && balls.length > 0) {
        balls.forEach(ball => { // Rescale dx, dy if speed changed
            const angle = Math.atan2(ball.dy, ball.dx);
            if (ball.dx === 0 && ball.dy === 0 && ball.speed > 0) { // If ball was stationary
                ball.dy = -ball.speed; // Default new direction (upwards)
                ball.dx = 0;
            } else if (ball.speed === 0) { // If speed becomes 0
                 ball.dx = 0; ball.dy = 0;
            }else {
                ball.dx = ball.speed * Math.cos(angle);
                ball.dy = ball.speed * Math.sin(angle);
            }
        });
    }
    
    // Update all paddle speeds based on the (first) ball's speed
    if (balls.length > 0) {
        const baseSpeed = Math.max(0.1, balls[0].speed); // Ensure baseSpeed is not zero for ratio calc
        paddles.forEach(paddle => {
            paddle.speed = PADDLE_SPEED_RATIO * baseSpeed;
            if (paddle.speed < 1) paddle.speed = 1; // Minimum paddle speed
        });
    }


    // Ball movement and collisions
    const ballsToRemoveIndices = []; // Store indices of balls to remove
    balls.forEach((ball, index) => {
        ball.move();
        const ballR = ball.rect; // shorthand for ball.rect

        // Ball-Paddle collisions
        paddles.forEach(paddle => {
            const paddleR = paddle.rect;
            if (checkCollision(ballR, paddleR)) { // General collision check first
                // Specific directional checks and position adjustment
                if (paddle === paddleBottom && ball.dy > 0 && ballR.bottom >= paddleR.top && ballR.top < paddleR.bottom) {
                    ball.y = paddleR.top - ball.radius; // Adjust position to prevent sticking
                    handleBallPaddleCollision(ball, paddle);
                } else if (paddle === paddleTop && ball.dy < 0 && ballR.top <= paddleR.bottom && ballR.bottom > paddleR.top) {
                    ball.y = paddleR.bottom + ball.radius;
                    handleBallPaddleCollision(ball, paddle);
                } else if (paddle === paddleLeft && ball.dx < 0 && ballR.left <= paddleR.right && ballR.right > paddleR.left) {
                    ball.x = paddleR.right + ball.radius;
                    handleBallPaddleCollision(ball, paddle);
                } else if (paddle === paddleRight && ball.dx > 0 && ballR.right >= paddleR.left && ballR.left < paddleR.right) {
                    ball.x = paddleR.left - ball.radius;
                    handleBallPaddleCollision(ball, paddle);
                }
            }
        });

        // Ball-Wall collisions (loss of life for corresponding paddle)
        let scoredAgainstPaddle = false;
        if (ballR.bottom >= SCREEN_HEIGHT) { // Hits bottom wall
            paddleBottom.lives--; scoredAgainstPaddle = true;
        } else if (ballR.top <= 0) { // Hits top wall
            paddleTop.lives--; scoredAgainstPaddle = true;
        } else if (ballR.left <= 0) { // Hits left wall
            paddleLeft.lives--; scoredAgainstPaddle = true;
        } else if (ballR.right >= SCREEN_WIDTH) { // Hits right wall
            paddleRight.lives--; scoredAgainstPaddle = true;
        }

        if (scoredAgainstPaddle) {
            ballsToRemoveIndices.push(index); // Mark ball for removal
            if (paddles.some(p => p.lives <= 0)) { // Check if any paddle has lost all lives
                gameOver = true;
            }
        }
    });

    // Remove balls that went out (iterate backwards to avoid index issues)
    for (let i = ballsToRemoveIndices.length - 1; i >= 0; i--) {
        balls.splice(ballsToRemoveIndices[i], 1);
        if (!gameOver) { // If game is not over, replace the lost ball
            balls.push(new Ball(SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2, BALL_RADIUS, WHITE));
        }
    }
    // If all balls are gone for some reason and game is not over, add one.
    // This case should typically be handled by the replacement logic above.
    if (balls.length === 0 && !gameOver) {
        balls.push(new Ball(SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2, BALL_RADIUS, WHITE));
    }
}

function draw() {
    // Clear screen
    ctx.fillStyle = BLACK;
    ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

    // Draw paddles
    paddles.forEach(paddle => paddle.draw(ctx));

    // Draw balls
    balls.forEach(ball => ball.draw(ctx));

    // Draw UI Text
    ctx.fillStyle = WHITE;
    ctx.textBaseline = 'top'; // Align text from top-left for easier positioning

    const smallFontSize = Math.floor(FONT_SIZE * 0.65); // Smaller font for info text
    ctx.font = `${smallFontSize}px ${FONT_FAMILY}`;

    if (gameOver) {
        ctx.font = `${FONT_SIZE}px ${FONT_FAMILY}`; // Larger font for Game Over message
        const gameOverText = "Game Over! Press 'N' to restart.";
        const textMetrics = ctx.measureText(gameOverText);
        ctx.fillText(gameOverText, (SCREEN_WIDTH - textMetrics.width) / 2, SCREEN_HEIGHT / 2 - FONT_SIZE / 2);
    }

    // Display Playtime
    const globalElapsedTime = (performance.now() - globalStartTime) / 1000;
    ctx.fillText(`Playtime: ${globalElapsedTime.toFixed(1)} s`, 10, smallFontSize * 2.5 + 10); 

    // Display Speed (of the first ball, if any)
    if (balls.length > 0) {
        ctx.fillText(`Speed: ${balls[0].speed.toFixed(1)}`, 10, 10);
    } else {
        ctx.fillText(`Speed: N/A`, 10, 10);
    }
    // Display Score
    ctx.fillText(`Score: ${score}`, 10, smallFontSize + 15);

    // Display Lives
    const livesText = `Lives - B:${paddleBottom.lives} T:${paddleTop.lives} L:${paddleLeft.lives} R:${paddleRight.lives}`;
    const livesTextMetrics = ctx.measureText(livesText);
    ctx.fillText(livesText, (SCREEN_WIDTH - livesTextMetrics.width) / 2, 10);
}

function gameLoop() {
    update(); // Update game state
    draw();   // Render game
    requestAnimationFrame(gameLoop); // Request next frame for smooth animation
}

// --- Start Game ---
initGameObjects(); // Initialize all game entities
gameLoop();        // Start the main game loop
