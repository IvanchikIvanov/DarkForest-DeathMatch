import { ethers } from 'ethers';
import { getSigner } from './web3';
import DuelArenaABI from '../artifacts/contracts/DuelArena.sol/DuelArena.json';

const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS || '';

export const getContract = async (): Promise<ethers.Contract | null> => {
  if (!CONTRACT_ADDRESS) {
    // Contract is optional, no error needed
    return null;
  }

  const signer = await getSigner();
  if (!signer) {
    // Signer not available, contract is optional
    return null;
  }

  return new ethers.Contract(CONTRACT_ADDRESS, DuelArenaABI.abi, signer);
};

export const createContractRoom = async (betAmount: bigint): Promise<number | null> => {
  const contract = await getContract();
  if (!contract) {
    // Contract is optional, silently skip
    return null;
  }

  try {
    const tx = await contract.createRoom(betAmount, { value: betAmount });
    const receipt = await tx.wait();
    
    // Find RoomCreated event
    const event = receipt.logs.find((log: any) => {
      try {
        const parsed = contract.interface.parseLog(log);
        return parsed?.name === 'RoomCreated';
      } catch {
        return false;
      }
    });

    if (event) {
      const parsed = contract.interface.parseLog(event);
      return Number(parsed?.args[0]); // roomId
    }

    console.warn('RoomCreated event not found');
    return null;
  } catch (error: any) {
    console.error('Error creating room:', error);
    return null;
  }
};

export const joinRoom = async (roomId: number, betAmount: bigint): Promise<boolean> => {
  const contract = await getContract();
  if (!contract) {
    // Contract is optional, silently skip
    return false;
  }

  try {
    const tx = await contract.joinRoom(roomId, { value: betAmount });
    await tx.wait();
    return true;
  } catch (error: any) {
    console.error('Error joining room:', error);
    return false;
  }
};

export const finishGame = async (roomId: number, winnerAddress: string): Promise<boolean> => {
  const contract = await getContract();
  if (!contract) {
    // Contract is optional, silently skip
    return false;
  }

  try {
    const tx = await contract.finishGame(roomId, winnerAddress);
    await tx.wait();
    return true;
  } catch (error: any) {
    console.error('Error finishing game:', error);
    return false;
  }
};

export const claimReward = async (roomId: number): Promise<boolean> => {
  const contract = await getContract();
  if (!contract) {
    // Contract is optional, silently skip
    return false;
  }

  try {
    const tx = await contract.claimReward(roomId);
    await tx.wait();
    return true;
  } catch (error: any) {
    console.error('Error claiming reward:', error);
    return false;
  }
};

export const getRoom = async (roomId: number) => {
  const contract = await getContract();
  if (!contract) {
    // Contract is optional, return null instead of throwing
    return null;
  }

  try {
    const room = await contract.getRoom(roomId);
    return {
      roomId,
      creator: room.creator,
      challenger: room.challenger,
      betAmount: room.betAmount.toString(),
      gameFinished: room.gameFinished,
      winner: room.winner,
      createdAt: Number(room.createdAt),
    };
  } catch (error: any) {
    console.error('Error getting room:', error);
    return null;
  }
};

export const getRoomBetAmount = async (roomId: number): Promise<bigint | null> => {
  const contract = await getContract();
  if (!contract) {
    // Contract is optional, silently skip
    return null;
  }

  try {
    const betAmount = await contract.getRoomBetAmount(roomId);
    return betAmount;
  } catch (error: any) {
    console.error('Error getting room bet amount:', error);
    return null;
  }
};

