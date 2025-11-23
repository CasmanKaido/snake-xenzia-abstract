# 🚀 Deploy Snake Game to Abstract Testnet via Remix

## Step 1: Open Remix
Go to: https://remix.ethereum.org

## Step 2: Create SnakeGame.sol
1. In the File Explorer (left sidebar), click the "+" icon
2. Name it: `SnakeGame.sol`
3. Paste the contract code (see below)

## Step 3: Compile
1. Click "Solidity Compiler" icon (left sidebar)
2. Select compiler version: `0.8.24`
3. Click "Compile SnakeGame.sol"

## Step 4: Connect MetaMask to Abstract Testnet
1. Open MetaMask
2. Click the network dropdown
3. Click "Add Network" → "Add a network manually"
4. Enter these details:
   - **Network Name**: Abstract Testnet
   - **RPC URL**: https://api.testnet.abs.xyz
   - **Chain ID**: 11124
   - **Currency Symbol**: ETH
   - **Block Explorer**: https://sepolia.abscan.org

## Step 5: Deploy
1. In Remix, click "Deploy & Run Transactions" icon
2. In "Environment", select "Injected Provider - MetaMask"
3. MetaMask will prompt - select Abstract Testnet
4. Click "Deploy"
5. Confirm the transaction in MetaMask

## Step 6: Copy Contract Address
After deployment, you'll see the contract under "Deployed Contracts" in Remix.
Click the copy icon next to the address.

## Step 7: Update Your React App
Open `web/src/App.jsx` and update line 11:
```javascript
const CONTRACT_ADDRESS = "YOUR_DEPLOYED_ADDRESS_HERE";
```

---

## SnakeGame.sol Contract Code

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract SnakeGame {
    struct PlayerScore {
        address player;
        uint256 score;
        uint256 timestamp;
    }

    mapping(address => uint256) public highScores;
    PlayerScore public topScore;

    event ScoreSubmitted(address indexed player, uint256 score);
    event NewHighScore(address indexed player, uint256 score);

    function submitScore(uint256 _score) external {
        if (_score > highScores[msg.sender]) {
            highScores[msg.sender] = _score;
            emit NewHighScore(msg.sender, _score);
        }

        if (_score > topScore.score) {
            topScore = PlayerScore(msg.sender, _score, block.timestamp);
        }

        emit ScoreSubmitted(msg.sender, _score);
    }

    function getHighScore(address _player) external view returns (uint256) {
        return highScores[_player];
    }
}
```
