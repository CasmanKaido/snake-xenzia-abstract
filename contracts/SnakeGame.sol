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
