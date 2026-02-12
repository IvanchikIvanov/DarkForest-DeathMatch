'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { CANVAS_WIDTH, CANVAS_HEIGHT, COLORS, PLAYER_HP, TILE_SIZE, BOMB_COOLDOWN, BOMB_RADIUS } from '../constants';
import { GameState, PlayerInput, Bomb, Obstacle } from '../types';
import { createInitialState, createPlayer } from '../utils/gameLogic';
import { Trophy, Users, Sword, User, Bomb as BombIcon } from 'lucide-react';
import WalletConnect from './WalletConnect';
import BetSelector from './BetSelector';
import { useAccount } from 'wagmi';
import { formatEther } from 'viem';
import { useDuelArena, useNextRoomId, MIN_BET, MAX_BET, TREASURY_FEE_PERCENT } from '../hooks/useDuelArena';
import { PartyClient, LobbyClient, generateRoomId, type OpenRoom } from '../utils/partyClient';

const GameCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number | null>(null);
  const stateRef = useRef<GameState>(createInitialState());

  // Inputs
  const keysRef = useRef<Set<string>>(new Set());
  const mouseRef = useRef<{ x: number, y: number }>({ x: 0, y: 0 });
  const mouseDownRef = useRef<boolean>(false);
  const mouseRightDownRef = useRef<boolean>(false);
  const throwBombRef = useRef<boolean>(false);

  // Animation time for water effects
  const timeRef = useRef<number>(0);

  // PartyKit client
  const partyClientRef = useRef<PartyClient | null>(null);
  const lobbyClientRef = useRef<LobbyClient | null>(null);

  const playerIdRef = useRef<string>('');
  const [playerId, setPlayerId] = useState<string>('');

  const [roomId, setRoomId] = useState<string>('');
  const [isHost, setIsHost] = useState<boolean>(false);

  // UI State
  const [uiState, setUiState] = useState({
    status: 'MENU',
    playerCount: 0,
    assetsLoaded: false,
    winner: ''
  });

  // Lobby — open rooms list
  const [openRooms, setOpenRooms] = useState<OpenRoom[]>([]);

  const [canvasSize, setCanvasSize] = useState({ width: typeof window !== 'undefined' ? window.innerWidth : 800, height: typeof window !== 'undefined' ? window.innerHeight : 600 });

  // Wagmi wallet state
  const { address: walletAddress, isConnected: walletConnected } = useAccount();
  const { createRoom: contractCreateRoom, joinRoom: contractJoinRoom, finishGame: contractFinishGame, claimReward: contractClaimReward, isWriting } = useDuelArena();
  const { data: nextRoomIdData, refetch: refetchNextRoomId } = useNextRoomId();

  const [selectedBet, setSelectedBet] = useState<bigint | null>(null);
  const [roomContractId, setRoomContractId] = useState<number | null>(null);
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [isJoiningRoom, setIsJoiningRoom] = useState(false);
  const [roomBetAmount, setRoomBetAmount] = useState<bigint | null>(null);
  const [gameFinished, setGameFinished] = useState(false);
  const [claimingReward, setClaimingReward] = useState(false);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Assets no longer loaded - all rendering is vector-based
  useEffect(() => {
    setUiState(prev => ({ ...prev, assetsLoaded: true }));
  }, []);

  // --- Initialize PartyKit Client ---
  useEffect(() => {
    const client = new PartyClient({
      onStateUpdate: (state, hostId) => {
        stateRef.current = state;
        setUiState({
          status: state.status,
          playerCount: Object.keys(state.players).length,
          assetsLoaded: true,
          winner: state.winnerId || ''
        });
        if (hostId && playerIdRef.current) {
          setIsHost(hostId === playerIdRef.current);
        }
      },
      onConnect: (id, host) => {
        console.log('[GameCanvas] Connected with ID:', id, 'isHost:', host);
        setPlayerId(id);
        playerIdRef.current = id;
        setIsHost(host);
        setConnectionError(null);
      },
      onClose: () => {
        console.log('[GameCanvas] Disconnected');
        setConnectionError('Connection lost');
      },
      onError: (error) => {
        console.error('[GameCanvas] Error:', error);
        setConnectionError('Connection error');
      }
    });

    partyClientRef.current = client;

    return () => {
      client.disconnect();
    };
  }, []);

  // --- Initialize Lobby Client ---
  useEffect(() => {
    const lobby = new LobbyClient({
      onRoomsUpdate: (rooms) => {
        setOpenRooms(rooms);
      },
    });
    lobby.connect();
    lobbyClientRef.current = lobby;

    return () => {
      lobby.disconnect();
    };
  }, []);

  // Show connect modal if not connected
  useEffect(() => {
    if (!walletConnected) {
      const timer = setTimeout(() => setShowConnectModal(true), 500);
      return () => clearTimeout(timer);
    }
    setShowConnectModal(false);
  }, [walletConnected]);

  const handleWalletConnect = (_address: string) => {
    setShowConnectModal(false);
  };

  const handleWalletDisconnect = () => {
    // wagmi handles state automatically
  };

  const createRoomWithBet = async () => {
    if (!selectedBet) {
      alert('Please select bet amount');
      return;
    }

    setIsCreatingRoom(true);
    let onChainRoomId: number = -1;
    try {
      if (walletConnected) {
        // Read the nextRoomId BEFORE creating, so we know what ID the contract will assign
        const { data: freshNextId } = await refetchNextRoomId();
        if (freshNextId !== undefined) {
          onChainRoomId = Number(freshNextId);
          console.log('On-chain room ID will be:', onChainRoomId);
        }

        const txHash = await contractCreateRoom(selectedBet);
        if (txHash) {
          console.log('Room created on-chain, tx:', txHash);
          setRoomContractId(onChainRoomId);
        }
      }
      setRoomBetAmount(selectedBet);

      const newRoomId = generateRoomId();
      setRoomId(newRoomId);
      partyClientRef.current?.connect(newRoomId);

      // Send room info to game server (which notifies lobby) — include contractRoomId
      const betDisplay = formatEther(selectedBet) + ' ETH';
      const creatorName = walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : 'Anonymous';
      setTimeout(() => {
        partyClientRef.current?.sendRoomInfo(
          Number(selectedBet),
          betDisplay,
          creatorName,
          onChainRoomId
        );
      }, 500);

      setIsCreatingRoom(false);
    } catch (error: any) {
      console.error('Error creating room:', error);
      setIsCreatingRoom(false);
      const newRoomId = generateRoomId();
      setRoomId(newRoomId);
      partyClientRef.current?.connect(newRoomId);
    }
  };

  // Join an open room from the lobby list
  const joinOpenRoom = async (room: OpenRoom) => {
    setIsJoiningRoom(true);
    try {
      const betAmount = BigInt(room.betAmount);
      setRoomBetAmount(betAmount);
      setSelectedBet(betAmount);

      if (walletConnected && room.contractRoomId !== undefined && room.contractRoomId >= 0) {
        setRoomContractId(room.contractRoomId);
        const txHash = await contractJoinRoom(room.contractRoomId, betAmount);
        if (txHash) {
          console.log('Joined room on-chain, tx:', txHash, 'contractRoomId:', room.contractRoomId);
        }
      }

      setRoomId(room.roomId);
      partyClientRef.current?.connect(room.roomId);

      setIsJoiningRoom(false);
    } catch (error: any) {
      console.error('Error joining room:', error);
      setIsJoiningRoom(false);
      // Still join the PartyKit room even if contract fails
      setRoomId(room.roomId);
      partyClientRef.current?.connect(room.roomId);
    }
  };

  const startHostedGame = () => {
    partyClientRef.current?.startGame();
  };

  // --- Input Handlers ---
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    keysRef.current.add(e.key.toLowerCase());
    // E key for bomb
    if (e.key.toLowerCase() === 'e') {
      throwBombRef.current = true;
    }
  }, []);

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    keysRef.current.delete(e.key.toLowerCase());
    if (e.key.toLowerCase() === 'e') {
      throwBombRef.current = false;
    }
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      const canvasWidth = canvasRef.current?.width || 800;
      const canvasHeight = canvasRef.current?.height || 600;
      const scaleX = canvasWidth / CANVAS_WIDTH;
      const scaleY = canvasHeight / CANVAS_HEIGHT;
      const scale = Math.min(scaleX, scaleY);
      const scaledWidth = CANVAS_WIDTH * scale;
      const scaledHeight = CANVAS_HEIGHT * scale;
      const offsetX = (canvasWidth - scaledWidth) / 2;
      const offsetY = (canvasHeight - scaledHeight) / 2;

      const screenX = (e.clientX - rect.left) - offsetX;
      const screenY = (e.clientY - rect.top) - offsetY;

      mouseRef.current = {
        x: screenX / scale,
        y: screenY / scale
      };
    }
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    if (e.button === 0) {
      mouseDownRef.current = true;
    } else if (e.button === 2) {
      mouseRightDownRef.current = true;
    }
  }, []);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) {
      mouseDownRef.current = false;
    } else if (e.button === 2) {
      mouseRightDownRef.current = false;
    }
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  // --- Drawing ---
  const draw = (ctx: CanvasRenderingContext2D, state: GameState) => {
    const canvasWidth = canvasRef.current?.width || 800;
    const canvasHeight = canvasRef.current?.height || 600;

    timeRef.current += 0.016;

    const scaleX = canvasWidth / CANVAS_WIDTH;
    const scaleY = canvasHeight / CANVAS_HEIGHT;
    const scale = Math.min(scaleX, scaleY);

    const scaledWidth = CANVAS_WIDTH * scale;
    const scaledHeight = CANVAS_HEIGHT * scale;
    const offsetX = (canvasWidth - scaledWidth) / 2;
    const offsetY = (canvasHeight - scaledHeight) / 2;

    const shakeX = (Math.random() - 0.5) * state.shake * scale;
    const shakeY = (Math.random() - 0.5) * state.shake * scale;

    ctx.save();
    ctx.translate(offsetX + shakeX, offsetY + shakeY);
    ctx.scale(scale, scale);

    // TileMap - vector style
    if (state.tileMap) {
      for (let y = 0; y < state.tileMap.length; y++) {
        for (let x = 0; x < state.tileMap[y].length; x++) {
          const tileIdx = state.tileMap[y][x];
          const tx = x * TILE_SIZE;
          const ty = y * TILE_SIZE;

          if (tileIdx === 0) {
            // Floor tile - dark zinc with subtle grid
            ctx.fillStyle = '#27272a';
            ctx.fillRect(tx, ty, TILE_SIZE, TILE_SIZE);
            ctx.strokeStyle = '#18181b';
            ctx.lineWidth = 1;
            ctx.strokeRect(tx + 1, ty + 1, TILE_SIZE - 2, TILE_SIZE - 2);
          } else if (tileIdx === 1) {
            // Wall tile
            ctx.fillStyle = '#52525b';
            ctx.fillRect(tx, ty, TILE_SIZE, TILE_SIZE);
            ctx.fillStyle = '#3f3f46';
            ctx.fillRect(tx + 4, ty + 4, TILE_SIZE - 8, 24);
            ctx.fillRect(tx + 4, ty + 34, 26, 24);
            ctx.fillRect(tx + 34, ty + 34, 26, 24);
            ctx.strokeStyle = '#71717a';
            ctx.lineWidth = 1;
            ctx.strokeRect(tx, ty, TILE_SIZE, TILE_SIZE);
          } else if (tileIdx === 2) {
            // Wall top
            ctx.fillStyle = '#71717a';
            ctx.fillRect(tx, ty, TILE_SIZE, TILE_SIZE);
            ctx.fillStyle = '#52525b';
            ctx.fillRect(tx + 4, ty + 4, TILE_SIZE - 8, TILE_SIZE - 8);
            ctx.strokeStyle = '#a1a1aa';
            ctx.lineWidth = 2;
            ctx.strokeRect(tx + 8, ty + 8, TILE_SIZE - 16, TILE_SIZE - 16);
          } else if (tileIdx === 3) {
            // Grass tile - green base with small blade details
            ctx.fillStyle = '#15803d';
            ctx.fillRect(tx, ty, TILE_SIZE, TILE_SIZE);
            // Grass blade details (deterministic from position)
            ctx.fillStyle = '#22c55e';
            const seed = x * 7 + y * 13;
            for (let i = 0; i < 8; i++) {
              const bx = tx + ((seed + i * 17) % 58) + 3;
              const by = ty + ((seed + i * 23) % 54) + 5;
              ctx.fillRect(bx, by, 2, 5);
            }
            ctx.fillStyle = '#4ade80';
            for (let i = 0; i < 4; i++) {
              const bx = tx + ((seed + i * 31) % 56) + 4;
              const by = ty + ((seed + i * 41) % 52) + 6;
              ctx.fillRect(bx, by, 3, 4);
            }
          } else if (tileIdx === 4) {
            // Water tile - blue with animated wave
            ctx.fillStyle = '#1d4ed8';
            ctx.fillRect(tx, ty, TILE_SIZE, TILE_SIZE);
            // Animated wave highlights
            const waveOffset = Math.sin(timeRef.current * 2 + x * 0.5 + y * 0.3) * 3;
            ctx.fillStyle = 'rgba(96, 165, 250, 0.35)';
            ctx.fillRect(tx + 4 + waveOffset, ty + 12, 24, 3);
            ctx.fillRect(tx + 20 - waveOffset, ty + 32, 30, 3);
            ctx.fillRect(tx + 8 + waveOffset, ty + 50, 20, 3);
            // Bright sparkle
            ctx.fillStyle = 'rgba(147, 197, 253, 0.5)';
            ctx.beginPath();
            ctx.arc(
              tx + TILE_SIZE / 2 + waveOffset,
              ty + TILE_SIZE / 2,
              6 + Math.sin(timeRef.current * 3) * 2,
              0, Math.PI * 2
            );
            ctx.fill();
          } else if (tileIdx === 5) {
            // Bush tile - green with clustered circles
            ctx.fillStyle = '#15803d';
            ctx.fillRect(tx, ty, TILE_SIZE, TILE_SIZE);
            ctx.fillStyle = '#22c55e';
            const bseed = x * 11 + y * 19;
            for (let i = 0; i < 6; i++) {
              const cx = tx + ((bseed + i * 13) % 48) + 8;
              const cy = ty + ((bseed + i * 29) % 48) + 8;
              ctx.beginPath();
              ctx.arc(cx, cy, 8 + (i % 3) * 2, 0, Math.PI * 2);
              ctx.fill();
            }
            ctx.fillStyle = '#14532d';
            for (let i = 0; i < 4; i++) {
              ctx.fillRect(tx + ((bseed + i * 7) % 56) + 4, ty + ((bseed + i * 11) % 56) + 4, 4, 4);
            }
          } else if (tileIdx === 6) {
            // Stone tile - gray with cracks
            ctx.fillStyle = '#78716c';
            ctx.fillRect(tx, ty, TILE_SIZE, TILE_SIZE);
            ctx.fillStyle = '#57534e';
            ctx.beginPath();
            ctx.moveTo(tx, ty + 32);
            ctx.lineTo(tx + 20, ty);
            ctx.lineTo(tx + TILE_SIZE, ty);
            ctx.lineTo(tx + TILE_SIZE, ty + 32);
            ctx.lineTo(tx + 44, ty + TILE_SIZE);
            ctx.lineTo(tx, ty + TILE_SIZE);
            ctx.fill();
            ctx.strokeStyle = '#44403c';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(tx + 30, ty);
            ctx.lineTo(tx + 35, ty + 30);
            ctx.lineTo(tx + 25, ty + TILE_SIZE);
            ctx.stroke();
          }
        }
      }
    } else {
      // Fallback: solid floor fill
      ctx.fillStyle = '#27272a';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      // Grid lines
      ctx.strokeStyle = '#18181b';
      ctx.lineWidth = 1;
      for (let gx = 0; gx < CANVAS_WIDTH; gx += TILE_SIZE) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, CANVAS_HEIGHT);
        ctx.stroke();
      }
      for (let gy = 0; gy < CANVAS_HEIGHT; gy += TILE_SIZE) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(CANVAS_WIDTH, gy);
        ctx.stroke();
      }
    }

    // Draw Obstacles - vector style
    if (state.obstacles) {
      state.obstacles.forEach((obs: Obstacle) => {
        if (obs.destroyed) return;

        ctx.save();
        ctx.translate(obs.pos.x, obs.pos.y);

        const r = obs.radius;
        if (obs.obstacleType === 'tree') {
          // Trunk - brown rect
          ctx.fillStyle = '#92400e';
          ctx.fillRect(-r * 0.2, -r * 0.1, r * 0.4, r * 1.2);
          ctx.fillStyle = '#a16207';
          ctx.fillRect(-r * 0.1, -r * 0.1, r * 0.15, r * 1.2);
          // Foliage - overlapping green circles
          ctx.fillStyle = '#15803d';
          ctx.beginPath();
          ctx.arc(-r * 0.4, -r * 0.5, r * 0.6, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(r * 0.4, -r * 0.5, r * 0.6, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#22c55e';
          ctx.beginPath();
          ctx.arc(0, -r * 0.7, r * 0.7, 0, Math.PI * 2);
          ctx.fill();
          // Highlight
          ctx.fillStyle = '#4ade80';
          ctx.beginPath();
          ctx.arc(-r * 0.15, -r * 0.85, r * 0.25, 0, Math.PI * 2);
          ctx.fill();
        } else if (obs.obstacleType === 'rock') {
          // Large gray circle with shadow and highlight
          ctx.fillStyle = '#44403c';
          ctx.beginPath();
          ctx.arc(2, 2, r * 0.9, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#78716c';
          ctx.beginPath();
          ctx.arc(0, 0, r * 0.85, 0, Math.PI * 2);
          ctx.fill();
          // Smaller bump
          ctx.fillStyle = '#57534e';
          ctx.beginPath();
          ctx.arc(-r * 0.3, -r * 0.15, r * 0.45, 0, Math.PI * 2);
          ctx.fill();
          // Highlight
          ctx.fillStyle = '#a8a29e';
          ctx.beginPath();
          ctx.arc(-r * 0.2, -r * 0.3, r * 0.2, 0, Math.PI * 2);
          ctx.fill();
        } else if (obs.obstacleType === 'bush') {
          // Several overlapping green circles
          ctx.fillStyle = '#14532d';
          ctx.beginPath();
          ctx.arc(-r * 0.3, r * 0.1, r * 0.6, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(r * 0.3, r * 0.1, r * 0.6, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#15803d';
          ctx.beginPath();
          ctx.arc(0, -r * 0.15, r * 0.65, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#22c55e';
          ctx.beginPath();
          ctx.arc(-r * 0.15, -r * 0.25, r * 0.35, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(r * 0.2, -r * 0.1, r * 0.3, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      });
    }

    // Draw Bombs - vector style (like bomb pickup)
    if (state.bombs) {
      state.bombs.forEach((bomb: Bomb) => {
        ctx.save();
        ctx.translate(bomb.pos.x, bomb.pos.y);

        // Pulsing effect based on fuse timer
        const pulse = 1 + Math.sin(timeRef.current * 10) * 0.1 * (1 - bomb.fuseTimer / 2);
        ctx.scale(pulse, pulse);

        // Bomb body (dark circle)
        ctx.shadowColor = '#f97316';
        ctx.shadowBlur = 15;
        ctx.fillStyle = '#1f2937';
        ctx.beginPath();
        ctx.arc(0, 0, 25, 0, Math.PI * 2);
        ctx.fill();

        // Bomb outline
        ctx.strokeStyle = '#374151';
        ctx.lineWidth = 3;
        ctx.stroke();

        // Highlight reflection
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.beginPath();
        ctx.arc(-8, -8, 8, 0, Math.PI * 2);
        ctx.fill();

        // Fuse line
        ctx.strokeStyle = '#9ca3af';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(15, -15);
        ctx.lineTo(25, -28);
        ctx.stroke();

        // Fuse spark (flickering)
        const sparkIntensity = 0.5 + Math.sin(timeRef.current * 15) * 0.5;
        ctx.fillStyle = `rgba(249, 115, 22, ${sparkIntensity})`;
        ctx.shadowColor = '#ff6b00';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(25, -28, 5 + Math.random() * 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(25, -28, 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.shadowBlur = 0;

        // Draw danger radius indicator when close to exploding
        if (bomb.fuseTimer < 1) {
          ctx.strokeStyle = `rgba(239, 68, 68, ${0.5 * (1 - bomb.fuseTimer)})`;
          ctx.lineWidth = 2;
          ctx.setLineDash([5, 5]);
          ctx.beginPath();
          ctx.arc(0, 0, BOMB_RADIUS, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        ctx.restore();
      });
    }

    // Draw Health Pickups - HUGE AND SUPER VISIBLE
    const healthPickups = state.healthPickups || [];
    const gunPickups = state.gunPickups || [];
    const swordPickups = (state as any).swordPickups || [];

    healthPickups.forEach((hp: any) => {
      if (!hp || !hp.active) return;
      
      ctx.save();
      ctx.translate(hp.pos.x, hp.pos.y);
      
      // Strong pulsing glow effect
      const pulse = 1 + Math.sin(timeRef.current * 4) * 0.3;
      ctx.scale(pulse, pulse);
      
      // HUGE outer glow circle - bright green
      ctx.shadowColor = '#00ff00';
      ctx.shadowBlur = 60;
      ctx.fillStyle = 'rgba(0, 255, 0, 0.5)';
      ctx.beginPath();
      ctx.arc(0, 0, 80, 0, Math.PI * 2);
      ctx.fill();
      
      // Inner bright circle
      ctx.fillStyle = '#00ff00';
      ctx.beginPath();
      ctx.arc(0, 0, 40, 0, Math.PI * 2);
      ctx.fill();
      
      // Green cross (health symbol) - HUGE
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-50, -12, 100, 24); // Horizontal
      ctx.fillRect(-12, -50, 24, 100); // Vertical
      
      // Red outline for visibility
      ctx.strokeStyle = '#ff0000';
      ctx.lineWidth = 4;
      ctx.strokeRect(-50, -12, 100, 24);
      ctx.strokeRect(-12, -50, 24, 100);
      
      ctx.shadowBlur = 0;
      ctx.restore();
    });

    // Draw Gun Pickups - Golden pistol icon
    // gunPickups already defined above
    gunPickups.forEach((gp: any) => {
      if (!gp.active) return;
      ctx.save();
      ctx.translate(gp.pos.x, gp.pos.y);

      // Pulsing effect
      const pulse = 1 + Math.sin(timeRef.current * 5) * 0.2;
      ctx.scale(pulse, pulse);

      // Outer glow
      ctx.shadowColor = '#fbbf24';
      ctx.shadowBlur = 35;
      ctx.fillStyle = 'rgba(251, 191, 36, 0.3)';
      ctx.beginPath();
      ctx.arc(0, 0, 45, 0, Math.PI * 2);
      ctx.fill();

      // Gun shape (pistol)
      ctx.fillStyle = '#fbbf24';
      // Barrel
      ctx.fillRect(-25, -8, 40, 12);
      // Handle
      ctx.fillRect(-5, -8, 15, 30);
      // Trigger guard
      ctx.fillRect(5, 8, 10, 8);

      // Outline
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.strokeRect(-25, -8, 40, 12);
      ctx.strokeRect(-5, -8, 15, 30);

      ctx.shadowBlur = 0;
      ctx.restore();
    });

    // Draw Bullets - Yellow streaks
    if ((state as any).bullets) {
      (state as any).bullets.forEach((bullet: any) => {
        if (!bullet.active) return;
        ctx.save();
        ctx.translate(bullet.pos.x, bullet.pos.y);

        // Calculate angle from velocity
        const angle = Math.atan2(bullet.vel.y, bullet.vel.x);
        ctx.rotate(angle);

        // Glow
        ctx.shadowColor = '#fbbf24';
        ctx.shadowBlur = 15;

        // Bullet trail
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.ellipse(0, 0, 20, 6, 0, 0, Math.PI * 2);
        ctx.fill();

        // Bright core
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.ellipse(5, 0, 8, 3, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.shadowBlur = 0;
        ctx.restore();
      });
    }

    // Draw Sword Pickups - Silver/white sword icon
    // swordPickups already defined above
    swordPickups.forEach((sp: any) => {
      if (!sp.active) return;
      ctx.save();
      ctx.translate(sp.pos.x, sp.pos.y);

      // Pulsing effect
      const pulse = 1 + Math.sin(timeRef.current * 5) * 0.2;
      ctx.scale(pulse, pulse);

      // Outer glow
      ctx.shadowColor = '#e5e7eb';
      ctx.shadowBlur = 35;
      ctx.fillStyle = 'rgba(229, 231, 235, 0.3)';
      ctx.beginPath();
      ctx.arc(0, 0, 50, 0, Math.PI * 2);
      ctx.fill();

      // Sword shape - vector only
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = '#e5e7eb';
      ctx.fillRect(-5, -35, 10, 70); // Blade
      ctx.strokeStyle = '#a1a1aa';
      ctx.lineWidth = 1;
      ctx.strokeRect(-5, -35, 10, 70);
      // Blade highlight
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-2, -33, 4, 60);
      // Guard
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(-15, 25, 30, 8);
      ctx.strokeStyle = '#92400e';
      ctx.lineWidth = 1;
      ctx.strokeRect(-15, 25, 30, 8);
      // Handle
      ctx.fillStyle = '#52525b';
      ctx.fillRect(-4, 33, 8, 15);

      ctx.shadowBlur = 0;
      ctx.restore();
    });

    // Draw Bomb Pickups - Orange bomb icon
    const bombPickups = (state as any).bombPickups || [];
    bombPickups.forEach((bp: any) => {
      if (!bp.active) return;
      ctx.save();
      ctx.translate(bp.pos.x, bp.pos.y);

      // Pulsing effect
      const pulse = 1 + Math.sin(timeRef.current * 5) * 0.2;
      ctx.scale(pulse, pulse);

      // Outer glow
      ctx.shadowColor = '#f97316';
      ctx.shadowBlur = 35;
      ctx.fillStyle = 'rgba(249, 115, 22, 0.3)';
      ctx.beginPath();
      ctx.arc(0, 0, 50, 0, Math.PI * 2);
      ctx.fill();

      // Bomb body (dark circle)
      ctx.fillStyle = '#1f2937';
      ctx.beginPath();
      ctx.arc(0, 0, 25, 0, Math.PI * 2);
      ctx.fill();

      // Bomb outline
      ctx.strokeStyle = '#374151';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Highlight reflection
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.beginPath();
      ctx.arc(-8, -8, 8, 0, Math.PI * 2);
      ctx.fill();

      // Fuse
      ctx.strokeStyle = '#9ca3af';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(15, -15);
      ctx.lineTo(25, -28);
      ctx.stroke();

      // Fuse spark (flickering animation)
      const sparkIntensity = 0.5 + Math.sin(timeRef.current * 15) * 0.5;
      ctx.fillStyle = `rgba(249, 115, 22, ${sparkIntensity})`;
      ctx.shadowColor = '#ff6b00';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(25, -28, 6, 0, Math.PI * 2);
      ctx.fill();

      // Inner spark glow
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(25, -28, 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.shadowBlur = 0;
      ctx.restore();
    });

    // Draw Thrown Swords - Flying spinning swords
    const thrownSwords = (state as any).thrownSwords || [];
    thrownSwords.forEach((sword: any) => {
      if (!sword.active) return;
      ctx.save();
      ctx.translate(sword.pos.x, sword.pos.y);

      // Calculate angle from velocity and add spin effect
      const angle = Math.atan2(sword.vel.y, sword.vel.x);
      const spin = timeRef.current * 15; // Fast spin
      ctx.rotate(angle + spin);

      // Glow effect
      ctx.shadowColor = '#e5e7eb';
      ctx.shadowBlur = 20;

      // Sword shape - vector only
      ctx.fillStyle = '#e5e7eb';
      ctx.fillRect(-4, -30, 8, 60); // Blade
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-2, -28, 4, 50); // Blade highlight
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(-12, 20, 24, 6); // Guard
      ctx.fillStyle = '#52525b';
      ctx.fillRect(-3, 26, 6, 10); // Handle

      ctx.shadowBlur = 0;
      ctx.restore();
    });

    // Draw Players
    Object.values(state.players).forEach(p => {
      if (!p.active) return;
      const isMe = p.playerId === playerIdRef.current;

      // Weapon - Sword, Gun, or Bomb (one at a time)
      const hasGun = (p as any).hasGun;
      const hasSword = (p as any).hasSword;
      const hasBomb = (p as any).hasBomb;

      // Draw player body (rotated)
      ctx.save();
      ctx.translate(p.pos.x, p.pos.y);
      ctx.rotate(p.angle || 0);

      // Player outline for better visibility
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, p.radius + 2, 0, Math.PI * 2);
      ctx.stroke();

      // Dodge effect
      if (p.isDodging) {
        ctx.globalAlpha = 0.6;
        ctx.fillStyle = COLORS.playerDodge;
        ctx.beginPath();
        ctx.arc(0, 0, p.radius + 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // Player body - vector style (circle body + facing indicator)
      const bodyColor = isMe ? '#3b82f6' : '#ef4444';
      const bodyDark = isMe ? '#1d4ed8' : '#b91c1c';
      const bodyLight = isMe ? '#60a5fa' : '#f87171';

      // Soft ground glow
      ctx.shadowColor = bodyColor;
      ctx.shadowBlur = 18;

      // Main body circle
      ctx.fillStyle = bodyColor;
      ctx.beginPath();
      ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
      ctx.fill();

      // Inner darker circle (armor/visor feel)
      ctx.fillStyle = bodyDark;
      ctx.beginPath();
      ctx.arc(0, 0, p.radius * 0.65, 0, Math.PI * 2);
      ctx.fill();

      // Visor slit
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(-p.radius * 0.5, -p.radius * 0.15, p.radius, p.radius * 0.3);

      // Highlight
      ctx.fillStyle = bodyLight;
      ctx.beginPath();
      ctx.arc(-p.radius * 0.25, -p.radius * 0.35, p.radius * 0.2, 0, Math.PI * 2);
      ctx.fill();

      // Facing direction indicator (small triangle pointing forward)
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(p.radius + 6, 0);
      ctx.lineTo(p.radius - 2, -5);
      ctx.lineTo(p.radius - 2, 5);
      ctx.closePath();
      ctx.fill();

      ctx.shadowBlur = 0;

      // Calculate swing animation based on player velocity
      const velMag = Math.sqrt((p.vel?.x || 0) * (p.vel?.x || 0) + (p.vel?.y || 0) * (p.vel?.y || 0));
      const swingAmount = Math.min(velMag / 500, 1) * 0.3;
      const movingSwing = Math.sin(timeRef.current * 8) * swingAmount;
      const idleSwing = Math.sin(timeRef.current * 2) * 0.1;
      const itemSwing = velMag > 10 ? movingSwing : idleSwing;

      // Only draw weapon if player has one
      if (hasGun) {
        ctx.save();
        ctx.translate(25, 5);
        ctx.rotate(itemSwing);
        ctx.fillStyle = '#fbbf24';
        ctx.shadowColor = '#fbbf24';
        ctx.shadowBlur = 10;
        ctx.fillRect(0, -5, 35, 10);
        ctx.fillRect(-5, -5, 12, 25);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.strokeRect(0, -5, 35, 10);
        ctx.strokeRect(-5, -5, 12, 25);
        ctx.shadowBlur = 0;
        ctx.restore();
      } else if (hasSword) {
        ctx.save();
        ctx.translate(15, -10);
        if (p.isAttacking) {
          const progress = 1 - (p.attackTimer / 0.2);
          const swingAngle = -Math.PI / 2 + (progress * Math.PI);
          ctx.rotate(swingAngle);
          ctx.globalAlpha = 0.4;
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 8;
          ctx.beginPath();
          ctx.arc(0, 0, 60, -Math.PI / 4, Math.PI / 4);
          ctx.stroke();
          ctx.globalAlpha = 1;
        } else {
          ctx.rotate(Math.PI / 4 + itemSwing);
        }
        // Vector sword in hand
        ctx.fillStyle = '#e5e7eb';
        ctx.fillRect(-4, -45, 8, 70); // Blade
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-2, -43, 4, 60); // Blade highlight
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(-12, 18, 24, 6); // Guard
        ctx.fillStyle = '#52525b';
        ctx.fillRect(-3, 24, 6, 12); // Handle
        ctx.restore();

        // Additional swing arc (drawn in player-translated space, outside sword save/restore)
        if (p.isAttacking) {
          ctx.beginPath();
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
          ctx.lineWidth = 4;
          ctx.shadowColor = '#fff';
          ctx.shadowBlur = 8;
          ctx.arc(0, 0, 55, -Math.PI / 2, Math.PI / 3);
          ctx.stroke();
          ctx.shadowBlur = 0;
        }
      } else if (hasBomb) {
        ctx.save();
        ctx.translate(25, 5);
        ctx.rotate(itemSwing);
        ctx.fillStyle = '#1f2937';
        ctx.shadowColor = '#f97316';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(0, 0, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#374151';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.strokeStyle = '#9ca3af';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(12, -10);
        ctx.lineTo(18, -18);
        ctx.stroke();
        const sparkIntensity = 0.5 + Math.sin(timeRef.current * 15) * 0.5;
        ctx.fillStyle = `rgba(249, 115, 22, ${sparkIntensity})`;
        ctx.shadowColor = '#f97316';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(18, -18, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.restore();
      }
      // If no item, player is unarmed (no weapon drawn)

      ctx.restore(); // End player rotated transform

      // UI elements drawn in world space (not rotated)
      // Player name/ID
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#000';
      ctx.shadowBlur = 4;
      ctx.fillText(isMe ? 'YOU' : `P${p.playerId.slice(0, 4)}`, p.pos.x, p.pos.y - 35);
      ctx.shadowBlur = 0;

      // HP Bar
      const hpPercent = (p.hp || 0) / (p.maxHp || 100);
      const hpBarWidth = 44;
      const hpBarHeight = 6;

      ctx.fillStyle = '#1f1f1f';
      ctx.fillRect(p.pos.x - hpBarWidth / 2 - 2, p.pos.y + 22, hpBarWidth + 4, hpBarHeight + 4);

      const hpGradient = ctx.createLinearGradient(p.pos.x - hpBarWidth / 2, 0, p.pos.x + hpBarWidth / 2, 0);
      if (hpPercent > 0.5) {
        hpGradient.addColorStop(0, '#22c55e');
        hpGradient.addColorStop(1, '#4ade80');
      } else if (hpPercent > 0.25) {
        hpGradient.addColorStop(0, '#eab308');
        hpGradient.addColorStop(1, '#facc15');
      } else {
        hpGradient.addColorStop(0, '#dc2626');
        hpGradient.addColorStop(1, '#ef4444');
      }
      ctx.fillStyle = hpGradient;
      ctx.fillRect(p.pos.x - hpBarWidth / 2, p.pos.y + 24, hpBarWidth * hpPercent, hpBarHeight);

      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1;
      ctx.strokeRect(p.pos.x - hpBarWidth / 2 - 1, p.pos.y + 23, hpBarWidth + 2, hpBarHeight + 2);

      // Dodge recovery bar
      const dodgeCooldown = p.cooldown || 0;
      const dodgeBarWidth = 44;
      const dodgeBarY = p.pos.y - 45;
      ctx.fillStyle = '#333';
      ctx.fillRect(p.pos.x - dodgeBarWidth / 2, dodgeBarY, dodgeBarWidth, 4);
      const dodgeReady = 1 - dodgeCooldown;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(p.pos.x - dodgeBarWidth / 2, dodgeBarY, dodgeBarWidth * dodgeReady, 4);
      ctx.strokeStyle = '#666';
      ctx.lineWidth = 1;
      ctx.strokeRect(p.pos.x - dodgeBarWidth / 2, dodgeBarY, dodgeBarWidth, 4);

      // Bomb cooldown indicator
      const bombCooldown = (p as any).bombCooldown || 0;
      if (bombCooldown > 0) {
        ctx.fillStyle = '#ec4899';
        ctx.fillRect(p.pos.x - 15, p.pos.y + 32, 30 * (1 - bombCooldown / BOMB_COOLDOWN), 2);
      }
    });

    // Particles with enhanced effects
    state.particles.forEach(pt => {
      ctx.globalAlpha = pt.life;

      const particleType = (pt as any).particleType;

      if (particleType === 'blood') {
        // BLOOD - big bright red circles with glow
        ctx.save();
        ctx.shadowColor = '#ff0000';
        ctx.shadowBlur = 10;
        ctx.fillStyle = pt.color;
        ctx.beginPath();
        ctx.arc(pt.pos.x, pt.pos.y, pt.radius * 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (particleType === 'explosion') {
        // Explosion particles - larger and brighter
        const explosionSize = pt.radius * 3;
        const gradient = ctx.createRadialGradient(pt.pos.x, pt.pos.y, 0, pt.pos.x, pt.pos.y, explosionSize);
        gradient.addColorStop(0, pt.color);
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(pt.pos.x, pt.pos.y, explosionSize, 0, Math.PI * 2);
        ctx.fill();
      } else if (particleType === 'trail') {
        // Sword trail - white streaks
        ctx.fillStyle = pt.color;
        ctx.fillRect(pt.pos.x - 1, pt.pos.y - 4, 2, 8);
      } else if (particleType === 'water') {
        // Water splash - blue circles
        ctx.fillStyle = pt.color;
        ctx.beginPath();
        ctx.arc(pt.pos.x, pt.pos.y, pt.radius * 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Default particles
        ctx.fillStyle = pt.color;
        ctx.fillRect(pt.pos.x, pt.pos.y, pt.radius * 1.5, pt.radius * 1.5);
      }

      ctx.globalAlpha = 1.0;
    });

    ctx.restore();

    // Vignette
    const vignette = ctx.createRadialGradient(
      canvasWidth / 2, canvasHeight / 2, 0,
      canvasWidth / 2, canvasHeight / 2, Math.max(canvasWidth, canvasHeight) / 1.2
    );
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.6)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // DEBUG overlay - ALWAYS visible - V2
    {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#00ff00';
      ctx.font = 'bold 18px monospace';
      ctx.textAlign = 'left';
      ctx.shadowColor = '#000';
      ctx.shadowBlur = 6;
      const dbgHp = state.healthPickups || [];
      const dbgGp = state.gunPickups || [];
      const dbgSp = (state as any).swordPickups || [];
      const dbgBp = (state as any).bombPickups || [];
      const dbgPlayers = Object.values(state.players);
      ctx.fillText(`[V2] ${state.status} | HP:${dbgHp.length} Gun:${dbgGp.length} Sword:${dbgSp.length} Bomb:${dbgBp.length}`, 10, 25);
      dbgPlayers.forEach((pl: any, i: number) => {
        ctx.fillText(`P${i}: gun=${pl.hasGun} sword=${pl.hasSword} bomb=${pl.hasBomb}`, 10, 50 + i * 24);
      });
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    // Custom cursor
    if (state.status === 'PLAYING') {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const mx = offsetX + mouseRef.current.x * scale;
      const my = offsetY + mouseRef.current.y * scale;

      // Crosshair cursor
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(mx, my, 8, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(mx - 12, my);
      ctx.lineTo(mx - 4, my);
      ctx.moveTo(mx + 4, my);
      ctx.lineTo(mx + 12, my);
      ctx.moveTo(mx, my - 12);
      ctx.lineTo(mx, my - 4);
      ctx.moveTo(mx, my + 4);
      ctx.lineTo(mx, my + 12);
      ctx.stroke();

      ctx.restore();
    }
  };

  // --- Game Loop ---
  const tick = useCallback(() => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    // Send input to server if playing
    if (stateRef.current.status === 'PLAYING' && partyClientRef.current?.isConnected()) {
      partyClientRef.current.sendInput({
        keys: Array.from(keysRef.current),
        mouse: mouseRef.current,
        mouseDown: mouseDownRef.current,
        mouseRightDown: mouseRightDownRef.current,
        throwBomb: throwBombRef.current
      });
      // Reset bomb throw after sending
      throwBombRef.current = false;
    }

    // Handle contract game finish
    if (stateRef.current.status === 'VICTORY' && stateRef.current.winnerId && roomContractId !== null && !gameFinished) {
      setGameFinished(true);
      if (walletAddress && stateRef.current.winnerId === playerIdRef.current) {
        contractFinishGame(roomContractId, walletAddress as `0x${string}`).then((txHash) => {
          if (!txHash) {
            console.warn('Failed to finish game in contract');
          }
        }).catch((err) => {
          console.error('Error finishing game:', err);
        });
      }
    }

    draw(ctx, stateRef.current);
    requestRef.current = requestAnimationFrame(tick);
  }, [roomContractId, walletAddress, gameFinished]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    const handleResize = () => {
      const newSize = { width: window.innerWidth, height: window.innerHeight };
      setCanvasSize(newSize);
      if (canvasRef.current) {
        canvasRef.current.width = newSize.width;
        canvasRef.current.height = newSize.height;
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();

    requestRef.current = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('resize', handleResize);
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [tick, handleKeyDown, handleKeyUp]);


  return (
    <div className={`relative group ${uiState.status === 'PLAYING' ? 'cursor-none' : 'cursor-auto'}`}>
      <canvas
        ref={canvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onContextMenu={handleContextMenu}
        className="w-full h-full border-4 border-zinc-700 bg-black shadow-2xl"
        style={{ display: 'block' }}
      />

      {/* Wallet Connect - Top Right */}
      <div className="absolute top-4 right-4 z-50 pointer-events-auto">
        <WalletConnect onConnect={handleWalletConnect} onDisconnect={handleWalletDisconnect} />
      </div>

      {/* Connection Status */}
      {connectionError && (
        <div className="absolute top-4 left-4 bg-red-900/80 text-red-200 px-3 py-2 rounded text-sm">
          {connectionError}
        </div>
      )}

      {/* CONTROLS HUD */}
      <div className="absolute top-16 right-4 text-xs text-white/50 font-[monospace] flex flex-col gap-1 items-end pointer-events-none">
        <div className="flex items-center gap-2">MOVE <kbd className="bg-zinc-800 p-1 rounded">WASD</kbd></div>
        <div className="flex items-center gap-2">ATTACK/SHOOT <kbd className="bg-zinc-800 p-1 rounded">L-CLICK</kbd></div>
        <div className="flex items-center gap-2 text-gray-300">THROW SWORD <kbd className="bg-zinc-800 p-1 rounded text-gray-300">R-CLICK</kbd></div>
        <div className="flex items-center gap-2">DODGE <kbd className="bg-zinc-800 p-1 rounded">SPACE</kbd></div>
        <div className="flex items-center gap-2 text-pink-400">BOMB <kbd className="bg-zinc-800 p-1 rounded text-pink-400">E</kbd></div>
      </div>

      {/* Connect Wallet Modal */}
      {showConnectModal && !walletConnected && (
        <div className="absolute inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50">
          <div className="cyber-scanlines">
            <div className="cyber-particles" />
          </div>
          <div className="cyber-panel p-8 max-w-md mx-4 cyber-enter relative z-10">
            <div className="flex flex-col items-center mb-6">
              <div className="w-12 h-12 rounded-full border border-cyan-500/30 flex items-center justify-center mb-4" style={{ boxShadow: '0 0 20px rgba(0,255,255,0.15)' }}>
                <div className="w-3 h-3 rounded-full bg-cyan-400 status-dot" />
              </div>
              <h2 className="text-lg font-bold neon-cyan tracking-widest uppercase">CONNECT WALLET</h2>
              <p className="text-[10px] tracking-widest mt-2" style={{ color: 'rgba(0,255,255,0.35)' }}>OPTIONAL · BLOCKCHAIN FEATURES</p>
            </div>
            <p className="text-xs text-center mb-6" style={{ color: 'rgba(255,255,255,0.4)', lineHeight: '1.6' }}>
              Connect for on-chain wagering or play P2P without wallet. Sepolia network added automatically.
            </p>
            <div className="flex flex-col gap-3">
              <WalletConnect onConnect={handleWalletConnect} onDisconnect={handleWalletDisconnect} />
              <button
                onClick={() => setShowConnectModal(false)}
                className="cyber-btn-join px-4 py-3 text-xs tracking-widest uppercase cursor-pointer"
                style={{ clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))' }}
              >
                SKIP · PLAY WITHOUT WALLET
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Menu */}
      {uiState.status === 'MENU' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white font-[monospace] cyber-scanlines" style={{ background: 'radial-gradient(ellipse at 50% 30%, rgba(0,255,255,0.04) 0%, rgba(0,0,0,0.95) 70%)' }}>
          {/* Background effects */}
          <div className="cyber-particles" />
          <div className="digital-rain" />
          <div className="heartbeat-line" />

          {/* Title */}
          <div className="cyber-enter mb-8 text-center relative z-10">
            <h1
              className="text-4xl sm:text-5xl font-extrabold neon-red tracking-[0.15em] glitch-title"
              data-text="DUEL ARENA"
            >
              DUEL ARENA
            </h1>
            <p className="text-[9px] tracking-[0.5em] mt-3" style={{ color: 'rgba(0,255,255,0.3)' }}>
              BLOCKCHAIN COMBAT PROTOCOL
            </p>
          </div>

          {!walletConnected && (
            <div className="cyber-enter-d1 mb-4 px-6 py-2 relative z-10" style={{ background: 'rgba(0,255,255,0.04)', border: '1px solid rgba(0,255,255,0.08)' }}>
              <p className="text-[10px] tracking-widest text-center" style={{ color: 'rgba(0,255,255,0.5)' }}>
                WALLET OPTIONAL · CONNECT FOR ON-CHAIN WAGERS
              </p>
            </div>
          )}

          <div className="flex flex-col gap-5 w-[380px] max-w-[95vw] relative z-10">
            {/* Create Room Section */}
            <div className="cyber-panel p-5 cyber-enter-d1">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-1 h-4" style={{ background: '#ff1744' }} />
                <h2 className="text-xs font-bold tracking-[0.3em] neon-red">CREATE ARENA</h2>
              </div>
              <BetSelector
                onSelect={setSelectedBet}
                selectedBet={selectedBet}
                disabled={isCreatingRoom}
              />
              <button
                onClick={createRoomWithBet}
                disabled={!selectedBet || isCreatingRoom}
                className="cyber-btn w-full mt-4 px-6 py-3 font-bold text-xs tracking-[0.2em] flex items-center justify-center gap-3 cursor-pointer"
              >
                {isCreatingRoom ? (
                  <span className="animate-pulse">INITIALIZING...</span>
                ) : (
                  <>
                    <Sword size={16} /> CREATE ARENA
                  </>
                )}
              </button>
            </div>

            {/* Open Arenas List */}
            <div className="cyber-panel p-5 cyber-enter-d2">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-4" style={{ background: '#0ff' }} />
                  <h2 className="text-xs font-bold tracking-[0.3em] neon-cyan">OPEN ARENAS</h2>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full status-dot" style={{ background: '#39ff14', boxShadow: '0 0 6px #39ff14' }} />
                  <span className="text-[9px] tracking-widest" style={{ color: 'rgba(57,255,20,0.5)' }}>LIVE</span>
                </div>
              </div>
              <div className="flex flex-col gap-2 max-h-60 overflow-y-auto cyber-scroll">
                {openRooms.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-[10px] tracking-widest" style={{ color: 'rgba(255,255,255,0.2)' }}>
                      NO ACTIVE ARENAS
                    </p>
                    <p className="text-[9px] mt-2" style={{ color: 'rgba(0,255,255,0.2)' }}>
                      CREATE ONE TO BEGIN
                    </p>
                  </div>
                ) : (
                  openRooms.map((room) => (
                    <div key={room.roomId} className="room-card flex items-center justify-between p-3">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2">
                          <Sword size={12} style={{ color: '#ff1744' }} />
                          <span className="font-bold text-[11px]" style={{ color: 'rgba(255,255,255,0.8)' }}>{room.roomId}</span>
                          <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.25)' }}>by {room.creatorName}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] font-bold neon-green">{room.betDisplay}</span>
                          <span className="text-[9px] flex items-center gap-1" style={{ color: 'rgba(0,255,255,0.4)' }}>
                            <Users size={10} /> {room.playerCount}/2
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => joinOpenRoom(room)}
                        disabled={isJoiningRoom}
                        className="cyber-btn cyber-btn-join px-4 py-2 text-[10px] font-bold tracking-widest cursor-pointer"
                      >
                        {isJoiningRoom ? '···' : 'JOIN'}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lobby — waiting for opponent */}
      {uiState.status === 'LOBBY' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white font-[monospace] cyber-scanlines" style={{ background: 'radial-gradient(ellipse at 50% 40%, rgba(255,23,68,0.06) 0%, rgba(0,0,0,0.95) 70%)' }}>
          <div className="cyber-particles" />
          <div className="heartbeat-line" />

          <div className="cyber-enter relative z-10 flex flex-col items-center">
            {/* Pulsing sword icon */}
            <div className="mb-6 pulse-border p-6 rounded-full" style={{ background: 'rgba(255,23,68,0.05)' }}>
              <Sword size={40} style={{ color: '#ff1744', filter: 'drop-shadow(0 0 12px rgba(255,23,68,0.6))' }} />
            </div>

            <h2
              className="text-2xl font-bold tracking-[0.3em] mb-2 glitch-title neon-red"
              data-text="WAITING FOR CHALLENGER"
            >
              WAITING FOR CHALLENGER
            </h2>
            <p className="text-[9px] tracking-[0.5em] mb-8" style={{ color: 'rgba(0,255,255,0.3)' }}>
              ARENA INITIALIZED · SCANNING FOR OPPONENTS
            </p>

            {roomBetAmount && (
              <div className="cyber-panel p-4 mb-6 text-center cyber-enter-d1 w-64">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[9px] tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>WAGER</span>
                  <span className="text-[9px] tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>POOL</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold neon-green">{formatEther(roomBetAmount)} ETH</span>
                  <span className="text-lg font-bold neon-cyan">{formatEther(roomBetAmount * 2n)} ETH</span>
                </div>
                <div className="mt-2 pt-2" style={{ borderTop: '1px solid rgba(0,255,255,0.08)' }}>
                  <span className="text-[9px]" style={{ color: 'rgba(57,255,20,0.4)' }}>
                    WINNER TAKES {formatEther(roomBetAmount * 2n - (roomBetAmount * 2n * TREASURY_FEE_PERCENT / 100n))} ETH (95%)
                  </span>
                </div>
              </div>
            )}

            <div className="cyber-enter-d1 mb-6 flex items-center gap-3 px-5 py-3" style={{ background: 'rgba(0,255,255,0.03)', border: '1px solid rgba(0,255,255,0.1)' }}>
              <Users size={16} style={{ color: '#0ff' }} />
              <span className="text-sm tracking-widest neon-cyan">{uiState.playerCount}/2</span>
              <span className="text-[10px] tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>GLADIATORS</span>
            </div>

            {uiState.playerCount >= 2 && (
              <div className="cyber-enter-d2 mb-4 px-6 py-3 text-center" style={{ background: 'rgba(57,255,20,0.05)', border: '1px solid rgba(57,255,20,0.2)' }}>
                <p className="text-sm font-bold neon-green tracking-widest animate-pulse">
                  OPPONENT FOUND · INITIATING COMBAT
                </p>
              </div>
            )}
            {uiState.playerCount < 2 && (
              <p className="text-[10px] tracking-widest animate-pulse" style={{ color: 'rgba(255,255,255,0.2)' }}>
                SCANNING LOBBY FOR OPPONENTS...
              </p>
            )}

            <button
              onClick={() => {
                partyClientRef.current?.disconnect();
                setUiState(prev => ({ ...prev, status: 'MENU', winner: '' }));
              }}
              className="cyber-btn cyber-btn-join mt-8 px-6 py-2 text-[10px] tracking-widest cursor-pointer"
            >
              ABORT MISSION
            </button>
          </div>
        </div>
      )}

      {/* Victory */}
      {uiState.status === 'VICTORY' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white font-[monospace] cyber-scanlines" style={{ background: uiState.winner === playerIdRef.current ? 'radial-gradient(ellipse at 50% 30%, rgba(255,215,0,0.08) 0%, rgba(0,0,0,0.95) 70%)' : 'radial-gradient(ellipse at 50% 30%, rgba(255,23,68,0.08) 0%, rgba(0,0,0,0.95) 70%)' }}>
          <div className="cyber-particles" />

          {uiState.winner === playerIdRef.current ? (
            <div className="cyber-enter flex flex-col items-center relative z-10">
              {/* Victory glow */}
              <div className="victory-flash mb-6 p-5 rounded-full" style={{ background: 'rgba(255,215,0,0.05)' }}>
                <Trophy size={64} style={{ color: '#ffd700', filter: 'drop-shadow(0 0 20px rgba(255,215,0,0.6))' }} />
              </div>

              <h2
                className="text-4xl sm:text-5xl font-extrabold tracking-[0.3em] mb-2 glitch-title neon-gold"
                data-text="VICTORY"
              >
                VICTORY
              </h2>
              <p className="text-[10px] tracking-[0.5em] mb-8" style={{ color: 'rgba(255,215,0,0.4)' }}>
                COMBAT PROTOCOL COMPLETE · CHAMPION
              </p>

              {roomBetAmount && (
                <div className="cyber-panel p-5 mb-6 cyber-enter-d1 w-80">
                  <div className="text-center mb-4">
                    <span className="text-[9px] tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>REWARD BREAKDOWN</span>
                  </div>

                  <div className="flex items-center justify-between mb-2 pb-2" style={{ borderBottom: '1px solid rgba(0,255,255,0.06)' }}>
                    <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>POOL TOTAL</span>
                    <span className="text-sm font-bold neon-cyan">{formatEther(roomBetAmount * 2n)} ETH</span>
                  </div>
                  <div className="flex items-center justify-between mb-2 pb-2" style={{ borderBottom: '1px solid rgba(0,255,255,0.06)' }}>
                    <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>PLATFORM FEE (5%)</span>
                    <span className="text-sm" style={{ color: 'rgba(255,23,68,0.6)' }}>-{formatEther(roomBetAmount * 2n * TREASURY_FEE_PERCENT / 100n)} ETH</span>
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] font-bold neon-green">YOUR REWARD</span>
                    <span className="text-xl font-bold neon-green">{formatEther(roomBetAmount * 2n - (roomBetAmount * 2n * TREASURY_FEE_PERCENT / 100n))} ETH</span>
                  </div>

                  {roomContractId !== null && (
                    <button
                      onClick={async () => {
                        if (roomContractId === null) return;
                        setClaimingReward(true);
                        try {
                          const txHash = await contractClaimReward(roomContractId);
                          if (txHash) {
                            alert('Reward claimed successfully!');
                          } else {
                            alert('Contract not available. Reward cannot be claimed.');
                          }
                        } catch (error: any) {
                          console.error('Error claiming reward:', error);
                          alert('Failed to claim reward');
                        } finally {
                          setClaimingReward(false);
                        }
                      }}
                      disabled={claimingReward}
                      className="cyber-btn w-full mt-4 px-6 py-3 font-bold text-xs tracking-[0.2em] flex items-center justify-center gap-3 cursor-pointer"
                    >
                      {claimingReward ? (
                        <span className="animate-pulse">CLAIMING...</span>
                      ) : (
                        'CLAIM REWARD'
                      )}
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="cyber-enter flex flex-col items-center relative z-10">
              <div className="mb-6 p-5 rounded-full" style={{ background: 'rgba(255,23,68,0.05)' }}>
                <User size={64} style={{ color: '#ff1744', filter: 'drop-shadow(0 0 15px rgba(255,23,68,0.4))', opacity: 0.6 }} />
              </div>

              <h2
                className="text-4xl sm:text-5xl font-extrabold tracking-[0.3em] mb-2 glitch-title neon-red"
                data-text="DEFEATED"
              >
                DEFEATED
              </h2>
              <p className="text-[10px] tracking-[0.5em] mb-4" style={{ color: 'rgba(255,23,68,0.4)' }}>
                COMBAT PROTOCOL TERMINATED
              </p>

              {roomBetAmount && (
                <div className="cyber-panel p-4 mb-6 cyber-enter-d1 w-72 text-center">
                  <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>FUNDS LOST</span>
                  <div className="text-lg font-bold mt-1" style={{ color: 'rgba(255,23,68,0.7)' }}>-{formatEther(roomBetAmount)} ETH</div>
                </div>
              )}
            </div>
          )}

          <button
            onClick={() => {
              partyClientRef.current?.disconnect();
              setUiState(prev => ({ ...prev, status: 'MENU', winner: '' }));
            }}
            className="cyber-btn cyber-btn-join mt-4 px-8 py-3 text-[10px] font-bold tracking-widest cursor-pointer relative z-10"
          >
            BACK TO LOBBY
          </button>
        </div>
      )}
    </div>
  );
};

export default GameCanvas;
