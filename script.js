// --- Constants and Setup ---
const SCREEN_WIDTH = 800;
const SCREEN_HEIGHT = 600;

const BLACK = 'rgb(0, 0, 0)';
const WHITE = 'rgb(255, 255, 255)';
const RED = 'rgb(255, 0, 0)';
const GREEN = 'rgb(0, 255, 0)';
const BLUE = 'rgb(0, 0, 255)';
const YELLOW = 'rgb(255, 255, 0)';
const HELP_BG_COLOR = 'rgba(0, 0, 0, 0.8)';

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
let showHelp = false;

const keysPressed = {}; // Using event.code for reliability

// --- UI Interaction State ---
let helpClickArea = {};
let isHoveringHelp = false;

// --- HTML Elements for Buttons ---
const addBallButton = document.getElementById('addBallButton');
const launchBallButton = document.getElementById('launchBallButton');
const resetGameButton = document.getElementById('resetGameButton');

// --- Classes ---
class Paddle {
    constructor(x, y, width, height, color, isAI = true) { // Default to AI
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.color = color;
        this.speed = DEFAULT_PADDLE_SPEED;
        this.lives = 9;
        this.isAI = isAI;
        this.aiRandomOffset = 0;
        this.lastAiRandomOffsetTime = 0;
    }

    move(dx, dy) {
        this.x += dx;
        this.y += dy;

        // Clamp position to screen bounds
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
        // Draw a small indicator for human players
        if (!this.isAI) {
            ctx.fillStyle = WHITE;
            ctx.fillRect(this.x + this.width / 2 - 2, this.y + this.height / 2 - 2, 4, 4);
        }
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
        paddle.isAI = true; // Reset all paddles to be AI controlled
        paddle.aiRandomOffset = 0;
    });
    paddleBottom.x = SCREEN_WIDTH / 2 - PADDLE_WIDTH / 2; paddleBottom.y = SCREEN_HEIGHT - 50;
    paddleTop.x = SCREEN_WIDTH / 2 - PADDLE_WIDTH / 2; paddleTop.y = 40;
    paddleLeft.x = 40; paddleLeft.y = SCREEN_HEIGHT / 2 - PADDLE_VERTICAL_HEIGHT / 2;
    paddleRight.x = SCREEN_WIDTH - 50; paddleRight.y = SCREEN_HEIGHT / 2 - PADDLE_VERTICAL_HEIGHT / 2;
    gameOver = false;
    showHelp = false; // Close help on reset
}

function performLaunchBall() {
    if (gameOver || showHelp) return;
    balls.forEach(ball => {
        // Launch from the bottom paddle's center
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
    if (paddle.width > paddle.height) { // Horizontal paddle
        let relX = (ball.x - paddleRect.left) / paddleRect.width - 0.5;
        relX = Math.max(-0.5, Math.min(0.5, relX));
        const angleRange = 130;
        let bounceAngleRad = (relX * angleRange) * (Math.PI / 180);
        ball.dx = ball.speed * Math.sin(bounceAngleRad);
        ball.dy = (paddle === paddleBottom ? -1 : 1) * ball.speed * Math.cos(bounceAngleRad);
    } else { // Vertical paddle
        ball.dx = -ball.dx;
    }
    // Normalize speed vector
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
    // Using event.code is more reliable for physical key locations
    const code = event.code;
    keysPressed[code] = true;

    // --- Player Takeover Logic ---
    const playerControlCodes = {
        'KeyA': paddleTop, 'KeyD': paddleTop,
        'ArrowLeft': paddleBottom, 'ArrowRight': paddleBottom,
        'KeyH': paddleLeft, 'KeyK': paddleLeft,
        'Numpad4': paddleRight, 'Numpad6': paddleRight
    };

    if (playerControlCodes[code] && playerControlCodes[code].isAI) {
        playerControlCodes[code].isAI = false;
        console.log(`Paddle ${paddles.indexOf(playerControlCodes[code])} is now manual.`);
    }

    // --- Global Controls ---
    if (code === 'F1') {
        showHelp = !showHelp;
        event.preventDefault();
    }
    if (code === 'KeyN') {
        performResetGame(balls.length > 0 ? balls.length : 1);
    }

    // Prevent game actions if help or game over is shown
    if (showHelp || gameOver) {
        if (code !== 'KeyN' && code !== 'F1') event.preventDefault();
        return;
    }

    if (code === 'Space') {
        performLaunchBall();
        event.preventDefault();
    }
    const numKey = parseInt(event.key);
    if (!isNaN(numKey) && numKey >= 1 && numKey <= 5) {
        performResetGame(numKey);
    }
});

window.addEventListener('keyup', (event) => {
    keysPressed[event.code] = false;
});

// --- Mouse Listeners for Clickable Help Text ---
canvas.addEventListener('click', (event) => {
    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    // Check if the click is within the help text area
    if (helpClickArea.left && // ensure area is defined
        mouseX >= helpClickArea.left && mouseX <= helpClickArea.right &&
        mouseY >= helpClickArea.top && mouseY <= helpClickArea.bottom) {
        showHelp = !showHelp;
    }
});

canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    // Check if mouse is over the help text area
    if (helpClickArea.left && // ensure area is defined
        mouseX >= helpClickArea.left && mouseX <= helpClickArea.right &&
        mouseY >= helpClickArea.top && mouseY <= helpClickArea.bottom) {
        isHoveringHelp = true;
        canvas.style.cursor = 'pointer';
    } else {
        isHoveringHelp = false;
        canvas.style.cursor = 'default';
    }
});


// --- Button Event Listeners ---
if (addBallButton) addBallButton.addEventListener('click', performAddBall);
if (launchBallButton) launchBallButton.addEventListener('click', performLaunchBall);
if (resetGameButton) resetGameButton.addEventListener('click', () => performResetGame(balls.length > 0 ? balls.length : 1));

// --- Game Initialization ---
function initGameObjects() {
    paddleTop = new Paddle(SCREEN_WIDTH / 2 - PADDLE_WIDTH / 2, 40, PADDLE_WIDTH, PADDLE_HEIGHT, GREEN, true);
    paddleBottom = new Paddle(SCREEN_WIDTH / 2 - PADDLE_WIDTH / 2, SCREEN_HEIGHT - 50, PADDLE_WIDTH, PADDLE_HEIGHT, BLUE, true);
    paddleLeft = new Paddle(40, SCREEN_HEIGHT / 2 - PADDLE_VERTICAL_HEIGHT / 2, PADDLE_VERTICAL_WIDTH, PADDLE_VERTICAL_HEIGHT, YELLOW, true);
    paddleRight = new Paddle(SCREEN_WIDTH - 50, SCREEN_HEIGHT / 2 - PADDLE_VERTICAL_HEIGHT / 2, PADDLE_VERTICAL_WIDTH, PADDLE_VERTICAL_HEIGHT, RED, true);
    paddles = [paddleTop, paddleBottom, paddleLeft, paddleRight];
    performResetGame(1);
    globalStartTime = performance.now();
}

// --- Game Loop Functions ---
function updateButtonStates() {
    const canInteract = !gameOver && !showHelp;
    if (addBallButton) addBallButton.disabled = !canInteract;
    if (launchBallButton) launchBallButton.disabled = !canInteract;
    if (resetGameButton) resetGameButton.disabled = false;
}

function updatePaddles(currentTime) {
    paddles.forEach(paddle => {
        if (paddle.isAI) {
            // --- AI Logic ---
            if (currentTime - paddle.lastAiRandomOffsetTime > 2000) {
                paddle.aiRandomOffset = Math.floor(Math.random() * 81) - 40;
                paddle.lastAiRandomOffsetTime = currentTime;
            }

            if (balls.length > 0) {
                let potentialTargets = [];
                if (paddle === paddleTop) potentialTargets = balls.filter(b => b.dy < 0);
                else if (paddle === paddleBottom) potentialTargets = balls.filter(b => b.dy > 0);
                else if (paddle === paddleLeft) potentialTargets = balls.filter(b => b.dx < 0);
                else if (paddle === paddleRight) potentialTargets = balls.filter(b => b.dx > 0);

                let targetBall;
                if (potentialTargets.length > 0) {
                    targetBall = potentialTargets.reduce((closest, current) =>
                        Math.hypot(current.x - paddle.rect.centerx, current.y - paddle.rect.centery) <
                        Math.hypot(closest.x - paddle.rect.centerx, closest.y - paddle.rect.centery) ? current : closest);
                } else {
                    targetBall = balls.reduce((closest, current) =>
                        Math.hypot(current.x - paddle.rect.centerx, current.y - paddle.rect.centery) <
                        Math.hypot(closest.x - paddle.rect.centerx, closest.y - paddle.rect.centery) ? current : closest);
                }
                
                if (paddle.width > paddle.height) { // Horizontal
                    const targetX = targetBall.x + paddle.aiRandomOffset;
                    if (targetX < paddle.rect.centerx) paddle.move(-paddle.speed, 0);
                    if (targetX > paddle.rect.centerx) paddle.move(paddle.speed, 0);
                } else { // Vertical
                    const targetY = targetBall.y + paddle.aiRandomOffset;
                    if (targetY < paddle.rect.centery) paddle.move(0, -paddle.speed);
                    if (targetY > paddle.rect.centery) paddle.move(0, paddle.speed);
                }
            }
        } else {
            // --- Manual Control Logic ---
            if (paddle === paddleTop) {
                if (keysPressed['KeyA']) paddle.move(-paddle.speed, 0);
                if (keysPressed['KeyD']) paddle.move(paddle.speed, 0);
            } else if (paddle === paddleBottom) {
                if (keysPressed['ArrowLeft']) paddle.move(-paddle.speed, 0);
                if (keysPressed['ArrowRight']) paddle.move(paddle.speed, 0);
            } else if (paddle === paddleLeft) {
                if (keysPressed['KeyH']) paddle.move(0, -paddle.speed); // H for Up
                if (keysPressed['KeyK']) paddle.move(0, paddle.speed);  // K for Down
            } else if (paddle === paddleRight) {
                if (keysPressed['Numpad4']) paddle.move(0, -paddle.speed); // Numpad 4 for Up
                if (keysPressed['Numpad6']) paddle.move(0, paddle.speed);  // Numpad 6 for Down
            }
        }
    });
}

function updateBalls() {
    // Ball speed control
    let ballSpeedChanged = false;
    if (keysPressed['ArrowUp']) {
        balls.forEach(ball => ball.speed = Math.min(ball.speed + 0.1, 20));
        ballSpeedChanged = true;
    }
    if (keysPressed['ArrowDown']) {
        balls.forEach(ball => ball.speed = Math.max(0.1, ball.speed - 0.1));
        ballSpeedChanged = true;
    }

    if (ballSpeedChanged && balls.length > 0) {
        balls.forEach(ball => {
            const angle = Math.atan2(ball.dy, ball.dx);
            if (ball.speed === 0) { ball.dx = 0; ball.dy = 0; }
            else {
                ball.dx = ball.speed * Math.cos(angle);
                ball.dy = ball.speed * Math.sin(angle);
            }
        });
        // Update paddle speed to match ball speed
        const baseSpeed = Math.max(0.1, balls[0].speed);
        paddles.forEach(p => p.speed = Math.max(1, PADDLE_SPEED_RATIO * baseSpeed));
    }

    // Ball movement and collisions
    const ballsToRemoveIndices = [];
    balls.forEach((ball, index) => {
        ball.move();
        const ballR = ball.rect;

        paddles.forEach(paddle => {
            if (checkCollision(ballR, paddle.rect)) {
                if (paddle === paddleBottom && ball.dy > 0) { ball.y = paddle.rect.top - ball.radius; handleBallPaddleCollision(ball, paddle); }
                else if (paddle === paddleTop && ball.dy < 0) { ball.y = paddle.rect.bottom + ball.radius; handleBallPaddleCollision(ball, paddle); }
                else if (paddle === paddleLeft && ball.dx < 0) { ball.x = paddle.rect.right + ball.radius; handleBallPaddleCollision(ball, paddle); }
                else if (paddle === paddleRight && ball.dx > 0) { ball.x = paddle.rect.left - ball.radius; handleBallPaddleCollision(ball, paddle); }
            }
        });

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

    for (let i = ballsToRemoveIndices.length - 1; i >= 0; i--) {
        balls.splice(ballsToRemoveIndices[i], 1);
        if (!gameOver) { balls.push(new Ball(SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2, BALL_RADIUS, WHITE)); }
    }
    if (balls.length === 0 && !gameOver) {
        balls.push(new Ball(SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2, BALL_RADIUS, WHITE));
    }
}

function update() {
    updateButtonStates();
    if (gameOver || showHelp) return;

    const currentTime = performance.now();
    updatePaddles(currentTime);
    updateBalls();
}

function drawHelpMenu() {
    ctx.fillStyle = HELP_BG_COLOR;
    ctx.fillRect(50, 50, SCREEN_WIDTH - 100, SCREEN_HEIGHT - 100);

    ctx.fillStyle = WHITE;
    ctx.font = `bold 24px ${FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.fillText("HELP & CONTROLS", SCREEN_WIDTH / 2, 90);

    ctx.textAlign = 'left';

    let yPos = 130;
    const xStart = 70;
    const xIndent = 90;

    // --- ABOUT Section ---
    ctx.font = `bold 18px ${FONT_FAMILY}`;
    ctx.fillText("ABOUT", xStart, yPos);
    yPos += 25;

    ctx.font = `italic 16px ${FONT_FAMILY}`;
    const aboutLines = [
        "A fast-paced, arcade-style browser game with four paddles defending all edges",
        "of the screen! Inspired by Pong, but now the ball can come from any direction."
    ];
    aboutLines.forEach(line => {
        ctx.fillText(line, xStart, yPos);
        yPos += 22;
    });
    yPos += 10;
    ctx.font = `16px ${FONT_FAMILY}`; // Reset font style

    // --- Intro text ---
    const introText = [
        "----------------------------------------------------------------",
        "Press a paddle's key to take control from the AI.",
        "A white square indicates a human-controlled paddle."
    ];
    introText.forEach(line => {
        ctx.fillText(line, xStart, yPos);
        yPos += 22;
    });
    yPos += 5;

    ctx.fillText("PLAYER CONTROLS:", xStart, yPos);
    yPos += 25;

    // --- Color-Coded Player Controls ---
    const controlLines = [
        { label: '• Top Paddle:   ', color: GREEN, controls: "'A' (left) and 'D' (right)" },
        { label: '• Bottom Paddle: ', color: BLUE, controls: "Left and Right Arrow keys" },
        { label: '• Left Paddle:  ', color: YELLOW, controls: "'H' (up) and 'K' (down)" },
        { label: '• Right Paddle: ', color: RED, controls: "Numpad 4 (up) and Numpad 6 (down)" }
    ];

    ctx.font = `bold 16px ${FONT_FAMILY}`; // Make controls stand out
    controlLines.forEach(line => {
        let currentX = xIndent;
        // Draw the colored part
        ctx.fillStyle = line.color;
        ctx.fillText(line.label, currentX, yPos);

        // Measure it and draw the white part right after
        currentX += ctx.measureText(line.label).width;
        ctx.fillStyle = WHITE;
        ctx.fillText(line.controls, currentX, yPos);
        
        yPos += 22;
    });
    ctx.font = `16px ${FONT_FAMILY}`; // Reset font style
    yPos += 5;

    // --- General Controls ---
    const generalText = [
        "----------------------------------------------------------------",
        "GENERAL CONTROLS:",
        "• Space Bar:          Launch ball from bottom paddle",
        "• Up/Down Arrows:     Increase/Decrease ball speed",
        "• N / Reset Button:   Reset game (all paddles become AI)",
        "• 1-5 Keys:           Reset game with 1 to 5 balls",
        "• F1 / Click Text:    Toggle this Help Menu",
        "----------------------------------------------------------------",
        "GOAL: Be the last paddle with lives remaining!",
    ];
    generalText.forEach(line => {
        ctx.fillText(line, xStart, yPos);
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
        ctx.fillText("Game Over!", SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 - FONT_SIZE);
        ctx.font = `${smallFontSize}px ${FONT_FAMILY}`;
        ctx.fillText("Press 'N' or Reset Button to restart.", SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2);
        ctx.textAlign = 'start';
    }

    if (balls.length > 0) {
        ctx.fillText(`Speed: ${balls[0].speed.toFixed(1)}`, 10, 10);
    } else {
        ctx.fillText(`Speed: N/A`, 10, 10);
    }

    const livesText = `Lives - Top:${paddleTop.lives} Bottom:${paddleBottom.lives} Left:${paddleLeft.lives} Right:${paddleRight.lives}`;
    ctx.textAlign = 'center';
    ctx.fillText(livesText, SCREEN_WIDTH / 2, 10);
    ctx.textAlign = 'start';

    // Draw and handle clickable help text
    const helpText = "Press F1 for Help";
    const helpTextY = SCREEN_HEIGHT - 25; // Y-position for the top of text
    const helpTextX = SCREEN_WIDTH - 10;   // X-position for the right edge
    const helpTextFontSize = 14;
    ctx.font = `${helpTextFontSize}px ${FONT_FAMILY}`;
    const helpTextMetrics = ctx.measureText(helpText);

    // Define the click area with padding.
    helpClickArea = {
        left: helpTextX - helpTextMetrics.width - 5,
        right: helpTextX + 5,
        top: helpTextY - 5,
        bottom: helpTextY + helpTextFontSize + 5
    };

    // Set style based on hover state
    ctx.fillStyle = isHoveringHelp ? YELLOW : WHITE; // Yellow for hover
    ctx.textAlign = 'right';
    ctx.fillText(helpText, helpTextX, helpTextY);

    // Draw underline on hover
    if (isHoveringHelp) {
        ctx.fillRect(helpTextX - helpTextMetrics.width, helpTextY + helpTextFontSize + 1, helpTextMetrics.width, 1);
    }
    
    ctx.textAlign = 'start'; // Reset alignment

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
