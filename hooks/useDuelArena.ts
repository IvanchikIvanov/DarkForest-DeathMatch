'use client';

import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther, type Address } from 'viem';
import { base } from 'wagmi/chains';

// DuelArena contract ABI (minimal, only the functions we use)
const DUEL_ARENA_ABI = [
  {
    name: 'createRoom',
    type: 'function',
    stateMutability: 'payable',
    inputs: [{ name: 'betAmount', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'joinRoom',
    type: 'function',
    stateMutability: 'payable',
    inputs: [{ name: 'roomId', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'finishGame',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'roomId', type: 'uint256' },
      { name: 'winner', type: 'address' },
    ],
    outputs: [],
  },
  {
    name: 'claimReward',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'roomId', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'getRoom',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'roomId', type: 'uint256' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'creator', type: 'address' },
          { name: 'challenger', type: 'address' },
          { name: 'betAmount', type: 'uint256' },
          { name: 'gameFinished', type: 'bool' },
          { name: 'winner', type: 'address' },
          { name: 'createdAt', type: 'uint256' },
          { name: 'exists', type: 'bool' },
        ],
      },
    ],
  },
  {
    name: 'getRoomBetAmount',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'roomId', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'nextRoomId',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'MIN_BET',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'MAX_BET',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    event: 'RoomCreated',
    type: 'event',
    inputs: [
      { name: 'roomId', type: 'uint256', indexed: true },
      { name: 'creator', type: 'address', indexed: true },
      { name: 'betAmount', type: 'uint256', indexed: false },
    ],
  },
] as const;

// Contract address from env - deployed on Base mainnet
const CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '') as Address;

export const MIN_BET = parseEther('0.001');
export const MAX_BET = parseEther('0.005');
export const TREASURY_FEE_PERCENT = 5n;

export function useDuelArena() {
  const { address: account } = useAccount();
  const { writeContractAsync, data: txHash, isPending: isWriting } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const contractReady = !!CONTRACT_ADDRESS;

  const createRoom = async (betAmount: bigint): Promise<string | null> => {
    if (!contractReady || !account) return null;
    try {
      const hash = await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: DUEL_ARENA_ABI,
        functionName: 'createRoom',
        args: [betAmount],
        value: betAmount,
        chain: base,
        account,
      });
      return hash;
    } catch (error) {
      console.error('Error creating room:', error);
      return null;
    }
  };

  const joinRoom = async (roomId: number, betAmount: bigint): Promise<string | null> => {
    if (!contractReady || !account) return null;
    try {
      const hash = await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: DUEL_ARENA_ABI,
        functionName: 'joinRoom',
        args: [BigInt(roomId)],
        value: betAmount,
        chain: base,
        account,
      });
      return hash;
    } catch (error) {
      console.error('Error joining room:', error);
      return null;
    }
  };

  const finishGame = async (roomId: number, winner: Address): Promise<string | null> => {
    if (!contractReady || !account) return null;
    try {
      const hash = await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: DUEL_ARENA_ABI,
        functionName: 'finishGame',
        args: [BigInt(roomId), winner],
        chain: base,
        account,
      });
      return hash;
    } catch (error) {
      console.error('Error finishing game:', error);
      return null;
    }
  };

  const claimReward = async (roomId: number): Promise<string | null> => {
    if (!contractReady || !account) return null;
    try {
      const hash = await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: DUEL_ARENA_ABI,
        functionName: 'claimReward',
        args: [BigInt(roomId)],
        chain: base,
        account,
      });
      return hash;
    } catch (error) {
      console.error('Error claiming reward:', error);
      return null;
    }
  };

  return {
    createRoom,
    joinRoom,
    finishGame,
    claimReward,
    contractReady,
    isWriting,
    isConfirming,
    isConfirmed,
    txHash,
  };
}

export function useNextRoomId() {
  return useReadContract({
    address: CONTRACT_ADDRESS,
    abi: DUEL_ARENA_ABI,
    functionName: 'nextRoomId',
    query: { enabled: !!CONTRACT_ADDRESS, refetchInterval: 5000 },
  });
}

export function useRoomBetAmount(roomId: number | undefined) {
  return useReadContract({
    address: CONTRACT_ADDRESS,
    abi: DUEL_ARENA_ABI,
    functionName: 'getRoomBetAmount',
    args: roomId !== undefined ? [BigInt(roomId)] : undefined,
    query: { enabled: !!CONTRACT_ADDRESS && roomId !== undefined },
  });
}

export function useRoom(roomId: number | undefined) {
  return useReadContract({
    address: CONTRACT_ADDRESS,
    abi: DUEL_ARENA_ABI,
    functionName: 'getRoom',
    args: roomId !== undefined ? [BigInt(roomId)] : undefined,
    query: { enabled: !!CONTRACT_ADDRESS && roomId !== undefined },
  });
}
