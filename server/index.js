const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Allow all origins for now
        methods: ["GET", "POST"]
    }
});

const GRID_SIZE = 25;
const CANVAS_SIZE = 500;
const TILE_COUNT = CANVAS_SIZE / GRID_SIZE;

// Game State Storage
const games = {};

function createGame(gameId) {
    games[gameId] = {
        id: gameId,
        players: {}, // socketId -> player data
        food: spawnFood(),
        status: 'waiting', // waiting, playing, finished
        winner: null,
        timer: null
    };
}

function spawnFood() {
    return {
        x: Math.floor(Math.random() * TILE_COUNT),
        y: Math.floor(Math.random() * TILE_COUNT)
    };
}

function resetPlayer(socketId, isHost) {
    return {
        id: socketId,
        x: isHost ? 5 : TILE_COUNT - 6,
        y: isHost ? 5 : TILE_COUNT - 6,
        body: isHost ? [{ x: 5, y: 5 }] : [{ x: TILE_COUNT - 6, y: TILE_COUNT - 6 }],
        direction: isHost ? { x: 1, y: 0 } : { x: -1, y: 0 },
        score: 0,
        color: isHost ? '#ccff00' : '#00ccff', // Host: Green, Challenger: Blue
        alive: true
    };
}

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('joinGame', ({ gameId, isHost }) => {
        console.log(`User ${socket.id} joining game ${gameId} as ${isHost ? 'Host' : 'Challenger'}`);

        if (!games[gameId]) {
            createGame(gameId);
        }

        const game = games[gameId];

        // Add player
        game.players[socket.id] = resetPlayer(socket.id, isHost);
        socket.join(gameId);

        // Check if ready to start
        const playerCount = Object.keys(game.players).length;
        if (playerCount === 2) {
            game.status = 'countdown';
            // Start Countdown
            let count = 3;
            io.to(gameId).emit('countdown', { count });

            const countdownInterval = setInterval(() => {
                count--;
                if (count > 0) {
                    io.to(gameId).emit('countdown', { count });
                } else {
                    clearInterval(countdownInterval);
                    game.status = 'playing';
                    io.to(gameId).emit('gameStart', { message: 'GO!' });
                    startGameLoop(gameId);
                }
            }, 1000);
        } else {
            io.to(gameId).emit('waitingForOpponent');
        }
    });

    socket.on('input', ({ gameId, direction }) => {
        const game = games[gameId];
        if (!game || game.status !== 'playing' || !game.players[socket.id]) return;

        const player = game.players[socket.id];
        // Prevent 180 degree turns
        if (player.direction.x + direction.x === 0 && player.direction.y + direction.y === 0) return;

        player.direction = direction;
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        // Handle disconnect (maybe forfeit?)
        // For now, just remove from games
        for (const gameId in games) {
            if (games[gameId].players[socket.id]) {
                delete games[gameId].players[socket.id];
                if (Object.keys(games[gameId].players).length < 2) {
                    games[gameId].status = 'finished';
                    clearInterval(games[gameId].timer);
                    io.to(gameId).emit('playerDisconnected');
                }
            }
        }
    });
});

function startGameLoop(gameId) {
    const game = games[gameId];
    if (game.timer) clearInterval(game.timer);

    game.timer = setInterval(() => {
        if (game.status !== 'playing') return;

        const playerIds = Object.keys(game.players);
        const p1 = game.players[playerIds[0]];
        const p2 = game.players[playerIds[1]];

        // Move Players
        [p1, p2].forEach(p => {
            if (!p.alive) return;
            const head = { x: p.x + p.direction.x, y: p.y + p.direction.y };

            // Wall Collision
            if (head.x < 0 || head.x >= TILE_COUNT || head.y < 0 || head.y >= TILE_COUNT) {
                p.alive = false;
            }

            // Self Collision
            if (p.body.some(s => s.x === head.x && s.y === head.y)) {
                p.alive = false;
            }

            p.x = head.x;
            p.y = head.y;
            p.body.unshift(head);
        });

        // Check Enemy Collision (Head to Body)
        if (p1.alive && p2.body.some(s => s.x === p1.x && s.y === p1.y)) p1.alive = false;
        if (p2.alive && p1.body.some(s => s.x === p2.x && s.y === p2.y)) p2.alive = false;

        // Check Head-to-Head
        if (p1.alive && p2.alive && p1.x === p2.x && p1.y === p2.y) {
            p1.alive = false;
            p2.alive = false;
        }

        // Check Food
        [p1, p2].forEach(p => {
            if (!p.alive) return;
            if (p.x === game.food.x && p.y === game.food.y) {
                p.score += 10;
                game.food = spawnFood();
                // Don't pop tail (grow)
            } else {
                p.body.pop();
            }
        });

        // Check Game Over
        if (!p1.alive || !p2.alive) {
            game.status = 'finished';
            clearInterval(game.timer);

            let winnerId = null;
            if (!p1.alive && !p2.alive) winnerId = 'draw';
            else if (!p1.alive) winnerId = p2.id;
            else if (!p2.alive) winnerId = p1.id;

            io.to(gameId).emit('gameOver', {
                winnerId,
                scores: { [p1.id]: p1.score, [p2.id]: p2.score }
            });
        }

        // Emit State
        io.to(gameId).emit('gameState', {
            players: game.players,
            food: game.food
        });

    }, 100); // 100ms tick
}

const PORT = 3001;
server.listen(PORT, () => {
    console.log(`Snake Server running on port ${PORT}`);
});
