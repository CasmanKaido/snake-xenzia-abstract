// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";

contract SnakeWager is Ownable {
    struct Game {
        address host;
        address challenger;
        uint256 wagerAmount;
        address winner;
        bool isActive;
        bool isFinished;
    }

    mapping(uint256 => Game) public games;
    uint256 public nextGameId;

    event GameCreated(uint256 indexed gameId, address indexed host, uint256 wagerAmount);
    event GameJoined(uint256 indexed gameId, address indexed challenger);
    event GameFinished(uint256 indexed gameId, address indexed winner, uint256 payout);

    constructor() Ownable(msg.sender) {}

    function createGame() external payable {
        require(msg.value > 0, "Wager must be greater than 0");
        
        games[nextGameId] = Game({
            host: msg.sender,
            challenger: address(0),
            wagerAmount: msg.value,
            winner: address(0),
            isActive: true,
            isFinished: false
        });

        emit GameCreated(nextGameId, msg.sender, msg.value);
        nextGameId++;
    }

    function joinGame(uint256 _gameId) external payable {
        Game storage game = games[_gameId];
        require(game.isActive, "Game is not active");
        require(game.challenger == address(0), "Game already full");
        require(msg.value == game.wagerAmount, "Incorrect wager amount");
        require(msg.sender != game.host, "Cannot join your own game");

        game.challenger = msg.sender;
        emit GameJoined(_gameId, msg.sender);
    }

    // For this MVP, only the owner (server/admin) can declare the winner to prevent cheating
    // In a real version, this would use ZK proofs or a commit-reveal scheme
    function declareWinner(uint256 _gameId, address _winner) external onlyOwner {
        Game storage game = games[_gameId];
        require(game.isActive, "Game not active");
        require(!game.isFinished, "Game already finished");
        require(_winner == game.host || _winner == game.challenger, "Invalid winner");

        game.isFinished = true;
        game.isActive = false;
        game.winner = _winner;

        uint256 payout = address(this).balance >= game.wagerAmount * 2 ? game.wagerAmount * 2 : address(this).balance;
        
        (bool sent, ) = _winner.call{value: payout}("");
        require(sent, "Failed to send payout");

        emit GameFinished(_gameId, _winner, payout);
    }
    
    function getActiveGames() external view returns (Game[] memory, uint256[] memory) {
        uint256 activeCount = 0;
        for (uint256 i = 0; i < nextGameId; i++) {
            if (games[i].isActive && games[i].challenger == address(0)) {
                activeCount++;
            }
        }

        Game[] memory activeGames = new Game[](activeCount);
        uint256[] memory ids = new uint256[](activeCount);
        uint256 index = 0;
        for (uint256 i = 0; i < nextGameId; i++) {
            if (games[i].isActive && games[i].challenger == address(0)) {
                activeGames[index] = games[i];
                ids[index] = i;
                index++;
            }
        }
        return (activeGames, ids);
    }
}
