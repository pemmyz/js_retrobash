// --- Constants and Setup ---
const SCREEN_WIDTH = 800;
const SCREEN_HEIGHT = 600;

const BLACK = 'rgb(0, 0, 0)';
const WHITE = 'rgb(255, 255, 255)';
const RED = 'rgb(255, 0, 0)';
const GREEN = 'rgb(0, 255, 0)';
const BLUE = 'rgb(0, 0, 255)';
const YELLOW = 'rgb(255, 255, 0)';
const HELP_BG_COLOR = 'rgba(0, 0, 0, 0.8)'; // Semi-transparent for help

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
let score = 0; 
let gameOver = false;
let autoFollowMode = false; 
let lastRandomOffsetTime = 0; 
let randomOffset = 0;       
let showHelp = false; // For help menu

const keysPressed = {}; 

// --- HTML Elements for Buttons ---
const addBallButton = document.getElementById('addBallButton');
const launchBallButton = document.getElementById('launchBallButton');
const resetGameButton = document.getElementById('resetGameButton');
const toggleAutoButton = document.getElementById('toggleAutoButton');


// --- Classes ---
class Paddle {
    constructor(x, y, width, height, color, isAI = false) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.color = color;
        this.speed = DEFAULT_PADDLE_SPEED;
        this.lives = 9;
        this.isAI = isAI;
        if (this.isAI) {
            this.aiRandomOffset = 0;
            this.lastAiRandomOffsetTime = 0;
        }
    }

    move(dx, dy) {
        this.x += dx;
        this.y += dy;

        if (this.width > this.height) { 
            if (this.x < 0) this.x = 0;
            if (this.x + this.width > SCREEN_WIDTH) this.x = SCREEN_WIDTH - this.width;
        } else { 
            if (this.y < 0) this.y = 0;
            if (this.y + this.height > SCREEN_HEIGHT) this.y = SCREEN_HEIGHT - this.height;
        }
    }

    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);
    }

    get rect() { 
        return {
            left: this.x, right: this.x + this.width, top: this.y, bottom: this.y + this.height,
            centerx: this.x + this.width / 2, centery: this.y + this.height / 2,
            width: this.width, height: this.height
        };
    }
}

class Ball {
    constructor(x, y, radius, color) {
        this.x = x; this.y = y; this.radius = radius; this.color = color;
        this.dx = DEFAULT_BALL_SPEED * (Math.random() < 0.5 ? 1 : -1);
        this.dy = DEFAULT_BALL_SPEED * (Math.random() < 0.5 ? 1 : -1);
        this.speed = Math.sqrt(this.dx ** 2 + this.dy ** 2);
    }
    move() { this.x += this.dx; this.y += this.dy; }
    draw(ctx) {
        ctx.fillStyle = this.color; ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2); ctx.fill();
    }
    resetPosition() { 
        this.x = SCREEN_WIDTH / 2; this.y = SCREEN_HEIGHT / 2;
        this.dx = DEFAULT_BALL_SPEED * (Math.random() < 0.5 ? 1 : -1);
        this.dy = DEFAULT_BALL_SPEED * (Math.random() < 0.5 ? 1 : -1);
        this.speed = Math.sqrt(this.dx ** 2 + this.dy ** 2);
    }
    get rect() { 
        return {
            left: this.x - this.radius, right: this.x + this.radius,
            top: this.y - this.radius, bottom: this.y + this.radius,
            centerx: this.x, centery: this.y,
            width: this.radius * 2, height: this.radius * 2
        };
    }
}

// --- Game Actions ---
function performResetGame(numBalls = 1) {
    balls = [];
    for (let i = 0; i < numBalls; i++) {
        balls.push(new Ball(SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2, BALL_RADIUS, WHITE));
    }
    paddles.forEach(paddle => {
        paddle.lives = 9;
        if (paddle.isAI) paddle.aiRandomOffset = 0;
    });
    paddleBottom.x = SCREEN_WIDTH / 2 - PADDLE_WIDTH / 2; paddleBottom.y = SCREEN_HEIGHT - 50;
    paddleTop.x = SCREEN_WIDTH / 2 - PADDLE_WIDTH / 2; paddleTop.y = 40;
    paddleLeft.x = 40; paddleLeft.y = SCREEN_HEIGHT / 2 - PADDLE_VERTICAL_HEIGHT / 2;
    paddleRight.x = SCREEN_WIDTH - 50; paddleRight.y = SCREEN_HEIGHT / 2 - PADDLE_VERTICAL_HEIGHT / 2;
    gameOver = false;
    showHelp = false; // Close help on reset
}

function performToggleAutoFollow() {
    autoFollowMode = !autoFollowMode;
    console.log("Auto-follow mode:", autoFollowMode);
}

function performLaunchBall() {
    if (gameOver || showHelp) return;
    balls.forEach(ball => {
        ball.x = paddleBottom.rect.centerx;
        ball.y = paddleBottom.y - ball.radius - 10; 
        ball.dx = 0;
        if (ball.speed === 0) ball.speed = DEFAULT_BALL_SPEED; 
        ball.dy = -ball.speed;
    });
}

function performAddBall() {
    if (gameOver || showHelp) return;
    const MAX_BALLS_VIA_BUTTON = 20;
    if (balls.length < MAX_BALLS_VIA_BUTTON) {
        balls.push(new Ball(SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2, BALL_RADIUS, WHITE));
    } else {
        console.log(`Max balls (${MAX_BALLS_VIA_BUTTON}) reached via button.`);
    }
}

// --- Helper Functions ---
function handleBallPaddleCollision(ball, paddle) {
    const paddleRect = paddle.rect;
    if (paddle.width > paddle.height) { 
        let relX = (ball.x - paddleRect.left) / paddleRect.width - 0.5;
        relX = Math.max(-0.5, Math.min(0.5, relX)); 
        const angleRange = 130; 
        if (Math.abs(relX) < 0.05) { ball.dy = -ball.dy; } 
        else {
            let bounceAngleRad = (relX * angleRange) * (Math.PI / 180);
            ball.dx = ball.speed * Math.sin(bounceAngleRad);
            ball.dy = (paddle === paddleBottom ? -1 : 1) * ball.speed * Math.cos(bounceAngleRad);
        }
    } else { ball.dx = -ball.dx; }
    const currentSpeedSq = ball.dx ** 2 + ball.dy ** 2;
    if (currentSpeedSq > 0) { 
        const factor = ball.speed / Math.sqrt(currentSpeedSq);
        ball.dx *= factor; ball.dy *= factor;
    }
}

function checkCollision(obj1Rect, obj2Rect) { 
    return obj1Rect.left < obj2Rect.right && obj1Rect.right > obj2Rect.left &&
           obj1Rect.top < obj2Rect.bottom && obj1Rect.bottom > obj2Rect.top;
}

// --- Input Handling ---
window.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();
    keysPressed[key] = true;

    if (key === 'h') {
        showHelp = !showHelp;
        event.preventDefault(); 
    }
    if (key === 'n') { 
        performResetGame(balls.length > 0 ? balls.length : 1); 
    }
    
    if (showHelp && key !== 'h' && key !== 'n') return; 
    if (gameOver && key !== 'n') return; 

    if (key === ' ') { 
        performLaunchBall();
        event.preventDefault(); 
    }
    if (key === 'a') { 
        performToggleAutoFollow();
    }
    const numKey = parseInt(event.key); 
    if (!isNaN(numKey) && numKey >= 1 && numKey <= 5) {
        performResetGame(numKey);
    }
});

window.addEventListener('keyup', (event) => {
    keysPressed[event.key.toLowerCase()] = false;
});

// --- Button Event Listeners ---
if (addBallButton) addBallButton.addEventListener('click', performAddBall);
if (launchBallButton) launchBallButton.addEventListener('click', performLaunchBall);
if (resetGameButton) resetGameButton.addEventListener('click', () => performResetGame(balls.length > 0 ? balls.length : 1));
if (toggleAutoButton) toggleAutoButton.addEventListener('click', performToggleAutoFollow);

// --- Game Initialization ---
function initGameObjects() {
    paddleBottom = new Paddle(SCREEN_WIDTH / 2 - PADDLE_WIDTH / 2, SCREEN_HEIGHT - 50, PADDLE_WIDTH, PADDLE_HEIGHT, BLUE, false);
    paddleTop = new Paddle(SCREEN_WIDTH / 2 - PADDLE_WIDTH / 2, 40, PADDLE_WIDTH, PADDLE_HEIGHT, GREEN, true);
    paddleLeft = new Paddle(40, SCREEN_HEIGHT / 2 - PADDLE_VERTICAL_HEIGHT / 2, PADDLE_VERTICAL_WIDTH, PADDLE_VERTICAL_HEIGHT, YELLOW, true); 
    paddleRight = new Paddle(SCREEN_WIDTH - 50, SCREEN_HEIGHT / 2 - PADDLE_VERTICAL_HEIGHT / 2, PADDLE_VERTICAL_WIDTH, PADDLE_VERTICAL_HEIGHT, RED, true); 
    paddles = [paddleBottom, paddleTop, paddleLeft, paddleRight];
    performResetGame(1); 
    globalStartTime = performance.now(); 
}

// --- Game Loop Functions ---
function updateButtonStates() {
    const canInteract = !gameOver && !showHelp;
    if (addBallButton) addBallButton.disabled = !canInteract;
    if (launchBallButton) launchBallButton.disabled = !canInteract;
    if (resetGameButton) resetGameButton.disabled = false; 
    if (toggleAutoButton) toggleAutoButton.disabled = showHelp; 
}

function update() {
    updateButtonStates(); 

    if (gameOver || showHelp) { 
        return; 
    }

    const currentTime = performance.now();

    // Update random offset for player's auto-follow mode periodically
    if (autoFollowMode && currentTime - lastRandomOffsetTime > 2000) {
        randomOffset = Math.floor(Math.random() * 101) - 50; 
        lastRandomOffsetTime = currentTime;
    }
    
    // Update random offset for AI paddles periodically
    paddles.forEach(paddle => {
        if (paddle.isAI && currentTime - (paddle.lastAiRandomOffsetTime || 0) > 2000) {
            paddle.aiRandomOffset = Math.floor(Math.random() * 81) - 40; 
            paddle.lastAiRandomOffsetTime = currentTime;
        }
    });

    // Player paddle (paddleBottom) movement
    if (autoFollowMode) {
        if (balls.length > 0) {
            let targetBall = null;
            if (balls.length === 1) {
                targetBall = balls[0];
            } else {
                // Find balls moving towards the player paddle (bottom)
                const potentialTargets = balls.filter(b => b.dy > 0); // Positive dy means moving downwards

                if (potentialTargets.length > 0) {
                    // Target the closest ball among those moving towards the paddle
                    targetBall = potentialTargets.reduce((closest, current) => {
                        const distToCurrent = Math.hypot(current.x - paddleBottom.rect.centerx, current.y - paddleBottom.rect.centery);
                        const distToClosest = Math.hypot(closest.x - paddleBottom.rect.centerx, closest.y - paddleBottom.rect.centery);
                        return distToCurrent < distToClosest ? current : closest;
                    });
                } else {
                    // If no balls are moving towards paddle, target the overall closest ball
                    targetBall = balls.reduce((closest, current) => {
                        const distToCurrent = Math.hypot(current.x - paddleBottom.rect.centerx, current.y - paddleBottom.rect.centery);
                        const distToClosest = Math.hypot(closest.x - paddleBottom.rect.centerx, closest.y - paddleBottom.rect.centery);
                        return distToCurrent < distToClosest ? current : closest;
                    });
                }
            }

            if (targetBall) {
                const targetX = targetBall.x + randomOffset; // Apply player's random offset
                if (targetX < paddleBottom.rect.centerx) {
                    paddleBottom.move(-paddleBottom.speed, 0);
                }
                if (targetX > paddleBottom.rect.centerx) {
                    paddleBottom.move(paddleBottom.speed, 0);
                }
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
        [paddleTop, paddleLeft, paddleRight].forEach(paddle => {
            let targetBall = null;
            if (balls.length === 1) { targetBall = balls[0]; } 
            else {
                let potentialTargets = [];
                if (paddle === paddleTop) potentialTargets = balls.filter(b => b.dy < 0); // Moving towards top
                else if (paddle === paddleLeft) potentialTargets = balls.filter(b => b.dx < 0); // Moving towards left
                else if (paddle === paddleRight) potentialTargets = balls.filter(b => b.dx > 0); // Moving towards right

                if (potentialTargets.length > 0) {
                    targetBall = potentialTargets.reduce((closest, current) => {
                        const distC = Math.hypot(current.x - paddle.rect.centerx, current.y - paddle.rect.centery);
                        const distP = Math.hypot(closest.x - paddle.rect.centerx, closest.y - paddle.rect.centery);
                        return distC < distP ? current : closest;
                    });
                } else {
                     targetBall = balls.reduce((closest, current) => {
                        const distC = Math.hypot(current.x - paddle.rect.centerx, current.y - paddle.rect.centery);
                        const distP = Math.hypot(closest.x - paddle.rect.centerx, closest.y - paddle.rect.centery);
                        return distC < distP ? current : closest;
                    });
                }
            }
            if (targetBall) {
                let targetPos;
                if (paddle === paddleTop) { 
                    targetPos = targetBall.x + (paddle.aiRandomOffset || 0);
                    if (targetPos < paddle.rect.centerx) paddle.move(-paddle.speed, 0);
                    if (targetPos > paddle.rect.centerx) paddle.move(paddle.speed, 0);
                } else { 
                    targetPos = targetBall.y + (paddle.aiRandomOffset || 0);
                    if (targetPos < paddle.rect.centery) paddle.move(0, -paddle.speed);
                    if (targetPos > paddle.rect.centery) paddle.move(0, paddle.speed);
                }
            }
        });
    }
    
    // Ball speed control
    let ballSpeedChanged = false;
    if (keysPressed['arrowup']) {
        balls.forEach(ball => ball.speed = Math.min(ball.speed + 0.1, 20)); // Max speed cap
        ballSpeedChanged = true;
    }
    if (keysPressed['arrowdown']) {
        balls.forEach(ball => ball.speed = Math.max(0.1, ball.speed - 0.1));
        ballSpeedChanged = true;
    }

    if (ballSpeedChanged && balls.length > 0) {
        balls.forEach(ball => { 
            const angle = Math.atan2(ball.dy, ball.dx);
            if (ball.dx === 0 && ball.dy === 0 && ball.speed > 0) { 
                ball.dy = -ball.speed; ball.dx = 0;
            } else if (ball.speed === 0) { ball.dx = 0; ball.dy = 0; }
            else {
                ball.dx = ball.speed * Math.cos(angle);
                ball.dy = ball.speed * Math.sin(angle);
            }
        });
    }
    
    // Update paddle speeds based on ball speed
    if (balls.length > 0) {
        const baseSpeed = Math.max(0.1, balls[0].speed); 
        paddles.forEach(paddle => {
            paddle.speed = PADDLE_SPEED_RATIO * baseSpeed;
            if (paddle.speed < 1) paddle.speed = 1; 
        });
    }

    // Ball movement and collisions
    const ballsToRemoveIndices = []; 
    balls.forEach((ball, index) => {
        ball.move();
        const ballR = ball.rect; 

        // Ball-Paddle collisions
        paddles.forEach(paddle => {
            const paddleR = paddle.rect;
            if (checkCollision(ballR, paddleR)) { 
                if (paddle === paddleBottom && ball.dy > 0 && ballR.bottom >= paddleR.top && ballR.top < paddleR.bottom) {
                    ball.y = paddleR.top - ball.radius; handleBallPaddleCollision(ball, paddle);
                } else if (paddle === paddleTop && ball.dy < 0 && ballR.top <= paddleR.bottom && ballR.bottom > paddleR.top) {
                    ball.y = paddleR.bottom + ball.radius; handleBallPaddleCollision(ball, paddle);
                } else if (paddle === paddleLeft && ball.dx < 0 && ballR.left <= paddleR.right && ballR.right > paddleR.left) {
                    ball.x = paddleR.right + ball.radius; handleBallPaddleCollision(ball, paddle);
                } else if (paddle === paddleRight && ball.dx > 0 && ballR.right >= paddleR.left && ballR.left < paddleR.right) {
                    ball.x = paddleR.left - ball.radius; handleBallPaddleCollision(ball, paddle);
                }
            }
        });

        // Ball-Wall collisions (loss of life)
        let scoredAgainstPaddle = false;
        if (ballR.bottom >= SCREEN_HEIGHT) { paddleBottom.lives--; scoredAgainstPaddle = true; } 
        else if (ballR.top <= 0) { paddleTop.lives--; scoredAgainstPaddle = true; } 
        else if (ballR.left <= 0) { paddleLeft.lives--; scoredAgainstPaddle = true; } 
        else if (ballR.right >= SCREEN_WIDTH) { paddleRight.lives--; scoredAgainstPaddle = true; }

        if (scoredAgainstPaddle) {
            ballsToRemoveIndices.push(index); 
            if (paddles.some(p => p.lives <= 0)) { gameOver = true; }
        }
    });

    // Remove balls that went out and replace them if game not over
    for (let i = ballsToRemoveIndices.length - 1; i >= 0; i--) {
        balls.splice(ballsToRemoveIndices[i], 1);
        if (!gameOver) { 
            balls.push(new Ball(SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2, BALL_RADIUS, WHITE));
        }
    }
    // Ensure at least one ball if game not over
    if (balls.length === 0 && !gameOver) {
        balls.push(new Ball(SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2, BALL_RADIUS, WHITE));
    }
}

function drawHelpMenu() {
    ctx.fillStyle = HELP_BG_COLOR;
    ctx.fillRect(50, 50, SCREEN_WIDTH - 100, SCREEN_HEIGHT - 100);

    ctx.fillStyle = WHITE;
    ctx.font = `bold 24px ${FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.fillText("HELP MENU", SCREEN_WIDTH / 2, 80);

    ctx.font = `16px ${FONT_FAMILY}`;
    ctx.textAlign = 'left';
    const helpText = [
        "CONTROLS:",
        "------------------------------------",
        "Arrow Left/Right: Move your paddle (bottom)",
        "Space Bar / Launch Ball Button: Launch ball from your paddle",
        "Up/Down Arrows: Increase/Decrease ball speed",
        "",
        "A / Toggle Auto Button: Toggle auto-follow for your paddle",
        "N / Reset Game Button: Reset the current game",
        "1-5 Keys: Reset game with 1 to 5 balls",
        "Add Ball Button: Add a new ball to the center",
        "",
        "H: Toggle this Help Menu",
        "------------------------------------",
        "Goal: Don't let the ball pass your paddle!",
        "Each paddle has 9 lives.",
    ];

    let yPos = 130;
    helpText.forEach(line => {
        ctx.fillText(line, 70, yPos);
        yPos += 22;
    });
    ctx.textAlign = 'start'; // Reset alignment
}

function draw() {
    ctx.fillStyle = BLACK;
    ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

    paddles.forEach(paddle => paddle.draw(ctx));
    balls.forEach(ball => ball.draw(ctx));

    ctx.fillStyle = WHITE;
    ctx.textBaseline = 'top'; 
    const smallFontSize = Math.floor(FONT_SIZE * 0.65); 
    ctx.font = `${smallFontSize}px ${FONT_FAMILY}`;

    if (gameOver) {
        ctx.font = `${FONT_SIZE}px ${FONT_FAMILY}`; 
        ctx.textAlign = 'center';
        const gameOverText = "Game Over! Press 'N' or Reset Button to restart.";
        ctx.fillText(gameOverText, SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 - FONT_SIZE / 2);
        ctx.textAlign = 'start'; // Reset
    }

    const globalElapsedTime = (performance.now() - globalStartTime) / 1000;
    ctx.fillText(`Playtime: ${globalElapsedTime.toFixed(1)} s`, 10, smallFontSize * 2.5 + 10); 

    if (balls.length > 0) {
        ctx.fillText(`Speed: ${balls[0].speed.toFixed(1)}`, 10, 10);
    } else {
        ctx.fillText(`Speed: N/A`, 10, 10);
    }
    ctx.fillText(`Score: ${score}`, 10, smallFontSize + 15);

    const livesText = `Lives - B:${paddleBottom.lives} T:${paddleTop.lives} L:${paddleLeft.lives} R:${paddleRight.lives}`;
    const livesTextMetrics = ctx.measureText(livesText); // For centering if needed, but not strictly necessary for how it's used here
    ctx.textAlign = 'center';
    ctx.fillText(livesText, SCREEN_WIDTH / 2, 10);
    ctx.textAlign = 'start'; // Reset

    // Always draw "Press H for Help"
    ctx.font = `14px ${FONT_FAMILY}`;
    ctx.fillStyle = WHITE;
    ctx.textAlign = 'right';
    ctx.fillText("Press H for Help", SCREEN_WIDTH - 10, SCREEN_HEIGHT - 25);
    ctx.textAlign = 'start'; // Reset

    if (showHelp) {
        drawHelpMenu();
    }
}

function gameLoop() {
    update(); 
    draw();   
    requestAnimationFrame(gameLoop); 
}

// --- Start Game ---
initGameObjects(); 
gameLoop();
