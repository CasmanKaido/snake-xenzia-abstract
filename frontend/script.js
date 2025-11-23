const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('currentScore');
const userHighScoreElement = document.getElementById('userHighScore');
const globalTopScoreElement = document.getElementById('globalTopScore');
const connectBtn = document.getElementById('connectBtn');
const startBtn = document.getElementById('startBtn');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlayTitle');
const statusMessage = document.getElementById('statusMessage');

// Game Constants
const GRID_SIZE = 20;
const TILE_COUNT = canvas.width / GRID_SIZE;
const GAME_SPEED = 100; // ms

// Game State
let score = 0;
let snake = [];
let food = { x: 0, y: 0 };
let dx = 0;
let dy = 0;
let gameInterval;
let isGameRunning = false;

// Web3 State
let provider;
let signer;
let contract;
let userAddress;

// REPLACE THIS WITH YOUR DEPLOYED CONTRACT ADDRESS
const CONTRACT_ADDRESS = "0x0000000000000000000000000000000000000000";

const CONTRACT_ABI = [
    "function submitScore(uint256 _score) external",
    "function getHighScore(address _player) external view returns (uint256)",
    "function topScore() external view returns (address, uint256, uint256)",
    "event NewHighScore(address indexed player, uint256 score)"
];

// Initialize
function init() {
    resetGame();
    document.addEventListener('keydown', handleInput);
    startBtn.addEventListener('click', startGame);
    connectBtn.addEventListener('click', connectWallet);

    // Check if wallet is already connected
    if (window.ethereum && window.ethereum.selectedAddress) {
        connectWallet();
    }
}

function resetGame() {
    snake = [{ x: 10, y: 10 }];
    dx = 0;
    dy = 0;
    score = 0;
    scoreElement.textContent = score;
    placeFood();
}

function startGame() {
    if (isGameRunning) return;

    resetGame();
    isGameRunning = true;
    overlay.classList.add('hidden');
    dx = 1; // Start moving right
    dy = 0;

    if (gameInterval) clearInterval(gameInterval);
    gameInterval = setInterval(gameLoop, GAME_SPEED);
}

function gameOver() {
    isGameRunning = false;
    clearInterval(gameInterval);
    overlayTitle.textContent = `Game Over! Score: ${score}`;
    startBtn.textContent = "Play Again";
    overlay.classList.remove('hidden');

    if (signer && contract) {
        submitScoreToChain(score);
    }
}

function gameLoop() {
    moveSnake();
    if (checkCollision()) {
        gameOver();
        return;
    }
    checkFood();
    draw();
}

function moveSnake() {
    const head = { x: snake[0].x + dx, y: snake[0].y + dy };
    snake.unshift(head);
    snake.pop();
}

function checkCollision() {
    const head = snake[0];

    // Wall collision
    if (head.x < 0 || head.x >= TILE_COUNT || head.y < 0 || head.y >= TILE_COUNT) {
        return true;
    }

    // Self collision
    for (let i = 1; i < snake.length; i++) {
        if (head.x === snake[i].x && head.y === snake[i].y) {
            return true;
        }
    }

    return false;
}

function checkFood() {
    const head = snake[0];
    if (head.x === food.x && head.y === food.y) {
        score += 10;
        scoreElement.textContent = score;
        // Grow snake
        snake.push({ ...snake[snake.length - 1] });
        placeFood();
    }
}

function placeFood() {
    food = {
        x: Math.floor(Math.random() * TILE_COUNT),
        y: Math.floor(Math.random() * TILE_COUNT)
    };
    // Ensure food doesn't spawn on snake
    for (let part of snake) {
        if (part.x === food.x && part.y === food.y) {
            placeFood();
            return;
        }
    }
}

function handleInput(e) {
    if (!isGameRunning) return;

    switch (e.key) {
        case 'ArrowUp':
            if (dy === 1) return;
            dx = 0; dy = -1;
            break;
        case 'ArrowDown':
            if (dy === -1) return;
            dx = 0; dy = 1;
            break;
        case 'ArrowLeft':
            if (dx === 1) return;
            dx = -1; dy = 0;
            break;
        case 'ArrowRight':
            if (dx === -1) return;
            dx = 1; dy = 0;
            break;
    }
}

function draw() {
    // Clear canvas
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw Snake
    ctx.fillStyle = '#22c55e';
    snake.forEach((part, index) => {
        // Head is slightly different color
        if (index === 0) ctx.fillStyle = '#4ade80';
        else ctx.fillStyle = '#22c55e';

        ctx.fillRect(part.x * GRID_SIZE, part.y * GRID_SIZE, GRID_SIZE - 2, GRID_SIZE - 2);
    });

    // Draw Food
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(food.x * GRID_SIZE, food.y * GRID_SIZE, GRID_SIZE - 2, GRID_SIZE - 2);
}

// Web3 Functions
async function connectWallet() {
    if (typeof window.ethereum !== 'undefined') {
        try {
            provider = new ethers.BrowserProvider(window.ethereum);
            signer = await provider.getSigner();
            userAddress = await signer.getAddress();

            connectBtn.textContent = `${userAddress.slice(0, 6)}...${userAddress.slice(-4)}`;
            statusMessage.textContent = "Wallet Connected";

            // Initialize contract
            if (CONTRACT_ADDRESS !== "0x0000000000000000000000000000000000000000") {
                contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
                fetchScores();
            } else {
                statusMessage.textContent = "Contract address not set in script.js";
            }

        } catch (error) {
            console.error("User rejected request", error);
            statusMessage.textContent = "Connection Failed";
        }
    } else {
        statusMessage.textContent = "Please install Metamask!";
    }
}

async function fetchScores() {
    if (!contract) return;
    try {
        const userHigh = await contract.getHighScore(userAddress);
        userHighScoreElement.textContent = userHigh.toString();

        const top = await contract.topScore();
        // top is a struct/tuple: [player, score, timestamp]
        globalTopScoreElement.textContent = top[1].toString();
    } catch (err) {
        console.error("Error fetching scores:", err);
    }
}

async function submitScoreToChain(finalScore) {
    if (!contract) {
        statusMessage.textContent = "Contract not connected. Score not saved to chain.";
        return;
    }

    // Only submit if it's a decent score to save gas, or check against local high score
    // For now, let's just try to submit
    try {
        statusMessage.textContent = "Submitting score to Abstract Chain...";
        const tx = await contract.submitScore(finalScore);
        statusMessage.textContent = "Transaction sent. Waiting for confirmation...";
        await tx.wait();
        statusMessage.textContent = "Score saved on-chain!";
        fetchScores();
    } catch (err) {
        console.error("Error submitting score:", err);
        statusMessage.textContent = "Failed to submit score.";
    }
}

init();
