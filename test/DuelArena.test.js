const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("DuelArena", function () {
  let duelArena;
  let owner;
  let player1;
  let player2;
  let player3;

  const MIN_BET = ethers.parseEther("0.001");
  const MAX_BET = ethers.parseEther("0.005");

  beforeEach(async function () {
    [owner, player1, player2, player3] = await ethers.getSigners();

    const DuelArena = await ethers.getContractFactory("DuelArena");
    duelArena = await DuelArena.deploy();
    await duelArena.waitForDeployment();
  });

  describe("Room Creation", function () {
    it("Should create a room with valid bet amount", async function () {
      await expect(duelArena.connect(player1).createRoom(MIN_BET, { value: MIN_BET }))
        .to.emit(duelArena, "RoomCreated")
        .withArgs(0, player1.address, MIN_BET);

      const room = await duelArena.getRoom(0);
      expect(room.creator).to.equal(player1.address);
      expect(room.betAmount).to.equal(MIN_BET);
      expect(room.challenger).to.equal(ethers.ZeroAddress);
      expect(room.gameFinished).to.be.false;
    });

    it("Should create a room with MAX_BET", async function () {
      await expect(duelArena.connect(player1).createRoom(MAX_BET, { value: MAX_BET }))
        .to.emit(duelArena, "RoomCreated")
        .withArgs(0, player1.address, MAX_BET);
    });

    it("Should reject invalid bet amounts", async function () {
      const invalidBet = ethers.parseEther("0.002");
      await expect(
        duelArena.connect(player1).createRoom(invalidBet, { value: invalidBet })
      ).to.be.revertedWith("Invalid bet amount");
    });

    it("Should reject if sent amount doesn't match bet amount", async function () {
      await expect(
        duelArena.connect(player1).createRoom(MIN_BET, { value: MAX_BET })
      ).to.be.revertedWith("Sent amount must match bet amount");
    });
  });

  describe("Joining Room", function () {
    beforeEach(async function () {
      await duelArena.connect(player1).createRoom(MIN_BET, { value: MIN_BET });
    });

    it("Should allow joining with matching bet amount", async function () {
      await expect(duelArena.connect(player2).joinRoom(0, { value: MIN_BET }))
        .to.emit(duelArena, "RoomJoined")
        .withArgs(0, player2.address, MIN_BET);

      const room = await duelArena.getRoom(0);
      expect(room.challenger).to.equal(player2.address);
    });

    it("Should reject joining with wrong bet amount", async function () {
      await expect(
        duelArena.connect(player2).joinRoom(0, { value: MAX_BET })
      ).to.be.revertedWith("Bet amount must match room bet amount");
    });

    it("Should reject joining own room", async function () {
      await expect(
        duelArena.connect(player1).joinRoom(0, { value: MIN_BET })
      ).to.be.revertedWith("Cannot join your own room");
    });

    it("Should reject joining already full room", async function () {
      await duelArena.connect(player2).joinRoom(0, { value: MIN_BET });
      await expect(
        duelArena.connect(player3).joinRoom(0, { value: MIN_BET })
      ).to.be.revertedWith("Room already has a challenger");
    });
  });

  describe("Finishing Game", function () {
    beforeEach(async function () {
      await duelArena.connect(player1).createRoom(MIN_BET, { value: MIN_BET });
      await duelArena.connect(player2).joinRoom(0, { value: MIN_BET });
    });

    it("Should allow finishing game by creator", async function () {
      await expect(duelArena.connect(player1).finishGame(0, player1.address))
        .to.emit(duelArena, "GameFinished")
        .withArgs(0, player1.address);

      const room = await duelArena.getRoom(0);
      expect(room.gameFinished).to.be.true;
      expect(room.winner).to.equal(player1.address);
    });

    it("Should allow finishing game by challenger", async function () {
      await expect(duelArena.connect(player2).finishGame(0, player2.address))
        .to.emit(duelArena, "GameFinished")
        .withArgs(0, player2.address);
    });

    it("Should reject finishing by non-player", async function () {
      await expect(
        duelArena.connect(player3).finishGame(0, player1.address)
      ).to.be.revertedWith("Only players can finish the game");
    });

    it("Should reject invalid winner", async function () {
      await expect(
        duelArena.connect(player1).finishGame(0, player3.address)
      ).to.be.revertedWith("Winner must be a player in the room");
    });
  });

  describe("Claiming Reward", function () {
    beforeEach(async function () {
      await duelArena.connect(player1).createRoom(MIN_BET, { value: MIN_BET });
      await duelArena.connect(player2).joinRoom(0, { value: MIN_BET });
      await duelArena.connect(player1).finishGame(0, player1.address);
    });

    it("Should allow winner to claim reward", async function () {
      const initialBalance = await ethers.provider.getBalance(player1.address);
      const tx = await duelArena.connect(player1).claimReward(0);
      const receipt = await tx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;
      const finalBalance = await ethers.provider.getBalance(player1.address);

      const totalBet = MIN_BET * 2n;
      const expectedReward = totalBet - (totalBet * 5n) / 100n;
      const balanceIncrease = finalBalance - initialBalance + gasUsed;

      expect(balanceIncrease).to.be.closeTo(expectedReward, ethers.parseEther("0.0001"));
    });

    it("Should emit RewardClaimed event", async function () {
      const totalBet = MIN_BET * 2n;
      const expectedReward = totalBet - (totalBet * 5n) / 100n;

      await expect(duelArena.connect(player1).claimReward(0))
        .to.emit(duelArena, "RewardClaimed")
        .withArgs(0, player1.address, expectedReward);
    });

    it("Should reject claim by non-winner", async function () {
      await expect(
        duelArena.connect(player2).claimReward(0)
      ).to.be.revertedWith("Only winner can claim reward");
    });

    it("Should reject claim before game finished", async function () {
      await duelArena.connect(player1).createRoom(MIN_BET, { value: MIN_BET });
      await duelArena.connect(player2).joinRoom(1, { value: MIN_BET });

      await expect(
        duelArena.connect(player1).claimReward(1)
      ).to.be.revertedWith("Game not finished yet");
    });

    it("Should prevent double claiming", async function () {
      await duelArena.connect(player1).claimReward(0);
      await expect(
        duelArena.connect(player1).claimReward(0)
      ).to.be.revertedWith("Only winner can claim reward");
    });
  });

  describe("Treasury Fee", function () {
    it("Should keep 5% in contract", async function () {
      await duelArena.connect(player1).createRoom(MIN_BET, { value: MIN_BET });
      await duelArena.connect(player2).joinRoom(0, { value: MIN_BET });
      await duelArena.connect(player1).finishGame(0, player1.address);

      const contractBalanceBefore = await ethers.provider.getBalance(await duelArena.getAddress());
      await duelArena.connect(player1).claimReward(0);
      const contractBalanceAfter = await ethers.provider.getBalance(await duelArena.getAddress());

      const totalBet = MIN_BET * 2n;
      const expectedFee = (totalBet * 5n) / 100n;
      expect(contractBalanceAfter).to.equal(expectedFee);
    });
  });
});
