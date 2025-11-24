import { useState, useEffect, useRef } from 'react';
import { useLoginWithAbstract, useCreateSession, useAbstractClient } from '@abstract-foundation/agw-react';
import { toSessionClient } from '@abstract-foundation/agw-client/sessions';
import { useAccount, useReadContract, useWriteContract } from 'wagmi';
import { parseAbi, toFunctionSelector, parseEther } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { LimitType } from '@abstract-foundation/agw-client/sessions';
import { io } from 'socket.io-client';

// ---------- Constants ----------
const GRID_SIZE = 25;
const INITIAL_GAME_SPEED = 200; // Start very slow (was 150ms)
const MIN_GAME_SPEED = 70; // Fastest possible speed
const SPEED_INCREASE_INTERVAL = 50; // Increase speed every 50 points
const CANVAS_SIZE = 500;
const TILE_COUNT = CANVAS_SIZE / GRID_SIZE;
const CONTRACT_ADDRESS = '0xf185fDc10d0d64082A9318c794f172740ddDe18c';
const WAGER_CONTRACT_ADDRESS = '0x39A0e3dF4a31d6B1A63F798925bd0aB471EaCEc2';

const CONTRACT_ABI = parseAbi([
    'function submitScore(uint256 _score) external',
    'function getHighScore(address _player) external view returns (uint256)',
    'function topScore() external view returns (address, uint256, uint256)',
    'event NewHighScore(address indexed player, uint256 score)'
]);

const WAGER_ABI = parseAbi([
    'function createGame() external payable',
    'function joinGame(uint256 _gameId) external payable',
    'function submitMatchScore(uint256 _gameId, uint256 _score) external',
    'function getActiveGames() external view returns ((address host, address challenger, uint256 wagerAmount, address winner, bool isActive, bool isFinished, uint256 hostScore, uint256 challengerScore, bool hostSubmitted, bool challengerSubmitted)[], uint256[])',
    'event GameCreated(uint256 indexed gameId, address indexed host, uint256 wagerAmount)',
    'event GameJoined(uint256 indexed gameId, address indexed challenger)',
    'event ScoreSubmitted(uint256 indexed gameId, address indexed player, uint256 score)',
    'event GameFinished(uint256 indexed gameId, address indexed winner, uint256 payout)'
]);

const Home = () => {
    const { address, isConnected } = useAccount();
    const { login } = useLoginWithAbstract();
    const { createSessionAsync } = useCreateSession();
    const { data: agwClient } = useAbstractClient();
    const { writeContractAsync } = useWriteContract();

    const [wagerAmount, setWagerAmount] = useState('0.001');
    const [isDemoMode, setIsDemoMode] = useState(false);
    const [score, setScore] = useState(0);
    const [currentSpeed, setCurrentSpeed] = useState(INITIAL_GAME_SPEED);
    const [isGameRunning, setIsGameRunning] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [gameOver, setGameOver] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [sessionKey, setSessionKey] = useState(null);
    const [hasSession, setHasSession] = useState(false);
    const [activeWagerId, setActiveWagerId] = useState(null);

    // Multiplayer State
    const socketRef = useRef(null);
    const [multiplayerState, setMultiplayerState] = useState(null);
    const [isMultiplayer, setIsMultiplayer] = useState(false);
    const [countdown, setCountdown] = useState(null);

    const canvasRef = useRef(null);
    const snakeRef = useRef([{ x: 10, y: 10 }]);
    const foodRef = useRef({ x: 15, y: 15 });
    const directionRef = useRef({ x: 0, y: 0 });
    const gameIntervalRef = useRef(null);
    const scoreRef = useRef(0); // Track real-time score to avoid state race conditions

    // Calculate game speed based on score
    const calculateGameSpeed = (currentScore) => {
        const speedDecrease = Math.floor(currentScore / SPEED_INCREASE_INTERVAL) * 10;
        const newSpeed = Math.max(MIN_GAME_SPEED, INITIAL_GAME_SPEED - speedDecrease);
        return newSpeed;
    };

    const { data: userHighScore, refetch: refetchUserHigh } = useReadContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'getHighScore',
        args: address ? [address] : undefined,
        query: {
            enabled: !!address,
            refetchInterval: 2000 // Poll every 2 seconds for faster updates
        }
    });

    const { data: topScoreData, refetch: refetchTopScore } = useReadContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'topScore',
        query: {
            refetchInterval: 2000 // Poll every 2 seconds for faster updates
        }
    });

    const { data: activeGamesData, refetch: refetchActiveGames } = useReadContract({
        address: WAGER_CONTRACT_ADDRESS,
        abi: WAGER_ABI,
        functionName: 'getActiveGames',
        query: {
            refetchInterval: 5000 // Poll every 5 seconds
        }
    });

    const globalTopScore = topScoreData ? Number(topScoreData[1]) : 0;
    const topPlayer = topScoreData ? topScoreData[0] : '---';
    const displayUserHighScore = userHighScore ? Number(userHighScore) : 0;

    // ----- BigInt Serialization Helpers -----
    const bigIntReplacer = (key, value) =>
        typeof value === 'bigint' ? { __type: 'bigint', value: value.toString() } : value;

    const bigIntReviver = (key, value) =>
        value && value.__type === 'bigint' ? BigInt(value.value) : value;

    useEffect(() => {
        if (isConnected) {
            const stored = localStorage.getItem(`session_${address}`);
            if (stored) {
                try {
                    const parsed = JSON.parse(stored, bigIntReviver);
                    if (parsed.expiresAt > Math.floor(Date.now() / 1000)) {
                        setSessionKey(parsed);
                        setHasSession(true);
                        setStatusMessage('Session active!');
                    } else {
                        localStorage.removeItem(`session_${address}`);
                    }
                } catch (e) {
                    console.error('Failed to parse session:', e);
                }
            }
        }
    }, [isConnected, address]);

    const createSession = async () => {
        try {
            setStatusMessage('Creating session key...');
            const sessionPrivateKey = generatePrivateKey();
            const sessionSigner = privateKeyToAccount(sessionPrivateKey);
            const expiresAt = BigInt(Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7);

            const { session, transactionHash } = await createSessionAsync({
                session: {
                    signer: sessionSigner.address,
                    expiresAt,
                    feeLimit: { limitType: LimitType.Lifetime, limit: parseEther('0.1'), period: BigInt(0) },
                    callPolicies: [{
                        target: CONTRACT_ADDRESS,
                        selector: toFunctionSelector('submitScore(uint256)'),
                        valueLimit: { limitType: LimitType.Unlimited, limit: BigInt(0), period: BigInt(0) },
                        maxValuePerUse: BigInt(0),
                        constraints: [],
                    }],
                    transferPolicies: [],
                }
            });

            const sessionData = {
                privateKey: sessionPrivateKey,
                address: sessionSigner.address,
                expiresAt: Number(expiresAt),
                session: session
            };

            localStorage.setItem(`session_${address}`, JSON.stringify(sessionData, bigIntReplacer));
            setSessionKey(sessionData);
            setHasSession(true);
            setStatusMessage('Session created! ✅');
            console.log('Session created:', transactionHash);
        } catch (error) {
            console.error('Failed to create session:', error);
            setStatusMessage('Failed to create session');
        }
    };

    const startDemo = () => {
        setIsDemoMode(true);
        setScore(0);
        scoreRef.current = 0;
        setCurrentSpeed(INITIAL_GAME_SPEED);
        setGameOver(false);
        setIsGameRunning(true);
        snakeRef.current = [{ x: 10, y: 10 }];
        directionRef.current = { x: 1, y: 0 };
        placeFood();
        if (gameIntervalRef.current) clearInterval(gameIntervalRef.current);
        gameIntervalRef.current = setInterval(gameLoop, INITIAL_GAME_SPEED);
    };

    const startGame = () => {
        setIsDemoMode(false);
        setScore(0);
        scoreRef.current = 0;
        setCurrentSpeed(INITIAL_GAME_SPEED);
        setGameOver(false);
        setIsGameRunning(true);
        snakeRef.current = [{ x: 10, y: 10 }];
        directionRef.current = { x: 1, y: 0 };
        placeFood();
        if (gameIntervalRef.current) clearInterval(gameIntervalRef.current);
        gameIntervalRef.current = setInterval(gameLoop, INITIAL_GAME_SPEED);
    };

    // Dynamic speed adjustment based on score
    useEffect(() => {
        if (!isGameRunning || isMultiplayer) return; // Don't adjust speed in multiplayer

        const newSpeed = calculateGameSpeed(score);
        if (newSpeed !== currentSpeed) {
            setCurrentSpeed(newSpeed);
            // Restart interval with new speed
            if (gameIntervalRef.current) {
                clearInterval(gameIntervalRef.current);
                gameIntervalRef.current = setInterval(gameLoop, newSpeed);
            }
        }
    }, [score, isGameRunning, isMultiplayer]);

    const placeFood = () => {
        let newFood;
        let isOnSnake = true;
        while (isOnSnake) {
            newFood = { x: Math.floor(Math.random() * TILE_COUNT), y: Math.floor(Math.random() * TILE_COUNT) };
            isOnSnake = snakeRef.current.some(s => s.x === newFood.x && s.y === newFood.y);
        }
        foodRef.current = newFood;
    };

    const gameLoop = () => {
        const head = {
            x: snakeRef.current[0].x + directionRef.current.x,
            y: snakeRef.current[0].y + directionRef.current.y
        };
        if (head.x < 0 || head.x >= TILE_COUNT || head.y < 0 || head.y >= TILE_COUNT ||
            snakeRef.current.some(s => s.x === head.x && s.y === head.y)) {
            endGame();
            return;
        }
        const newSnake = [head, ...snakeRef.current];
        if (head.x === foodRef.current.x && head.y === foodRef.current.y) {
            scoreRef.current += 10; // Update ref immediately
            setScore(s => s + 10); // Update state for UI
            placeFood();
        } else {
            newSnake.pop();
        }
        snakeRef.current = newSnake;
        draw();
    };

    const endGame = () => {
        clearInterval(gameIntervalRef.current);
        setIsGameRunning(false);
        setGameOver(true);
        setIsPaused(false); // Reset pause state
        const finalScore = scoreRef.current; // Use ref for accurate score
        if (activeWagerId) {
            submitMatchScore(finalScore);
        } else if (isConnected && hasSession && !isDemoMode) {
            submitScore(finalScore);
        }
    };

    const togglePause = () => {
        if (!isGameRunning || gameOver) return;

        if (isPaused) {
            // Resume game
            setIsPaused(false);
            gameIntervalRef.current = setInterval(gameLoop, currentSpeed);
        } else {
            // Pause game
            setIsPaused(true);
            clearInterval(gameIntervalRef.current);
        }
    };

    const submitScore = async (finalScore) => {
        if (!hasSession || isSubmitting || !agwClient || !sessionKey.session) return;
        setIsSubmitting(true);
        setStatusMessage('Submitting...');
        try {
            const sessionSigner = privateKeyToAccount(sessionKey.privateKey);
            const sessionClient = toSessionClient({
                client: agwClient,
                signer: sessionSigner,
                session: sessionKey.session
            });
            const txHash = await sessionClient.writeContract({
                abi: CONTRACT_ABI,
                address: CONTRACT_ADDRESS,
                functionName: 'submitScore',
                args: [BigInt(finalScore)],
            });
            console.log(`TX: ${txHash}`);
            setStatusMessage(`Saved! ${txHash.slice(0, 10)}...`);
            refetchUserHigh();
            refetchTopScore();
        } catch (error) {
            console.error('ERROR:', error);
            setStatusMessage(`Failed: ${error.message?.slice(0, 30)}...`);
        } finally {
            setIsSubmitting(false);
        }
    };

    // ----- Wager Functions -----

    const createWager = async () => {
        if (!isConnected || !wagerAmount) return;
        try {
            setStatusMessage('Creating wager...');
            const txHash = await writeContractAsync({
                abi: WAGER_ABI,
                address: WAGER_CONTRACT_ADDRESS,
                functionName: 'createGame',
                value: parseEther(wagerAmount),
            });
            console.log('Wager created:', txHash);
            setStatusMessage('Wager created! Waiting for opponent...');
            refetchActiveGames();
        } catch (error) {
            console.error('Failed to create wager:', error);
            setStatusMessage('Failed to create wager');
        }
    };

    const joinWager = async (gameId, amount) => {
        if (!isConnected) return;
        try {
            setStatusMessage('Joining wager...');
            const txHash = await writeContractAsync({
                abi: WAGER_ABI,
                address: WAGER_CONTRACT_ADDRESS,
                functionName: 'joinGame',
                args: [BigInt(gameId)],
                value: amount,
            });
            console.log('Joined wager:', txHash);
            setStatusMessage('Joined match! Connecting to server...');

            // Start the game immediately for the joiner
            setActiveWagerId(gameId);
            // Switch to game view is implicit as we are in Home
            connectToGame(gameId, false); // false = challenger

            refetchActiveGames();
        } catch (error) {
            console.error('Failed to join wager:', error);
            setStatusMessage('Failed to join wager');
        }
    };

    const submitMatchScore = async (finalScore) => {
        if (!activeWagerId) return;
        setIsSubmitting(true);
        setStatusMessage('Submitting match score...');
        try {
            const txHash = await writeContractAsync({
                abi: WAGER_ABI,
                address: WAGER_CONTRACT_ADDRESS,
                functionName: 'submitMatchScore',
                args: [BigInt(activeWagerId), BigInt(finalScore)],
            });
            console.log('Match score submitted:', txHash);
            setStatusMessage(`Match Score Saved! ${txHash.slice(0, 10)}...`);
            setActiveWagerId(null); // Reset active wager
        } catch (error) {
            console.error('Failed to submit match score:', error);
            setStatusMessage('Failed to submit match score');
        } finally {
            setIsSubmitting(false);
        }
    };

    const connectToGame = (gameId, isHost) => {
        if (socketRef.current) socketRef.current.disconnect();

        const socket = io('http://localhost:3001');
        socketRef.current = socket;

        socket.emit('joinGame', { gameId: gameId.toString(), isHost });

        socket.on('connect', () => {
            console.log('Connected to game server');
            setStatusMessage('Connected! Waiting for opponent...');
        });

        socket.on('waitingForOpponent', () => {
            setStatusMessage('Waiting for opponent to join...');
        });

        socket.on('countdown', ({ count }) => {
            setCountdown(count);
            setStatusMessage(`Starting in ${count}...`);
        });

        socket.on('gameStart', ({ message }) => {
            setCountdown(null);
            setIsGameRunning(true);
            setStatusMessage('GO!');
            setIsMultiplayer(true); // Ensure we render multiplayer state
        });

        socket.on('gameState', (state) => {
            setMultiplayerState(state);
        });

        socket.on('gameOver', ({ winnerId, scores }) => {
            setIsGameRunning(false);
            setGameOver(true);
            setCountdown(null); // Ensure countdown is cleared

            const myScore = scores[socket.id];
            setScore(myScore); // Update local score for display

            if (winnerId === socket.id) {
                setStatusMessage('YOU WON! Submitting score...');
                submitMatchScore(myScore);
            } else if (winnerId === 'draw') {
                setStatusMessage('DRAW! Refund initiated.');
                // Both submit? Or just one? Contract handles draw if both submit.
                submitMatchScore(myScore);
            } else {
                setStatusMessage('YOU LOST! Better luck next time.');
                // Loser also submits to ensure game finalizes
                submitMatchScore(myScore);
            }
        });

        socket.on('playerDisconnected', () => {
            setStatusMessage('Opponent disconnected. You win!');
            setIsGameRunning(false);
            setGameOver(true);
            // Handle win by default?
        });
    };

    useEffect(() => {
        if (isMultiplayer && multiplayerState) {
            draw();
        }
    }, [multiplayerState, isMultiplayer]);

    // Handle Input for Multiplayer and Pause
    useEffect(() => {
        const handleKey = e => {
            // Spacebar to pause/resume
            if (e.key === ' ' || e.code === 'Space') {
                e.preventDefault(); // Prevent page scroll
                togglePause();
                return;
            }

            if (!isGameRunning || isPaused) return; // Don't process arrow keys if paused

            let newDir = null;
            switch (e.key) {
                case 'ArrowUp': newDir = { x: 0, y: -1 }; break;
                case 'ArrowDown': newDir = { x: 0, y: 1 }; break;
                case 'ArrowLeft': newDir = { x: -1, y: 0 }; break;
                case 'ArrowRight': newDir = { x: 1, y: 0 }; break;
            }

            if (newDir) {
                if (isMultiplayer && socketRef.current && activeWagerId) {
                    socketRef.current.emit('input', {
                        gameId: activeWagerId.toString(),
                        direction: newDir
                    });
                } else {
                    // Local Game Logic
                    if (newDir.x === 0 && directionRef.current.y !== 0 && newDir.y !== 0) return; // Prevent reverse
                    // ... (existing logic handled in gameLoop)
                    // Actually, existing logic updates directionRef directly
                    if (e.key === 'ArrowUp' && directionRef.current.y !== 1) directionRef.current = { x: 0, y: -1 };
                    if (e.key === 'ArrowDown' && directionRef.current.y !== -1) directionRef.current = { x: 0, y: 1 };
                    if (e.key === 'ArrowLeft' && directionRef.current.x !== 1) directionRef.current = { x: -1, y: 0 };
                    if (e.key === 'ArrowRight' && directionRef.current.x !== -1) directionRef.current = { x: 1, y: 0 };
                }
            }
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [isGameRunning, isPaused, isMultiplayer, activeWagerId]);

    const draw = () => {
        const ctx = canvasRef.current?.getContext('2d');
        if (!ctx) return;
        // Clear canvas to let CSS background show through
        ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

        // Draw Grid Lines (Subtle)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 1;
        for (let i = 0; i <= CANVAS_SIZE; i += GRID_SIZE) {
            ctx.beginPath();
            ctx.moveTo(0, i);
            ctx.lineTo(CANVAS_SIZE, i);
            ctx.stroke();
        }

        if (isMultiplayer && multiplayerState) {
            // Draw Multiplayer State

            // Draw Food
            if (multiplayerState.food) {
                ctx.fillStyle = '#ef4444';
                ctx.beginPath();
                const centerX = multiplayerState.food.x * GRID_SIZE + GRID_SIZE / 2;
                const centerY = multiplayerState.food.y * GRID_SIZE + GRID_SIZE / 2;
                const radius = (GRID_SIZE - 8) / 2;
                ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
                ctx.fill();
                ctx.shadowColor = '#ef4444';
                ctx.shadowBlur = 15;
                ctx.fill();
                ctx.shadowBlur = 0;
            }

            // Draw Players
            Object.values(multiplayerState.players).forEach(player => {
                if (!player.alive) return;

                player.body.forEach((seg, i) => {
                    ctx.fillStyle = i === 0 ? player.color : '#ffffff';
                    ctx.shadowColor = i === 0 ? player.color : 'rgba(255, 255, 255, 0.5)';
                    ctx.shadowBlur = i === 0 ? 15 : 0;

                    ctx.beginPath();
                    const centerX = seg.x * GRID_SIZE + GRID_SIZE / 2;
                    const centerY = seg.y * GRID_SIZE + GRID_SIZE / 2;
                    const radius = (GRID_SIZE - 4) / 2;

                    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
                    ctx.fill();
                    ctx.shadowBlur = 0;
                });
            });

        } else {
            // Draw Local State
            snakeRef.current.forEach((seg, i) => {
                ctx.fillStyle = i === 0 ? '#ccff00' : '#ffffff';
                ctx.shadowColor = i === 0 ? '#ccff00' : 'rgba(255, 255, 255, 0.5)';
                ctx.shadowBlur = i === 0 ? 15 : 0;

                ctx.beginPath();
                const centerX = seg.x * GRID_SIZE + GRID_SIZE / 2;
                const centerY = seg.y * GRID_SIZE + GRID_SIZE / 2;
                const radius = (GRID_SIZE - 4) / 2;

                ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
                ctx.fill();
                ctx.shadowBlur = 0;
            });

            ctx.fillStyle = '#ef4444';
            ctx.beginPath();
            const centerX = foodRef.current.x * GRID_SIZE + GRID_SIZE / 2;
            const centerY = foodRef.current.y * GRID_SIZE + GRID_SIZE / 2;
            const radius = (GRID_SIZE - 8) / 2;
            ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
            ctx.fill();
            ctx.shadowColor = '#ef4444';
            ctx.shadowBlur = 15;
            ctx.fill();
            ctx.shadowBlur = 0;
        }
    };

    // ----- Leaderboard State -----
    const [leaderboardTab, setLeaderboardTab] = useState('daily'); // 'daily', 'all_time', 'xp'

    return (
        <>
            <div className="game-section">
                <div className="game-container">
                    <canvas
                        ref={canvasRef}
                        width={CANVAS_SIZE}
                        height={CANVAS_SIZE}
                        className="game-canvas"
                        onClick={togglePause}
                        style={{ cursor: isGameRunning && !gameOver ? 'pointer' : 'default' }}
                    />

                    {/* Pause Overlay */}
                    {isPaused && (
                        <div className="game-overlay" style={{ backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 15 }}>
                            <h2 style={{ fontSize: '3rem', color: '#ccff00', margin: 0, letterSpacing: '4px' }}>PAUSED</h2>
                            <div style={{ fontSize: '1.2rem', color: 'var(--text-gray)', marginTop: '1rem' }}>
                                Press SPACE or TAP to resume
                            </div>
                        </div>
                    )}

                    {/* Game Overlay */}
                    {countdown !== null && (
                        <div className="game-overlay" style={{ backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 10 }}>
                            <div style={{ fontSize: '8rem', fontWeight: 'bold', color: '#ccff00', textShadow: '0 0 20px #ccff00' }}>
                                {countdown}
                            </div>
                        </div>
                    )}

                    {((!isGameRunning || gameOver) && countdown === null) && (
                        <div className="game-overlay">
                            {gameOver && <h2 className="game-over-title">GAME OVER</h2>}
                            <div className="score-display-large">
                                SCORE: {score}
                            </div>

                            {!isConnected ? (
                                <div className="action-buttons">
                                    <button onClick={login} className="btn-action primary">Sign in to Play</button>
                                    <button onClick={startDemo} className="btn-action secondary">Play Demo</button>
                                </div>
                            ) : (
                                <div className="action-buttons">
                                    <button onClick={startGame} className="btn-action primary">
                                        {gameOver ? 'TRY AGAIN' : 'START GAME'}
                                    </button>
                                    {!hasSession && (
                                        <button onClick={createSession} className="btn-action secondary">
                                            Enable Auto-Submit
                                        </button>
                                    )}
                                </div>
                            )}
                            {hasSession && <div className="auto-badge">⚡ AUTO-SUBMIT ACTIVE</div>}
                            {isDemoMode && !isConnected && gameOver && (
                                <div style={{ marginTop: '1rem', color: '#666', fontSize: '0.8rem' }}>
                                    Demo scores are not saved to the leaderboard.
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="game-status-bar">
                    <div className="status-text">{isSubmitting ? 'SAVING SCORE...' : statusMessage}</div>
                    <div className="controls-hint">
                        SPEED: {Math.round((INITIAL_GAME_SPEED - currentSpeed) / 10)}x | ARROWS to move | SPACE to pause
                    </div>
                </div>
            </div>

            {/* Leaderboard Section */}
            <aside className="leaderboard-section">
                <div className="leaderboard-header">
                    <h3>LEADERBOARD</h3>
                    <div className="tabs">
                        <span
                            className={`tab ${leaderboardTab === 'daily' ? 'active' : ''}`}
                            onClick={() => setLeaderboardTab('daily')}
                        >
                            DAILY
                        </span>
                        <span
                            className={`tab ${leaderboardTab === 'all_time' ? 'active' : ''}`}
                            onClick={() => setLeaderboardTab('all_time')}
                        >
                            ALL TIME
                        </span>
                        <span
                            className={`tab ${leaderboardTab === 'xp' ? 'active' : ''}`}
                            onClick={() => setLeaderboardTab('xp')}
                        >
                            XP
                        </span>
                    </div>
                </div>

                <div className="leaderboard-list">
                    <div className="lb-header-row">
                        <span>RANK</span>
                        <span>PLAYER</span>
                        <span>{leaderboardTab === 'xp' ? 'XP' : 'SCORE'}</span>
                    </div>

                    {/* Global Top Score (Mocked for tabs other than all_time for now) */}
                    <div className="lb-row highlight">
                        <span className="rank">1</span>
                        <span className="player">{topPlayer.slice(0, 8)}...</span>
                        <span className="score-val">
                            {leaderboardTab === 'xp' ? '9999 XP' : `+${globalTopScore}`}
                        </span>
                    </div>

                    {/* User High Score */}
                    {isConnected && (
                        <div className="lb-row user-row">
                            <span className="rank">YOU</span>
                            <span className="player">{address?.slice(0, 8)}...</span>
                            <span className="score-val">+{displayUserHighScore}</span>
                        </div>
                    )}

                    {/* Filler Rows for aesthetics */}
                    {[2, 3, 4, 5, 6, 7, 8].map(i => (
                        <div className="lb-row" key={i}>
                            <span className="rank">{i}</span>
                            <span className="player">---</span>
                            <span className="score-val">---</span>
                        </div>
                    ))}
                </div>

                <div className="promo-box">
                    <span>Upvote on Abstract</span>
                    <span className="arrow">→</span>
                </div>
            </aside>
        </>
    );
};

export default Home;
