"use strict";

const canvas = document.getElementById("gameCanvas");
const context = canvas.getContext("2d");
const keysPressed = new Set();
const scoreElement = document.getElementById("score");
const highScoreElement = document.getElementById("highScore");
const livesElement = document.getElementById("lives");
const levelElement = document.getElementById("level");
const unlockedLevelElement = document.getElementById("unlockedLevel");
const pauseButton = document.getElementById("pauseButton");
const startButton = document.getElementById("startButton");
const powerUpToast = document.getElementById("powerUpToast");
const powerUpIcon = document.getElementById("powerUpIcon");
const powerUpName = document.getElementById("powerUpName");
const powerUpDescription = document.getElementById("powerUpDescription");
const levelCompleteScreen = document.getElementById("levelCompleteScreen");
const completedLevelElement = document.getElementById("completedLevel");
const completionPoints = document.getElementById("completionPoints");
const continueButton = document.getElementById("continueButton");
const progressStorageKey = "brickrush.highestUnlockedLevel";
const highScoreStorageKey = "brickrush.highScore";

const introLevelLayouts = [
    ["1111111", "1111111", "1111111", "1111111"],
    ["1010101", "1111111", "1010101", "1111111"],
    ["1111111", "1000001", "1111111", "1000001", "1111111"],
    ["0011100", "0111110", "1111111", "0111110", "0011100"],
    ["1111111", "0111110", "0011100", "0111110", "1111111"],
    ["1011101", "1111111", "1100011", "1111111", "1011101"],
    ["1000001", "1100011", "1110111", "0111110", "0011100"],
    ["1111111", "1100011", "1000001", "1100011", "1111111"],
    ["1010101", "0101010", "1111111", "0101010", "1010101"],
    ["1111111", "1111111", "1111111", "1111111", "1111111", "1111111"]
];

const brickColors = ["#ff6b6b", "#ff9f43", "#feca57", "#48dbfb", "#5f9df7", "#a66cff"];
const powerUpDropChance = 0.12;
const powerUpTypes = [
    { type: "wide", weight: 3, symbol: "W", icon: "↔", name: "WIDE PADDLE!", description: "PADDLE BOOST · 10 SEC", color: "#66e3c4" },
    { type: "multi", weight: 3, symbol: "3", icon: "●", name: "MULTI-BALL!", description: "+2 EXTRA BALLS", color: "#a66cff" },
    { type: "life", weight: 1, symbol: "+1", icon: "♥", name: "EXTRA LIFE!", description: "ONE MORE CHANCE", color: "#ff8178" },
    { type: "slow", weight: 3, symbol: "S", icon: "❄", name: "SLOW BALL!", description: "EASIER CATCHES · 8 SEC", color: "#48dbfb" }
];

function loadHighestUnlockedLevel() {
    try {
        const savedLevel = Number(window.localStorage.getItem(progressStorageKey));
        return Number.isSafeInteger(savedLevel) && savedLevel >= 1 ? savedLevel : 1;
    } catch {
        return 1;
    }
}

function loadHighScore() {
    try {
        const savedScore = Number(window.localStorage.getItem(highScoreStorageKey));
        return Number.isSafeInteger(savedScore) && savedScore >= 0 ? savedScore : 0;
    } catch {
        return 0;
    }
}

const game = {
    score: 0,
    highScore: loadHighScore(),
    lives: 3,
    level: 1,
    levelScoreStart: 0,
    highestUnlockedLevel: loadHighestUnlockedLevel(),
    isPaused: false,
    levelComplete: false,
    isOver: false,
    hasWon: false,
    widePaddleSeconds: 0,
    slowBallSeconds: 0,
    toastSeconds: 0
};

const paddle = {
    width: 100,
    normalWidth: 100,
    height: 12,
    x: (canvas.width - 100) / 2,
    y: canvas.height - 28,
    speed: 420
};

function createBall(x = canvas.width / 2, y = canvas.height / 2, velocityX = 190, velocityY = -170) {
    return { x, y, radius: 8, velocityX, velocityY };
}

const balls = [createBall()];
const powerUps = [];

const bricks = [];
const brickWidth = 68;
const brickHeight = 20;
const brickGap = 8;

let previousTimestamp = null;

function init() {
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleWindowBlur);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    canvas.addEventListener("pointerdown", handlePointerMove);
    canvas.addEventListener("pointermove", handlePointerMove);
    canvas.addEventListener("pointerdown", () => canvas.focus({ preventScroll: true }));
    pauseButton.addEventListener("click", togglePause);
    startButton.addEventListener("click", resetGame);
    continueButton.addEventListener("click", startNextLevel);

    loadLevel(game.level);
    updateHud();
    window.requestAnimationFrame(gameLoop);
}

function handleKeyDown(event) {
    if (event.key.toLowerCase() === "p" || event.key === "Escape") {
        event.preventDefault();
        if (!event.repeat) {
            togglePause();
        }
        return;
    }

    if (game.isPaused) {
        return;
    }

    if (["ArrowLeft", "ArrowRight", "a", "d", "A", "D"].includes(event.key)) {
        event.preventDefault();
        keysPressed.add(event.key.toLowerCase());
    }
}

function handleKeyUp(event) {
    keysPressed.delete(event.key.toLowerCase());
}

function handleWindowBlur() {
    keysPressed.clear();
    pauseGame();
}

function handleVisibilityChange() {
    if (document.hidden) {
        pauseGame();
    }
}

function pauseGame() {
    if (!game.isOver && !game.levelComplete) {
        setPaused(true);
    }
}

function togglePause() {
    if (!game.isOver && !game.levelComplete) {
        setPaused(!game.isPaused);
    }
}

function setPaused(isPaused) {
    game.isPaused = isPaused;
    keysPressed.clear();
    pauseButton.textContent = isPaused ? "Resume" : "Pause";
    pauseButton.setAttribute("aria-pressed", String(isPaused));
}

function handlePointerMove(event) {
    const bounds = canvas.getBoundingClientRect();
    const contentWidth = bounds.width - canvas.clientLeft * 2;
    const pointerX = (event.clientX - bounds.left - canvas.clientLeft) * canvas.width / contentWidth;
    paddle.x = clamp(pointerX - paddle.width / 2, 0, canvas.width - paddle.width);
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function loadLevel(levelNumber) {
    bricks.length = 0;
    const layout = generateLevelLayout(levelNumber);
    const layoutWidth = layout[0].length * brickWidth + (layout[0].length - 1) * brickGap;
    const startX = (canvas.width - layoutWidth) / 2;

    layout.forEach((row, rowIndex) => {
        [...row].forEach((cell, columnIndex) => {
            if (cell === "1") {
                bricks.push({
                    x: startX + columnIndex * (brickWidth + brickGap),
                    y: 42 + rowIndex * (brickHeight + brickGap),
                    width: brickWidth,
                    height: brickHeight,
                    color: brickColors[rowIndex % brickColors.length],
                    active: true
                });
            }
        });
    });
}

function generateLevelLayout(levelNumber) {
    if (levelNumber <= introLevelLayouts.length) {
        return introLevelLayouts[levelNumber - 1];
    }

    const rowCount = Math.min(5 + Math.floor((levelNumber - 11) / 4), 6);
    const density = Math.min(0.52 + (levelNumber - 11) * 0.025, 0.82);
    const modulus = 2147483647;
    let randomState = (levelNumber % modulus * 48271) % modulus;
    const random = () => {
        randomState = (randomState * 48271) % modulus;
        return randomState / modulus;
    };

    return Array.from({ length: rowCount }, () => {
        const cells = Array(7).fill("0");
        for (let column = 0; column < 4; column++) {
            const brick = random() < density ? "1" : "0";
            cells[column] = brick;
            cells[6 - column] = brick;
        }
        if (cells.every(cell => cell === "0")) {
            cells[3] = "1";
        }
        return cells.join("");
    });
}

function resolveBallRectCollision(movingBall, rect) {
    const closestX = clamp(movingBall.x, rect.x, rect.x + rect.width);
    const closestY = clamp(movingBall.y, rect.y, rect.y + rect.height);
    let normalX = movingBall.x - closestX;
    let normalY = movingBall.y - closestY;
    let distance = Math.hypot(normalX, normalY);

    if (distance >= movingBall.radius) {
        return null;
    }

    if (distance === 0) {
        const distances = [
            { distance: movingBall.x - rect.x, x: -1, y: 0 },
            { distance: rect.x + rect.width - movingBall.x, x: 1, y: 0 },
            { distance: movingBall.y - rect.y, x: 0, y: -1 },
            { distance: rect.y + rect.height - movingBall.y, x: 0, y: 1 }
        ];
        const nearestSide = distances.reduce((nearest, side) => side.distance < nearest.distance ? side : nearest);
        normalX = nearestSide.x;
        normalY = nearestSide.y;
        distance = 0;
    } else {
        normalX /= distance;
        normalY /= distance;
    }

    const overlap = movingBall.radius - distance;
    movingBall.x += normalX * overlap;
    movingBall.y += normalY * overlap;

    const velocityIntoSurface = movingBall.velocityX * normalX + movingBall.velocityY * normalY;
    if (velocityIntoSurface < 0) {
        movingBall.velocityX -= 2 * velocityIntoSurface * normalX;
        movingBall.velocityY -= 2 * velocityIntoSurface * normalY;
    }

    return { normalX, normalY };
}

function update(deltaTime) {
    if (game.isOver || game.isPaused || game.levelComplete) {
        return;
    }

    updatePowerUpTimers(deltaTime);
    updatePowerUpToast(deltaTime);

    const movingLeft = keysPressed.has("arrowleft") || keysPressed.has("a");
    const movingRight = keysPressed.has("arrowright") || keysPressed.has("d");

    if (movingLeft !== movingRight) {
        const direction = movingRight ? 1 : -1;
        paddle.x = clamp(paddle.x + direction * paddle.speed * deltaTime, 0, canvas.width - paddle.width);
    }

    const ballDeltaTime = deltaTime * (game.slowBallSeconds > 0 ? 0.65 : 1);
    for (let ballIndex = balls.length - 1; ballIndex >= 0; ballIndex--) {
        const movingBall = balls[ballIndex];
        movingBall.x += movingBall.velocityX * ballDeltaTime;
        movingBall.y += movingBall.velocityY * ballDeltaTime;

        if (movingBall.x - movingBall.radius < 0) {
            movingBall.velocityX = Math.abs(movingBall.velocityX);
            movingBall.x = clamp(movingBall.x, movingBall.radius, canvas.width - movingBall.radius);
        } else if (movingBall.x + movingBall.radius > canvas.width) {
            movingBall.velocityX = -Math.abs(movingBall.velocityX);
            movingBall.x = clamp(movingBall.x, movingBall.radius, canvas.width - movingBall.radius);
        }
        if (movingBall.y - movingBall.radius < 0) {
            movingBall.velocityY = Math.abs(movingBall.velocityY);
            movingBall.y = movingBall.radius;
        }

        const paddleHit = movingBall.velocityY > 0 ? resolveBallRectCollision(movingBall, paddle) : null;
        if (paddleHit && paddleHit.normalY < -0.25) {
            const hitPosition = clamp(
                (movingBall.x - (paddle.x + paddle.width / 2)) / (paddle.width / 2),
                -1,
                1
            );
            const speed = Math.hypot(movingBall.velocityX, movingBall.velocityY);
            const bounceAngle = hitPosition * Math.PI / 3;
            movingBall.y = paddle.y - movingBall.radius;
            movingBall.velocityX = speed * Math.sin(bounceAngle);
            movingBall.velocityY = -speed * Math.cos(bounceAngle);
        }

        for (const brick of bricks) {
            if (!brick.active) {
                continue;
            }

            if (resolveBallRectCollision(movingBall, brick)) {
                brick.active = false;
                game.score += 10;
                if (game.score > game.highScore) {
                    game.highScore = game.score;
                    try {
                        window.localStorage.setItem(highScoreStorageKey, String(game.highScore));
                    } catch {
                        // The game remains playable when browser storage is unavailable.
                    }
                }
                spawnPowerUp(brick);
                updateHud();
                break;
            }
        }

        if (movingBall.y - movingBall.radius > canvas.height) {
            balls.splice(ballIndex, 1);
        }
    }

    if (balls.length === 0) {
        game.lives -= 1;
        updateHud();

        if (game.lives <= 0) {
            game.isOver = true;
            startButton.textContent = "Restart";
        } else {
            resetBall();
        }
    }

    updatePowerUps(deltaTime);

    if (!game.isOver && bricks.every(brick => !brick.active) && powerUps.length === 0) {
        showLevelComplete();
    }
}

function updatePowerUpTimers(deltaTime) {
    if (game.widePaddleSeconds > 0) {
        game.widePaddleSeconds = Math.max(0, game.widePaddleSeconds - deltaTime);
        if (game.widePaddleSeconds === 0) {
            resizePaddleForEffect();
        }
    }
    if (game.slowBallSeconds > 0) {
        game.slowBallSeconds = Math.max(0, game.slowBallSeconds - deltaTime);
    }
}

function updatePowerUpToast(deltaTime) {
    if (game.toastSeconds > 0) {
        game.toastSeconds = Math.max(0, game.toastSeconds - deltaTime);
        if (game.toastSeconds === 0) {
            powerUpToast.classList.remove("is-visible");
            powerUpToast.hidden = true;
        }
    }
}

function spawnPowerUp(brick) {
    if (Math.random() >= powerUpDropChance) {
        return false;
    }

    const definition = choosePowerUpType(Math.random());
    powerUps.push({
        x: brick.x + brick.width / 2,
        y: brick.y + brick.height / 2,
        size: 28,
        speed: 125,
        ...definition
    });
    return true;
}

function choosePowerUpType(randomValue) {
    const totalWeight = powerUpTypes.reduce((total, powerUp) => total + powerUp.weight, 0);
    let selection = randomValue * totalWeight;

    for (const powerUp of powerUpTypes) {
        selection -= powerUp.weight;
        if (selection < 0) {
            return powerUp;
        }
    }

    return powerUpTypes[powerUpTypes.length - 1];
}

function updatePowerUps(deltaTime) {
    for (let index = powerUps.length - 1; index >= 0; index--) {
        const powerUp = powerUps[index];
        powerUp.y += powerUp.speed * deltaTime;

        const caught = powerUp.x + powerUp.size / 2 > paddle.x
            && powerUp.x - powerUp.size / 2 < paddle.x + paddle.width
            && powerUp.y + powerUp.size / 2 > paddle.y
            && powerUp.y - powerUp.size / 2 < paddle.y + paddle.height;

        if (caught) {
            applyPowerUp(powerUp);
            powerUps.splice(index, 1);
        } else if (powerUp.y - powerUp.size / 2 > canvas.height) {
            powerUps.splice(index, 1);
        }
    }
}

function applyPowerUp(powerUp) {
    if (powerUp.type === "wide") {
        game.widePaddleSeconds = 10;
        resizePaddleForEffect();
    } else if (powerUp.type === "multi") {
        const sourceBall = balls[0] || createBall();
        const speed = Math.hypot(sourceBall.velocityX, sourceBall.velocityY);
        for (const angleOffset of [-0.42, 0.42]) {
            if (balls.length >= 7) {
                break;
            }
            const angle = Math.atan2(sourceBall.velocityY, sourceBall.velocityX) + angleOffset;
            balls.push(createBall(
                sourceBall.x + Math.cos(angle) * sourceBall.radius * 2,
                sourceBall.y + Math.sin(angle) * sourceBall.radius * 2,
                Math.cos(angle) * speed,
                Math.sin(angle) * speed
            ));
        }
    } else if (powerUp.type === "life") {
        game.lives = Math.min(game.lives + 1, 9);
        updateHud();
    } else if (powerUp.type === "slow") {
        game.slowBallSeconds = 8;
    }

    powerUpIcon.textContent = powerUp.icon;
    powerUpName.textContent = powerUp.name;
    powerUpDescription.textContent = powerUp.description;
    powerUpToast.style.setProperty("--powerup-color", powerUp.color);
    powerUpToast.hidden = false;
    powerUpToast.classList.remove("is-visible");
    void powerUpToast.offsetWidth;
    powerUpToast.classList.add("is-visible");
    game.toastSeconds = 2.2;
}

function resizePaddleForEffect() {
    const previousWidth = paddle.width;
    paddle.width = game.widePaddleSeconds > 0
        ? Math.min(paddle.normalWidth * 1.5, canvas.width)
        : paddle.normalWidth;
    paddle.x = clamp(paddle.x - (paddle.width - previousWidth) / 2, 0, canvas.width - paddle.width);
}

function resetBall() {
    balls.length = 0;
    const speedScale = Math.min(1 + (game.level - 1) * 0.07, 1.8);
    paddle.normalWidth = Math.max(72, 100 - (game.level - 1) * 2);
    paddle.width = game.widePaddleSeconds > 0 ? paddle.normalWidth * 1.5 : paddle.normalWidth;
    paddle.x = (canvas.width - paddle.width) / 2;
    balls.push(createBall(canvas.width / 2, canvas.height / 2, 190 * speedScale, -170 * speedScale));
}

function showLevelComplete() {
    game.levelComplete = true;
    const nextLevel = game.level + 1;
    completedLevelElement.textContent = `LEVEL ${String(game.level).padStart(2, "0")}`;
    completionPoints.textContent = `+${String(game.score - game.levelScoreStart).padStart(3, "0")} POINTS`;
    continueButton.textContent = `NEXT LEVEL ${String(nextLevel).padStart(2, "0")}`;
    levelCompleteScreen.hidden = false;
    pauseButton.disabled = true;

    if (nextLevel > game.highestUnlockedLevel) {
        game.highestUnlockedLevel = nextLevel;
        try {
            window.localStorage.setItem(progressStorageKey, String(game.highestUnlockedLevel));
        } catch {
            // The game remains playable when browser storage is unavailable.
        }
    }

    updateHud();
    continueButton.focus({ preventScroll: true });
}

function startNextLevel() {
    if (!game.levelComplete) {
        return;
    }

    game.level += 1;
    game.levelScoreStart = game.score;
    game.levelComplete = false;
    game.isPaused = false;
    powerUps.length = 0;
    levelCompleteScreen.hidden = true;
    pauseButton.disabled = false;
    setPaused(false);
    loadLevel(game.level);
    resetBall();
    updateHud();
    canvas.focus({ preventScroll: true });
}

function resetGame() {
    game.score = 0;
    game.lives = 3;
    game.level = 1;
    game.levelScoreStart = 0;
    game.isPaused = false;
    game.levelComplete = false;
    game.isOver = false;
    game.widePaddleSeconds = 0;
    game.slowBallSeconds = 0;
    game.toastSeconds = 0;
    powerUps.length = 0;
    powerUpToast.classList.remove("is-visible");
    powerUpToast.hidden = true;
    levelCompleteScreen.hidden = true;
    pauseButton.disabled = false;
    setPaused(false);
    startButton.textContent = "Start Game";

    loadLevel(game.level);
    resetBall();
    updateHud();
}

function updateHud() {
    scoreElement.textContent = game.score.toLocaleString("en-US", { minimumIntegerDigits: 6 });
    highScoreElement.textContent = game.highScore.toLocaleString("en-US", { minimumIntegerDigits: 6 });
    livesElement.textContent = String(game.lives).padStart(2, "0");
    levelElement.textContent = String(game.level).padStart(2, "0");
    unlockedLevelElement.textContent = String(game.highestUnlockedLevel).padStart(2, "0");
}

function draw() {
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#101b1e";
    context.fillRect(0, 0, canvas.width, canvas.height);

    context.beginPath();
    context.strokeStyle = "rgba(168, 219, 202, 0.055)";
    context.lineWidth = 1;
    for (let x = 30; x < canvas.width; x += 30) {
        context.moveTo(x, 0);
        context.lineTo(x, canvas.height);
    }
    for (let y = 30; y < canvas.height; y += 30) {
        context.moveTo(0, y);
        context.lineTo(canvas.width, y);
    }
    context.stroke();

    for (const brick of bricks) {
        if (brick.active) {
            context.save();
            context.beginPath();
            context.roundRect(brick.x, brick.y, brick.width, brick.height, 5);
            context.fillStyle = brick.color;
            context.shadowColor = brick.color;
            context.shadowBlur = 7;
            context.fill();
            context.shadowBlur = 0;
            context.strokeStyle = "rgba(255, 255, 255, 0.38)";
            context.lineWidth = 1;
            context.stroke();

            context.beginPath();
            context.roundRect(brick.x + 3, brick.y + 2, brick.width - 6, 3, 2);
            context.fillStyle = "rgba(255, 255, 255, 0.28)";
            context.fill();
            context.restore();
        }
    }

    for (const powerUp of powerUps) {
        context.save();
        context.beginPath();
        context.arc(powerUp.x, powerUp.y, powerUp.size / 2, 0, Math.PI * 2);
        context.fillStyle = powerUp.color;
        context.shadowColor = powerUp.color;
        context.shadowBlur = 12;
        context.fill();
        context.shadowBlur = 0;
        context.strokeStyle = "rgba(255, 255, 255, 0.8)";
        context.lineWidth = 1.5;
        context.stroke();
        context.fillStyle = "#111a1c";
        context.font = "bold 12px 'Lucida Console', monospace";
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText(powerUp.symbol, powerUp.x, powerUp.y + 1);
        context.restore();
    }

    context.save();
    context.beginPath();
    context.roundRect(paddle.x, paddle.y, paddle.width, paddle.height, 6);
    const paddleFill = context.createLinearGradient(0, paddle.y, 0, paddle.y + paddle.height);
    paddleFill.addColorStop(0, "#91f2d7");
    paddleFill.addColorStop(1, "#42b99e");
    context.fillStyle = paddleFill;
    context.shadowColor = "rgba(102, 227, 196, 0.45)";
    context.shadowBlur = 12;
    context.fill();
    context.restore();

    for (const movingBall of balls) {
        context.save();
        context.beginPath();
        context.arc(movingBall.x, movingBall.y, movingBall.radius, 0, Math.PI * 2);
        context.fillStyle = "#ffcf5a";
        context.shadowColor = "rgba(255, 207, 90, 0.8)";
        context.shadowBlur = 14;
        context.fill();
        context.restore();
    }

    if (game.isPaused || game.isOver) {
        context.fillStyle = "rgba(0, 0, 0, 0.65)";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = "#ffffff";
        context.font = "bold 32px sans-serif";
        context.textAlign = "center";
        context.fillText(game.isPaused ? "PAUSED" : "Game Over", canvas.width / 2, canvas.height / 2);
    }
}

function gameLoop(timestamp) {
    const deltaTime = previousTimestamp === null
        ? 0
        : Math.min((timestamp - previousTimestamp) / 1000, 0.05);
    previousTimestamp = timestamp;

    update(deltaTime);
    draw();
    window.requestAnimationFrame(gameLoop);
}

window.addEventListener("load", init, { once: true });
