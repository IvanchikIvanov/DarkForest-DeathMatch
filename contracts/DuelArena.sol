// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract DuelArena is ReentrancyGuard {
    struct Room {
        address creator;
        address challenger;
        uint256 betAmount;
        bool gameFinished;
        address winner;
        uint256 createdAt;
        bool exists;
    }

    mapping(uint256 => Room) public rooms;
    uint256 public nextRoomId;
    uint256 public constant TREASURY_FEE_PERCENT = 5; // 5% комиссия
    uint256 public constant MIN_BET = 0.001 ether;
    uint256 public constant MAX_BET = 0.005 ether;

    event RoomCreated(uint256 indexed roomId, address indexed creator, uint256 betAmount);
    event RoomJoined(uint256 indexed roomId, address indexed challenger, uint256 betAmount);
    event RewardClaimed(uint256 indexed roomId, address indexed winner, uint256 amount);
    event GameFinished(uint256 indexed roomId, address indexed winner);

    modifier validBetAmount(uint256 amount) {
        require(amount == MIN_BET || amount == MAX_BET, "Invalid bet amount. Must be 0.001 or 0.005 ETH");
        _;
    }

    modifier roomExists(uint256 roomId) {
        require(rooms[roomId].exists, "Room does not exist");
        _;
    }

    function createRoom(uint256 betAmount) external payable validBetAmount(betAmount) nonReentrant {
        require(msg.value == betAmount, "Sent amount must match bet amount");
        require(msg.sender.balance >= betAmount, "Insufficient balance");

        uint256 roomId = nextRoomId++;
        rooms[roomId] = Room({
            creator: msg.sender,
            challenger: address(0),
            betAmount: betAmount,
            gameFinished: false,
            winner: address(0),
            createdAt: block.timestamp,
            exists: true
        });

        emit RoomCreated(roomId, msg.sender, betAmount);
    }

    function joinRoom(uint256 roomId) external payable roomExists(roomId) nonReentrant {
        Room storage room = rooms[roomId];
        require(room.challenger == address(0), "Room already has a challenger");
        require(room.creator != msg.sender, "Cannot join your own room");
        require(!room.gameFinished, "Game already finished");
        require(msg.value == room.betAmount, "Bet amount must match room bet amount");
        require(msg.sender.balance >= room.betAmount, "Insufficient balance");

        room.challenger = msg.sender;
        emit RoomJoined(roomId, msg.sender, room.betAmount);
    }

    function finishGame(uint256 roomId, address winner) external roomExists(roomId) {
        Room storage room = rooms[roomId];
        require(!room.gameFinished, "Game already finished");
        require(room.challenger != address(0), "Room must have a challenger");
        require(winner == room.creator || winner == room.challenger, "Winner must be a player in the room");
        require(msg.sender == room.creator || msg.sender == room.challenger, "Only players can finish the game");

        room.gameFinished = true;
        room.winner = winner;
        emit GameFinished(roomId, winner);
    }

    function claimReward(uint256 roomId) external roomExists(roomId) nonReentrant {
        Room storage room = rooms[roomId];
        require(room.gameFinished, "Game not finished yet");
        require(room.winner == msg.sender, "Only winner can claim reward");
        require(room.challenger != address(0), "Room must have a challenger");

        uint256 totalBet = room.betAmount * 2; // creator bet + challenger bet
        uint256 treasuryFee = (totalBet * TREASURY_FEE_PERCENT) / 100;
        uint256 reward = totalBet - treasuryFee;

        // Mark as claimed by resetting winner to prevent double claiming
        room.winner = address(0);

        (bool success, ) = payable(msg.sender).call{value: reward}("");
        require(success, "Transfer failed");

        emit RewardClaimed(roomId, msg.sender, reward);
    }

    function getRoom(uint256 roomId) external view roomExists(roomId) returns (Room memory) {
        return rooms[roomId];
    }

    function getRoomBetAmount(uint256 roomId) external view roomExists(roomId) returns (uint256) {
        return rooms[roomId].betAmount;
    }

    function withdrawTreasury() external {
        // Функция для вывода средств из казны (может быть ограничена только owner)
        // Пока оставляем пустой, можно добавить owner модификатор позже
    }

    receive() external payable {
        revert("Direct ETH transfers not allowed");
    }
}
