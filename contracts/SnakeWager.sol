// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract SnakeWager {
    struct Game {
        address host;
        address challenger;
        uint256 wagerAmount;
        address winner;
        bool isActive;
        bool isFinished;
        uint256 hostScore;
        uint256 challengerScore;
        bool hostSubmitted;
        bool challengerSubmitted;
    }

    mapping(uint256 => Game) public games;
    uint256 public nextGameId;

    event GameCreated(uint256 indexed gameId, address indexed host, uint256 wagerAmount);
    event GameJoined(uint256 indexed gameId, address indexed challenger);
    event ScoreSubmitted(uint256 indexed gameId, address indexed player, uint256 score);
    event GameFinished(uint256 indexed gameId, address indexed winner, uint256 payout);

    function createGame() external payable {
        require(msg.value > 0, "Wager must be greater than 0");
        
        games[nextGameId] = Game({
            host: msg.sender,
            challenger: address(0),
            wagerAmount: msg.value,
            winner: address(0),
            isActive: true,
            isFinished: false,
            hostScore: 0,
            challengerScore: 0,
            hostSubmitted: false,
            challengerSubmitted: false
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

    function submitMatchScore(uint256 _gameId, uint256 _score) external {
        Game storage game = games[_gameId];
        require(game.isActive, "Game not active");
        require(!game.isFinished, "Game finished");
        require(msg.sender == game.host || msg.sender == game.challenger, "Not a player");

        if (msg.sender == game.host) {
            require(!game.hostSubmitted, "Already submitted");
            game.hostScore = _score;
            game.hostSubmitted = true;
        } else {
            require(!game.challengerSubmitted, "Already submitted");
            game.challengerScore = _score;
            game.challengerSubmitted = true;
        }

        emit ScoreSubmitted(_gameId, msg.sender, _score);

        // If both submitted, determine winner
        if (game.hostSubmitted && game.challengerSubmitted) {
            _finalizeGame(_gameId);
        }
    }

    function _finalizeGame(uint256 _gameId) internal {
        Game storage game = games[_gameId];
        game.isFinished = true;
        game.isActive = false;

        uint256 payout = address(this).balance >= game.wagerAmount * 2 ? game.wagerAmount * 2 : address(this).balance;

        if (game.hostScore > game.challengerScore) {
            game.winner = game.host;
            (bool sent, ) = game.host.call{value: payout}("");
            require(sent, "Payout failed");
        } else if (game.challengerScore > game.hostScore) {
            game.winner = game.challenger;
            (bool sent, ) = game.challenger.call{value: payout}("");
            require(sent, "Payout failed");
        } else {
            // Draw - refund both
            game.winner = address(0);
            uint256 refund = game.wagerAmount;
            (bool sentHost, ) = game.host.call{value: refund}("");
            (bool sentChallenger, ) = game.challenger.call{value: refund}("");
            require(sentHost && sentChallenger, "Refund failed");
        }

        emit GameFinished(_gameId, game.winner, payout);
    }
    
    function getActiveGames() external view returns (Game[] memory, uint256[] memory) {
        uint256 activeCount = 0;
        for (uint256 i = 0; i < nextGameId; i++) {
            if (games[i].isActive) {
                activeCount++;
            }
        }

        Game[] memory activeGames = new Game[](activeCount);
        uint256[] memory ids = new uint256[](activeCount);
        uint256 index = 0;
        for (uint256 i = 0; i < nextGameId; i++) {
            if (games[i].isActive) {
                activeGames[index] = games[i];
                ids[index] = i;
                index++;
            }
        }
        return (activeGames, ids);
    }
}
