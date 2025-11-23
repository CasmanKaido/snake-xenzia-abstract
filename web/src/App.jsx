import { useState, useEffect, useRef } from 'react';
import { AbstractWalletProvider, useLoginWithAbstract, useCreateSession, useAbstractClient } from '@abstract-foundation/agw-react';
import { toSessionClient } from '@abstract-foundation/agw-client/sessions';
import { abstractTestnet } from 'viem/chains';
import { useAccount, useBalance, useReadContract, useWriteContract } from 'wagmi';
import { parseAbi, toFunctionSelector, parseEther, formatEther } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { LimitType } from '@abstract-foundation/agw-client/sessions';

// ---------- Constants ----------
const GRID_SIZE = 25;
const GAME_SPEED = 100;
const CANVAS_SIZE = 500;
const TILE_COUNT = CANVAS_SIZE / GRID_SIZE;
const CONTRACT_ADDRESS = '0xf185fDc10d0d64082A9318c794f172740ddDe18c';
const WAGER_CONTRACT_ADDRESS = '0xA0Aa87947647Cde59B76845C06A23658D1530420';

const CONTRACT_ABI = parseAbi([
    'function submitScore(uint256 _score) external',
    'function getHighScore(address _player) external view returns (uint256)',
    'function topScore() external view returns (address, uint256, uint256)',
    'event NewHighScore(address indexed player, uint256 score)'
]);

const WAGER_ABI = parseAbi([
    'function createGame() external payable',
    'function joinGame(uint256 _gameId) external payable',
    'function getActiveGames() external view returns ((address host, address challenger, uint256 wagerAmount, address winner, bool isActive, bool isFinished)[], uint256[])',
    'event GameCreated(uint256 indexed gameId, address indexed host, uint256 wagerAmount)',
    'event GameJoined(uint256 indexed gameId, address indexed challenger)'
]);

function Game() {
    const { address, isConnected } = useAccount();
    const { login, logout } = useLoginWithAbstract();
    const { data: balanceData } = useBalance({ address });
    const { createSessionAsync } = useCreateSession();
    const { data: agwClient } = useAbstractClient();
    const { writeContractAsync } = useWriteContract();

    const [activeTab, setActiveTab] = useState('single'); // 'single' or 'multi'
    const [wagerAmount, setWagerAmount] = useState('0.001');
    const [isDemoMode, setIsDemoMode] = useState(false);
    const [score, setScore] = useState(0);
    const [isGameRunning, setIsGameRunning] = useState(false);
    const [gameOver, setGameOver] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [sessionKey, setSessionKey] = useState(null);
    const [hasSession, setHasSession] = useState(false);
    const [copied, setCopied] = useState(false);

    const canvasRef = useRef(null);
    const snakeRef = useRef([{ x: 10, y: 10 }]);
    const foodRef = useRef({ x: 15, y: 15 });
    const directionRef = useRef({ x: 0, y: 0 });
    const gameIntervalRef = useRef(null);

    const { data: userHighScore, refetch: refetchUserHigh } = useReadContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'getHighScore',
        args: address ? [address] : undefined,
        query: { enabled: !!address }
    });

    const { data: topScoreData, refetch: refetchTopScore } = useReadContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'topScore',
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

    const copyAddress = () => {
        if (address) {
            navigator.clipboard.writeText(address);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

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
        setGameOver(false);
        setIsGameRunning(true);
        snakeRef.current = [{ x: 10, y: 10 }];
        directionRef.current = { x: 1, y: 0 };
        placeFood();
        if (gameIntervalRef.current) clearInterval(gameIntervalRef.current);
        gameIntervalRef.current = setInterval(gameLoop, GAME_SPEED);
    };

    const startGame = () => {
        setIsDemoMode(false);
        setScore(0);
        setGameOver(false);
        setIsGameRunning(true);
        snakeRef.current = [{ x: 10, y: 10 }];
        directionRef.current = { x: 1, y: 0 };
        placeFood();
        if (gameIntervalRef.current) clearInterval(gameIntervalRef.current);
        gameIntervalRef.current = setInterval(gameLoop, GAME_SPEED);
    };

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
            setScore(s => s + 10);
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
        if (isConnected && hasSession && !isDemoMode) submitScore(score);
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
            setStatusMessage('Joined match! Good luck!');
            refetchActiveGames();
        } catch (error) {
            console.error('Failed to join wager:', error);
            setStatusMessage('Failed to join wager');
        }
    };

    useEffect(() => {
        const handleKey = e => {
            if (!isGameRunning) return;
            switch (e.key) {
                case 'ArrowUp': if (directionRef.current.y !== 1) directionRef.current = { x: 0, y: -1 }; break;
                case 'ArrowDown': if (directionRef.current.y !== -1) directionRef.current = { x: 0, y: 1 }; break;
                case 'ArrowLeft': if (directionRef.current.x !== 1) directionRef.current = { x: -1, y: 0 }; break;
                case 'ArrowRight': if (directionRef.current.x !== -1) directionRef.current = { x: 1, y: 0 }; break;
            }
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [isGameRunning]);

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
            ctx.moveTo(i, 0);
            ctx.lineTo(i, CANVAS_SIZE);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(0, i);
            ctx.lineTo(CANVAS_SIZE, i);
            ctx.stroke();
        }

        snakeRef.current.forEach((seg, i) => {
            ctx.fillStyle = i === 0 ? '#ccff00' : '#ffffff'; // Neon green head, white body
            // Add glow effect
            ctx.shadowColor = i === 0 ? '#ccff00' : 'rgba(255, 255, 255, 0.5)';
            ctx.shadowBlur = i === 0 ? 15 : 0;

            ctx.beginPath();
            // Draw circle for each segment
            const centerX = seg.x * GRID_SIZE + GRID_SIZE / 2;
            const centerY = seg.y * GRID_SIZE + GRID_SIZE / 2;
            const radius = (GRID_SIZE - 4) / 2; // Slightly smaller for "bead" look

            ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
            ctx.fill();

            // Reset shadow
            ctx.shadowBlur = 0;
        });

        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        const foodX = foodRef.current.x * GRID_SIZE + GRID_SIZE / 2;
        const foodY = foodRef.current.y * GRID_SIZE + GRID_SIZE / 2;
        ctx.arc(foodX, foodY, (GRID_SIZE - 4) / 2, 0, 2 * Math.PI);
        ctx.fill();
    };

    return (
        <div className="app-layout">
            {/* Left Sidebar */}
            <aside className="sidebar">
                <div className="logo-area">
                    <span className="logo-icon">🐍</span>
                    <span className="logo-text">SNAKE XENZIA</span>
                </div>
                <nav className="nav-menu">
                    <div className={`nav-item ${activeTab === 'single' ? 'active' : ''}`} onClick={() => setActiveTab('single')}>
                        <span className="icon">🎮</span>
                        <span>Snake Party</span>
                    </div>
                    <div className={`nav-item ${activeTab === 'multi' ? 'active' : ''}`} onClick={() => setActiveTab('multi')}>
                        <span className="icon">⚔️</span>
                        <span>Multiplayer</span>
                    </div>
                </nav>
            </aside>

            <div className="main-wrapper">
                {/* Top Bar */}
                <header className="top-bar">
                    <div className="top-left">
                        <span>Support</span>
                        <span>Referrals</span>
                    </div>
                    <div className="top-right">
                        {!isConnected ? (
                            <button onClick={login} className="btn-login-small">
                                <span className="icon">⚡</span> Sign in
                            </button>
                        ) : (
                            <div className="wallet-display">
                                <span className="balance">{balanceData ? parseFloat(balanceData.formatted).toFixed(4) : '0.00'} ETH</span>
                                <div className="address-pill" onClick={copyAddress}>
                                    {copied ? 'COPIED' : `${address?.slice(0, 6)}...${address?.slice(-4)}`}
                                </div>
                                <button onClick={logout} className="btn-logout">×</button>
                            </div>
                        )}
                    </div>
                </header>

                {/* Content Area */}
                <div className="content-area">

                    {activeTab === 'single' ? (
                        /* Single Player Game Section */
                        <div className="game-section">
                            <div className="game-container">
                                <canvas ref={canvasRef} width={CANVAS_SIZE} height={CANVAS_SIZE} className="game-canvas" />

                                {/* Game Overlay */}
                                {(!isGameRunning || gameOver) && (
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
                                <div className="controls-hint">USE ARROW KEYS TO MOVE</div>
                            </div>
                        </div>
                    ) : (
                        /* Multiplayer Section */
                        <div className="game-section">
                            <div className="multiplayer-container">
                                <h2 className="section-title">⚔️ WAGER ARENA</h2>

                                <div className="create-wager-card">
                                    <h3>CREATE MATCH</h3>
                                    <div className="wager-input-group">
                                        <label>WAGER AMOUNT (ETH)</label>
                                        <input
                                            type="number"
                                            value={wagerAmount}
                                            onChange={(e) => setWagerAmount(e.target.value)}
                                            step="0.001"
                                            className="wager-input"
                                        />
                                    </div>
                                    <button onClick={createWager} className="btn-action primary full-width">
                                        CREATE & STAKE {wagerAmount} ETH
                                    </button>
                                </div>

                                <div className="live-battles">
                                    <h3>LIVE BATTLES</h3>
                                    <div className="battle-list">
                                        {activeGamesData && activeGamesData[0] && activeGamesData[0].length > 0 ? (
                                            activeGamesData[0].map((game, index) => (
                                                <div className="battle-row" key={activeGamesData[1][index].toString()}>
                                                    <div className="battle-info">
                                                        <span className="battle-host">Host: {game.host.slice(0, 6)}...{game.host.slice(-4)}</span>
                                                        <span className="battle-stake">💎 {formatEther(game.wagerAmount)} ETH</span>
                                                    </div>
                                                    {game.host !== address && (
                                                        <button
                                                            onClick={() => joinWager(activeGamesData[1][index], game.wagerAmount)}
                                                            className="btn-join"
                                                        >
                                                            JOIN MATCH
                                                        </button>
                                                    )}
                                                    {game.host === address && (
                                                        <span style={{ color: '#666', fontSize: '0.8rem' }}>WAITING...</span>
                                                    )}
                                                </div>
                                            ))
                                        ) : (
                                            <div style={{ color: '#666', textAlign: 'center', padding: '1rem' }}>
                                                No active battles. Create one!
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Leaderboard Section */}
                    <aside className="leaderboard-section">
                        <div className="leaderboard-header">
                            <h3>LEADERBOARD</h3>
                            <div className="tabs">
                                <span className="tab active">ALL TIME</span>
                                <span className="tab">DAILY</span>
                            </div>
                        </div>

                        <div className="leaderboard-list">
                            <div className="lb-header-row">
                                <span>RANK</span>
                                <span>PLAYER</span>
                                <span>SCORE</span>
                            </div>

                            {/* Global Top Score */}
                            <div className="lb-row highlight">
                                <span className="rank">1</span>
                                <span className="player">{topPlayer.slice(0, 8)}...</span>
                                <span className="score-val">+{globalTopScore}</span>
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

                </div>
            </div>
        </div>
    );
}

export default function App() {
    return (
        <AbstractWalletProvider chain={abstractTestnet}>
            <Game />
        </AbstractWalletProvider>
    );
}
