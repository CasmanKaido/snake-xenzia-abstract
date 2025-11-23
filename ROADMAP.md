# 🗺️ Roadmap: Abstract Snake Xenzia

This roadmap outlines the steps to evolve the current Snake game into a fully-featured, production-ready decentralized application (dApp) on the Abstract Chain.

## 🏁 Phase 1: Foundation (Current Status)
- [x] **Game Logic**: Core Snake mechanics (movement, food, collision).
- [x] **Basic Contract**: Solidity contract to store high scores.
- [x] **Frontend**: HTML/CSS/JS interface with wallet connection.
- [ ] **Deployment**: Deploy contract to Abstract Testnet.
- [ ] **Integration**: Connect frontend to deployed contract.

## 🚀 Phase 2: Abstract Native Features (The "Wow" Factor)
Leverage Abstract's ZK-stack capabilities to improve user experience.

### 1. Gasless Transactions (Paymasters)
- **Goal**: Users shouldn't pay gas for every score submission.
- **Implementation**: 
  - Create a custom **Paymaster** contract.
  - Sponsor gas fees for users interacting with the `SnakeGame` contract.
  - *Why?* Removes friction for non-crypto natives.

### 2. Account Abstraction (Smart Accounts)
- **Goal**: Easy login and session keys.
- **Implementation**:
  - Use Abstract's native Account Abstraction.
  - Implement **Session Keys**: Users sign once to start a session, then the game auto-signs score submissions in the background without popups.

## 💰 Phase 3: Game Economy (Play-to-Earn)
Introduce incentives to make the game sticky.

### 1. ERC-20 Token Rewards ($SNAKE)
- **Goal**: Reward players for high scores.
- **Implementation**:
  - Deploy an ERC-20 token contract.
  - Update `SnakeGame` contract to mint/transfer tokens when a user beats their high score.

### 2. NFT Achievements (ERC-721)
- **Goal**: Unique collectibles for milestones.
- **Implementation**:
  - Mint a "Golden Snake" NFT for scoring > 1000 points.
  - Dynamic NFTs that change appearance based on total games played.

### 3. Entry Fees & Prize Pools
- **Goal**: Competitive stakes.
- **Implementation**:
  - `payToPlay()` function: User deposits ETH to start.
  - Weekly pot: Top 3 players at end of week claim the accumulated pot.

## 🛡️ Phase 4: Security & Anti-Cheat
Blockchain games are prone to botting.

- **Server-Side Verification**: 
  - Instead of submitting score directly, the frontend sends moves to a backend.
  - Backend verifies the game was valid and signs a message.
  - Contract verifies the backend's signature before accepting the score.
- **Rate Limiting**: Prevent spam submissions.

## 🌐 Phase 5: Production & Social
- **The Graph Integration**: Index `ScoreSubmitted` events for a fast, sortable global leaderboard.
- **IPFS/Arweave Hosting**: Host the frontend decentrally.
- **ENS/Abstract Names**: Show user names instead of `0x...` addresses.

## 🛠️ Technical Tasks for Next Steps
1. **Deploy Paymaster**: `contracts/Paymaster.sol`
2. **Update Frontend**: Switch to `zksync-ethers` for native AA features.
3. **Backend Oracle**: Simple Node.js server for score verification.
