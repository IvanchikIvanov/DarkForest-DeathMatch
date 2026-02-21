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

  // Camera — follows player with smooth lerp
  const cameraRef = useRef<{ x: number, y: number }>({ x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 });
  const CAMERA_ZOOM = 2.8; // How much to zoom in (higher = closer)
  const CAMERA_LERP = 0.08; // Smoothing (0-1, lower = smoother)

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
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

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
    if (!selectedBet && walletConnected) {
      showToast('Please select bet amount', 'error');
      return;
    }

    setIsCreatingRoom(true);
    let onChainRoomId: number = -1;
    let actualBet = selectedBet || 0n; // Default to 0 for walletless

    try {
      if (walletConnected) {
        // Read the nextRoomId BEFORE creating, so we know what ID the contract will assign
        const { data: freshNextId } = await refetchNextRoomId();
        if (freshNextId !== undefined) {
          onChainRoomId = Number(freshNextId);
          console.log('On-chain room ID will be:', onChainRoomId);
        }

        const txHash = await contractCreateRoom(actualBet);
        if (txHash) {
          console.log('Room created on-chain, tx:', txHash);
          setRoomContractId(onChainRoomId);
        }
      }
    } catch (error: any) {
      console.error('Error with on-chain room creation:', error);
      // If contract creation fails but they wanted to create one, we should probably stop
      // unless we want to let them fall back to off-chain automatically.
      // For now, let's just log and continue to create the off-chain room for testing.
      showToast('Wallet transaction failed, creating off-chain test room', 'error');
    }

    // Always create the PartyKit room (off-chain) so players can test
    setRoomBetAmount(actualBet);
    const newRoomId = generateRoomId();
    setRoomId(newRoomId);
    partyClientRef.current?.connect(newRoomId);

    // Send room info to game server (which notifies lobby) — include contractRoomId
    const betDisplay = walletConnected ? formatEther(actualBet) + ' ETH' : 'TESTING (No Wager)';
    const creatorName = walletAddress ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}` : 'Anonymous';

    setTimeout(() => {
      partyClientRef.current?.sendRoomInfo(
        Number(actualBet),
        betDisplay,
        creatorName,
        onChainRoomId
      );
    }, 500);

    setIsCreatingRoom(false);
  };

  // Join an open room from the lobby list
  const joinOpenRoom = async (room: OpenRoom) => {
    setIsJoiningRoom(true);

    const betAmount = BigInt(room.betAmount);
    setRoomBetAmount(betAmount);
    setSelectedBet(betAmount);

    try {
      if (walletConnected && room.contractRoomId !== undefined && room.contractRoomId >= 0) {
        setRoomContractId(room.contractRoomId);
        const txHash = await contractJoinRoom(room.contractRoomId, betAmount);
        if (txHash) {
          console.log('Joined room on-chain, tx:', txHash, 'contractRoomId:', room.contractRoomId);
        }
      }
    } catch (error: any) {
      console.error('Error joining on-chain room:', error);
      showToast('Wallet transaction failed, joining off-chain for testing', 'error');
    }

    // Always join the PartyKit room even if contract fails or wallet is not connected
    setRoomId(room.roomId);
    partyClientRef.current?.connect(room.roomId);

    setIsJoiningRoom(false);
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

      // During PLAYING, use camera-aware coordinates
      const baseScale = Math.min(canvasWidth / CANVAS_WIDTH, canvasHeight / CANVAS_HEIGHT);
      const zoom = stateRef.current.status === 'PLAYING' ? CAMERA_ZOOM : 1;
      const totalScale = baseScale * zoom;

      const cam = cameraRef.current;
      // Visible area in world coords
      const viewW = canvasWidth / totalScale;
      const viewH = canvasHeight / totalScale;
      const viewLeft = cam.x - viewW / 2;
      const viewTop = cam.y - viewH / 2;

      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;

      mouseRef.current = {
        x: viewLeft + screenX / totalScale,
        y: viewTop + screenY / totalScale
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

    const baseScaleX = canvasWidth / CANVAS_WIDTH;
    const baseScaleY = canvasHeight / CANVAS_HEIGHT;
    const baseScale = Math.min(baseScaleX, baseScaleY);

    // Camera follows player during gameplay
    const isPlaying = state.status === 'PLAYING' || state.status === 'VICTORY';
    const zoom = isPlaying ? CAMERA_ZOOM : 1;
    const scale = baseScale * zoom;

    // Update camera position — smooth follow player
    if (isPlaying && playerIdRef.current) {
      const me = state.players[playerIdRef.current];
      if (me && me.active) {
        cameraRef.current.x += (me.pos.x - cameraRef.current.x) * CAMERA_LERP;
        cameraRef.current.y += (me.pos.y - cameraRef.current.y) * CAMERA_LERP;
      }
    } else {
      // Menu/lobby: center on map
      cameraRef.current.x = CANVAS_WIDTH / 2;
      cameraRef.current.y = CANVAS_HEIGHT / 2;
    }

    // Clamp camera so we don't see outside the map
    const viewW = canvasWidth / scale;
    const viewH = canvasHeight / scale;
    cameraRef.current.x = Math.max(viewW / 2, Math.min(CANVAS_WIDTH - viewW / 2, cameraRef.current.x));
    cameraRef.current.y = Math.max(viewH / 2, Math.min(CANVAS_HEIGHT - viewH / 2, cameraRef.current.y));

    const cam = cameraRef.current;

    // Calculate where to draw — camera-centered
    const offsetX = canvasWidth / 2 - cam.x * scale;
    const offsetY = canvasHeight / 2 - cam.y * scale;

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

    // Draw Health Pickups - ENHANCED with floating animation and glow
    const healthPickups = state.healthPickups || [];
    const gunPickups = state.gunPickups || [];
    const swordPickups = (state as any).swordPickups || [];

    healthPickups.forEach((hp: any) => {
      if (!hp || !hp.active) return;

      ctx.save();
      ctx.translate(hp.pos.x, hp.pos.y);

      // Floating bob animation
      const bobY = Math.sin(timeRef.current * 3) * 5;
      ctx.translate(0, bobY);

      // Strong pulsing glow effect
      const pulse = 1 + Math.sin(timeRef.current * 4) * 0.2;
      ctx.scale(pulse, pulse);

      // Outer glow ring - multiple layers
      ctx.shadowColor = '#00ff00';
      ctx.shadowBlur = 50;
      ctx.fillStyle = 'rgba(0, 255, 0, 0.15)';
      ctx.beginPath();
      ctx.arc(0, 0, 70, 0, Math.PI * 2);
      ctx.fill();

      // Mid glow
      ctx.shadowBlur = 30;
      ctx.fillStyle = 'rgba(0, 255, 0, 0.4)';
      ctx.beginPath();
      ctx.arc(0, 0, 45, 0, Math.PI * 2);
      ctx.fill();

      // Inner bright circle
      ctx.shadowBlur = 15;
      ctx.fillStyle = '#00ff00';
      ctx.beginPath();
      ctx.arc(0, 0, 30, 0, Math.PI * 2);
      ctx.fill();

      // White center
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, 20, 0, Math.PI * 2);
      ctx.fill();

      // Green cross (health symbol) - with 3D effect
      // Shadow
      ctx.fillStyle = '#006600';
      ctx.fillRect(-45, -10, 90, 20);
      ctx.fillRect(-10, -45, 20, 90);
      // Main
      ctx.fillStyle = '#00ff00';
      ctx.fillRect(-40, -8, 80, 16);
      ctx.fillRect(-8, -40, 16, 80);
      // Highlight
      ctx.fillStyle = '#88ff88';
      ctx.fillRect(-38, -6, 76, 4);
      ctx.fillRect(-6, -38, 4, 76);

      // Sparkle effects
      const sparkleAngle = timeRef.current * 2;
      for (let i = 0; i < 4; i++) {
        const angle = sparkleAngle + (i * Math.PI / 2);
        const sx = Math.cos(angle) * 50;
        const sy = Math.sin(angle) * 50;
        ctx.fillStyle = `rgba(255, 255, 255, ${0.5 + Math.sin(timeRef.current * 5 + i) * 0.3})`;
        ctx.beginPath();
        ctx.arc(sx, sy, 3, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.shadowBlur = 0;
      ctx.restore();
    });

    // Draw Gun Pickups - ENHANCED with detailed golden pistol
    gunPickups.forEach((gp: any) => {
      if (!gp.active) return;
      ctx.save();
      ctx.translate(gp.pos.x, gp.pos.y);

      // Floating animation
      const bobY = Math.sin(timeRef.current * 2.5 + 1) * 4;
      ctx.translate(0, bobY);

      // Slow rotation
      const rot = Math.sin(timeRef.current * 1.5) * 0.15;
      ctx.rotate(rot);

      // Pulsing effect
      const pulse = 1 + Math.sin(timeRef.current * 5) * 0.15;
      ctx.scale(pulse, pulse);

      // Outer glow - multiple layers
      ctx.shadowColor = '#fbbf24';
      ctx.shadowBlur = 40;
      ctx.fillStyle = 'rgba(251, 191, 36, 0.2)';
      ctx.beginPath();
      ctx.arc(0, 0, 50, 0, Math.PI * 2);
      ctx.fill();

      // Mid glow
      ctx.shadowBlur = 25;
      ctx.fillStyle = 'rgba(251, 191, 36, 0.35)';
      ctx.beginPath();
      ctx.arc(0, 0, 35, 0, Math.PI * 2);
      ctx.fill();

      // Gun body - detailed golden pistol
      ctx.fillStyle = '#d97706';
      // Barrel main
      ctx.fillRect(-28, -10, 45, 14);
      // Barrel highlight
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(-26, -8, 41, 4);
      // Muzzle
      ctx.fillStyle = '#92400e';
      ctx.fillRect(17, -8, 8, 10);
      // Grip
      ctx.fillStyle = '#b45309';
      ctx.fillRect(-8, 0, 18, 32);
      ctx.fillRect(-6, 28, 14, 6);
      // Trigger guard
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(5, 10, 10, 0, Math.PI);
      ctx.stroke();
      // Trigger
      ctx.fillStyle = '#78350f';
      ctx.fillRect(3, 8, 4, 8);

      // Decorative lines
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.strokeRect(-28, -10, 45, 14);
      ctx.strokeRect(-8, 0, 18, 32);

      // Sparkle on gun
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.beginPath();
      ctx.arc(-15, -3, 4, 0, Math.PI * 2);
      ctx.fill();

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

    // Draw Sword Pickups - ENHANCED with floating animation and sparkle
    swordPickups.forEach((sp: any) => {
      if (!sp.active) return;
      ctx.save();
      ctx.translate(sp.pos.x, sp.pos.y);

      // Floating animation
      const bobY = Math.sin(timeRef.current * 2.8 + 2) * 5;
      ctx.translate(0, bobY);

      // Slow rotation
      const rot = Math.sin(timeRef.current * 1.2) * 0.2;
      ctx.rotate(Math.PI / 4 + rot);

      // Pulsing effect
      const pulse = 1 + Math.sin(timeRef.current * 5) * 0.15;
      ctx.scale(pulse, pulse);

      // Outer glow - multiple layers
      ctx.shadowColor = '#e5e7eb';
      ctx.shadowBlur = 45;
      ctx.fillStyle = 'rgba(229, 231, 235, 0.15)';
      ctx.beginPath();
      ctx.arc(0, 0, 55, 0, Math.PI * 2);
      ctx.fill();

      // Mid glow
      ctx.shadowBlur = 30;
      ctx.fillStyle = 'rgba(229, 231, 235, 0.35)';
      ctx.beginPath();
      ctx.arc(0, 0, 40, 0, Math.PI * 2);
      ctx.fill();

      // Sword blade - detailed
      ctx.fillStyle = '#71717a';
      ctx.fillRect(-6, -38, 12, 76); // Darker base
      // Main blade
      ctx.fillStyle = '#e5e7eb';
      ctx.fillRect(-5, -36, 10, 72);
      // Blade highlight (left side)
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-4, -34, 3, 65);
      // Blade edge highlight
      ctx.fillStyle = '#d4d4d8';
      ctx.fillRect(2, -34, 2, 65);

      // Blade fuller (blood groove)
      ctx.fillStyle = '#a1a1aa';
      ctx.fillRect(-1, -30, 2, 50);

      // Guard - ornate crossguard
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(-18, 32, 36, 6);
      // Guard decoration
      ctx.fillStyle = '#92400e';
      ctx.fillRect(-16, 31, 4, 8);
      ctx.fillRect(12, 31, 4, 8);
      // Guard highlight
      ctx.fillStyle = '#fcd34d';
      ctx.fillRect(-14, 32, 28, 2);

      // Handle/Grip
      ctx.fillStyle = '#52525b';
      ctx.fillRect(-4, 38, 8, 18);
      // Grip wrapping
      ctx.fillStyle = '#3f3f46';
      for (let i = 0; i < 4; i++) {
        ctx.fillRect(-4, 40 + i * 4, 8, 2);
      }
      // Pommel
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(0, 58, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#92400e';
      ctx.beginPath();
      ctx.arc(0, 58, 3, 0, Math.PI * 2);
      ctx.fill();

      // Sparkle effects around sword
      const sparkleAngle = timeRef.current * 1.5;
      for (let i = 0; i < 3; i++) {
        const angle = sparkleAngle + (i * Math.PI * 2 / 3);
        const sx = Math.cos(angle) * 45;
        const sy = Math.sin(angle) * 45;
        ctx.fillStyle = `rgba(255, 255, 255, ${0.4 + Math.sin(timeRef.current * 4 + i) * 0.3})`;
        ctx.beginPath();
        ctx.arc(sx, sy, 3 + i, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.shadowBlur = 0;
      ctx.restore();
    });

    // Draw Bomb Pickups - ENHANCED with animated fuse and glow
    const bombPickups = (state as any).bombPickups || [];
    bombPickups.forEach((bp: any) => {
      if (!bp.active) return;
      ctx.save();
      ctx.translate(bp.pos.x, bp.pos.y);

      // Floating animation
      const bobY = Math.sin(timeRef.current * 2.2 + 3) * 4;
      ctx.translate(0, bobY);

      // Pulsing effect
      const pulse = 1 + Math.sin(timeRef.current * 5) * 0.15;
      ctx.scale(pulse, pulse);

      // Outer glow - multiple layers
      ctx.shadowColor = '#f97316';
      ctx.shadowBlur = 45;
      ctx.fillStyle = 'rgba(249, 115, 22, 0.15)';
      ctx.beginPath();
      ctx.arc(0, 0, 55, 0, Math.PI * 2);
      ctx.fill();

      // Mid glow
      ctx.shadowBlur = 30;
      ctx.fillStyle = 'rgba(249, 115, 22, 0.35)';
      ctx.beginPath();
      ctx.arc(0, 0, 40, 0, Math.PI * 2);
      ctx.fill();

      // Bomb body - detailed
      // Shadow
      ctx.fillStyle = '#0f0f0f';
      ctx.beginPath();
      ctx.arc(3, 3, 27, 0, Math.PI * 2);
      ctx.fill();
      // Main body
      ctx.fillStyle = '#1f2937';
      ctx.beginPath();
      ctx.arc(0, 0, 26, 0, Math.PI * 2);
      ctx.fill();

      // Bomb highlight (top left)
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.beginPath();
      ctx.arc(-10, -10, 12, 0, Math.PI * 2);
      ctx.fill();

      // Bomb stripe
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(-26, -2, 52, 8);
      ctx.fillStyle = '#fca5a5';
      ctx.fillRect(-26, 0, 52, 2);

      // Bomb neck
      ctx.fillStyle = '#374151';
      ctx.fillRect(-8, -32, 16, 10);

      // Bomb outline
      ctx.strokeStyle = '#4b5563';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 26, 0, Math.PI * 2);
      ctx.stroke();

      // Fuse
      ctx.strokeStyle = '#9ca3af';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(0, -32);
      ctx.quadraticCurveTo(10, -40, 20, -35);
      ctx.stroke();

      // Fuse knot
      ctx.fillStyle = '#6b7280';
      ctx.beginPath();
      ctx.arc(0, -32, 5, 0, Math.PI * 2);
      ctx.fill();

      // Fuse spark (animated)
      const sparkIntensity = 0.5 + Math.sin(timeRef.current * 15) * 0.5;
      const sparkX = 20 + Math.sin(timeRef.current * 3) * 3;
      const sparkY = -35 + Math.cos(timeRef.current * 2.5) * 3;

      // Outer spark glow
      ctx.shadowColor = '#ff6b00';
      ctx.shadowBlur = 15;
      ctx.fillStyle = `rgba(249, 115, 22, ${sparkIntensity * 0.5})`;
      ctx.beginPath();
      ctx.arc(sparkX, sparkY, 10, 0, Math.PI * 2);
      ctx.fill();

      // Main spark
      ctx.fillStyle = `rgba(249, 115, 22, ${sparkIntensity})`;
      ctx.beginPath();
      ctx.arc(sparkX, sparkY, 6, 0, Math.PI * 2);
      ctx.fill();

      // Inner bright core
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(sparkX, sparkY, 3, 0, Math.PI * 2);
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

    // Draw Players — High-End Cyberpunk Procedural Warriors
    Object.values(state.players).forEach(p => {
      if (!p.active) return;
      const isMe = p.playerId === playerIdRef.current;
      const r = p.radius; // 20

      const hasGun = (p as any).hasGun;
      const hasSword = (p as any).hasSword;
      const hasBomb = (p as any).hasBomb;

      // Animation calculations & Physics
      const velMag = Math.sqrt((p.vel?.x || 0) * (p.vel?.x || 0) + (p.vel?.y || 0) * (p.vel?.y || 0));
      const isMoving = velMag > 5;
      const walkCycle = timeRef.current * 14; // Faster run cycle
      const breathe = Math.sin(timeRef.current * 2.5) * 1.5; // active breathing
      const bobY = isMoving ? Math.abs(Math.sin(walkCycle * 0.5)) * -4 : breathe; // Dynamic running bob
      const legSwing = isMoving ? Math.sin(walkCycle) * 0.7 : Math.sin(timeRef.current) * 0.1;
      const armSwing = isMoving ? Math.sin(walkCycle + Math.PI) * 0.6 : Math.sin(timeRef.current * 1.5) * 0.1;

      // Advanced Color Palette
      const primary = isMe ? '#00e5ff' : '#ff003c'; // Brighter neon
      const primaryGlow = isMe ? 'rgba(0,229,255,' : 'rgba(255,0,60,';
      const armorDark = isMe ? '#0a192f' : '#2f0a12';
      const armorMid = isMe ? '#112240' : '#40111a';
      const armorLight = isMe ? '#233554' : '#54232a';
      const armorAccent = isMe ? '#64ffda' : '#ff3366';

      const visorColor = isMe ? '#e6f1ff' : '#ffe6e6';
      const energyCore = isMe ? '#64ffda' : '#ff3366';

      ctx.save();
      ctx.translate(p.pos.x, p.pos.y);
      ctx.rotate(p.angle || 0);

      // === DYNAMIC GROUND SHADOW ===
      ctx.fillStyle = `rgba(0,0,0,${isMoving ? 0.2 : 0.4})`;
      ctx.beginPath();
      // Shadow scales based on vertical bob
      const shadowScale = 1 - (bobY / 10);
      ctx.ellipse(0, r + 12, r * 1.3 * shadowScale, 6 * shadowScale, 0, 0, Math.PI * 2);
      ctx.fill();

      // === MOTION TRAILS (If moving fast) ===
      if (isMoving && velMag > 10) {
        ctx.globalAlpha = 0.3;
        ctx.shadowColor = primary;
        ctx.shadowBlur = 10;
        ctx.fillStyle = primary;
        ctx.beginPath();
        ctx.moveTo(-15, r);
        ctx.lineTo(-25, r + 10);
        ctx.lineTo(-5, r + 5);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(15, r);
        ctx.lineTo(25, r + 10);
        ctx.lineTo(5, r + 5);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
      }

      // === DODGE EFFECT — energetic afterimages ===
      if (p.isDodging) {
        ctx.globalAlpha = 0.4;
        ctx.shadowColor = primary;
        ctx.shadowBlur = 20;

        ctx.fillStyle = primary;
        ctx.beginPath();
        ctx.ellipse(-20, 0, r * 1.1, r * 0.6, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = armorAccent;
        ctx.beginPath();
        ctx.ellipse(-40, 0, r * 0.8, r * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
      }

      // Apply body bounce/bob
      ctx.translate(0, bobY);

      // === ENERGY SCARF / PLASMA CAPE (behind body) ===
      ctx.save();
      const capeWave = Math.sin(timeRef.current * 5) * 0.2;
      const capeFlutter = isMoving ? Math.sin(walkCycle * 0.8) * 0.3 : capeWave;
      ctx.rotate(Math.PI + capeFlutter);

      // Plasma cape gradient
      const capeGrad = ctx.createLinearGradient(0, 0, 0, 50);
      capeGrad.addColorStop(0, armorDark);
      capeGrad.addColorStop(0.5, armorMid);
      capeGrad.addColorStop(1, primary);

      ctx.shadowColor = primary;
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.moveTo(-10, 0);
      // Dynamic flowing control points
      ctx.bezierCurveTo(-15, 20 + Math.sin(timeRef.current * 6) * 4, -8, 35, -2, 45);
      ctx.bezierCurveTo(4, 48 + Math.sin(timeRef.current * 5) * 3, 10, 35, 12, 18 + Math.sin(timeRef.current * 7) * 4);
      ctx.lineTo(10, 0);
      ctx.closePath();
      ctx.fillStyle = capeGrad;
      ctx.fill();

      // Cape energy lines
      ctx.strokeStyle = armorAccent;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-5, 5);
      ctx.bezierCurveTo(-8, 20, -2, 35, 0, 42);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.restore();

      // === CYBERNETIC LEGS ===
      const drawLeg = (offsetX: number, angle: number, isRight: boolean) => {
        ctx.save();
        ctx.translate(offsetX, r * 0.3);
        ctx.rotate(angle);

        // Upper thigh armor
        const thighGrad = ctx.createLinearGradient(-5, 0, 5, 0);
        thighGrad.addColorStop(0, armorDark);
        thighGrad.addColorStop(0.5, armorLight);
        thighGrad.addColorStop(1, armorMid);
        ctx.fillStyle = thighGrad;

        ctx.beginPath();
        ctx.moveTo(-5, -2);
        ctx.lineTo(5, -2);
        ctx.lineTo(4, 15);
        ctx.lineTo(-4, 15);
        ctx.closePath();
        ctx.fill();

        // Mechanical Knee joint (glowing)
        ctx.shadowColor = primary;
        ctx.shadowBlur = 6;
        ctx.fillStyle = armorDark;
        ctx.beginPath();
        ctx.arc(0, 15, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = primary;
        ctx.beginPath();
        ctx.arc(0, 15, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Lower shin armor
        ctx.fillStyle = armorMid;
        ctx.beginPath();
        ctx.moveTo(-4, 15);
        ctx.lineTo(4, 15);
        ctx.lineTo(3, 28);
        ctx.lineTo(-3, 28);
        ctx.closePath();
        ctx.fill();

        // Shin neon accent
        ctx.strokeStyle = armorAccent;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, 18);
        ctx.lineTo(0, 26);
        ctx.stroke();

        // Heavy Boot
        ctx.fillStyle = '#111';
        ctx.beginPath();
        ctx.moveTo(-5, 28);
        ctx.lineTo(5, 28);
        ctx.lineTo(6, 34);
        ctx.lineTo(7, 34); // toe
        ctx.lineTo(-5, 34); // heel
        ctx.closePath();
        ctx.fill();
        // Boot sole glow
        ctx.fillStyle = primary;
        ctx.fillRect(-5, 33, 12, 1.5);

        ctx.restore();
      };

      drawLeg(-7, legSwing, false);   // Left leg
      drawLeg(7, -legSwing, true);    // Right leg

      // === HIGH-TECH TORSO ARMOR ===
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 8;

      // Core torso gradient
      const torsoGrad = ctx.createLinearGradient(-r, 0, r, 0);
      torsoGrad.addColorStop(0, armorDark);
      torsoGrad.addColorStop(0.3, armorMid);
      torsoGrad.addColorStop(0.5, armorLight);
      torsoGrad.addColorStop(0.7, armorMid);
      torsoGrad.addColorStop(1, armorDark);

      // Angled Chest Plate
      ctx.fillStyle = torsoGrad;
      ctx.beginPath();
      ctx.moveTo(-r * 0.8, -r * 0.4); // Top left
      ctx.lineTo(r * 0.8, -r * 0.4);  // Top right
      ctx.lineTo(r * 0.9, r * 0.2);   // Mid right
      ctx.lineTo(r * 0.5, r * 0.5);   // Bottom right angle
      ctx.lineTo(-r * 0.5, r * 0.5);  // Bottom left angle
      ctx.lineTo(-r * 0.9, r * 0.2);  // Mid left
      ctx.closePath();
      ctx.fill();

      // Cybernetic plating details (Abs/Stomach)
      ctx.fillStyle = armorDark;
      ctx.fillRect(-6, 0, 12, r * 0.4);
      ctx.fillStyle = armorMid;
      ctx.fillRect(-4, 2, 8, 4);
      ctx.fillRect(-4, 8, 8, 4);

      // Chest paneling lines
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-r * 0.5, -r * 0.2);
      ctx.lineTo(0, 0);
      ctx.lineTo(r * 0.5, -r * 0.2);
      ctx.stroke();

      // Glowing power lines on armor
      ctx.shadowColor = primary;
      ctx.shadowBlur = 10;
      ctx.strokeStyle = primary;
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.7 + Math.sin(timeRef.current * 4) * 0.3; // Pulsing
      // V-shaped reactor housing
      ctx.beginPath();
      ctx.moveTo(-10, -r * 0.1);
      ctx.lineTo(0, r * 0.1);
      ctx.lineTo(10, -r * 0.1);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;

      // Heavy Utility Belt
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(-r * 0.75, r * 0.45, r * 1.5, 6);
      // Belt pouches
      ctx.fillStyle = armorMid;
      ctx.fillRect(-12, r * 0.43, 6, 8);
      ctx.fillRect(6, r * 0.43, 6, 8);
      // Belt buckle (Energy Cell)
      ctx.fillStyle = armorLight;
      ctx.fillRect(-4, r * 0.42, 8, 10);
      ctx.fillStyle = energyCore;
      ctx.fillRect(-2, r * 0.45, 4, 4);


      // === ARMS & SHOULDERS ===

      // Massive Shoulder Pauldrons
      const drawPauldron = (isRight: boolean) => {
        const sign = isRight ? 1 : -1;
        ctx.fillStyle = armorMid;
        ctx.beginPath();
        // Spiked geometric shoulder
        ctx.moveTo(sign * r * 0.6, -r * 0.5);
        ctx.lineTo(sign * r * 1.1, -r * 0.3);
        ctx.lineTo(sign * r * 0.9, r * 0.1);
        ctx.lineTo(sign * r * 0.5, 0);
        ctx.closePath();
        ctx.fill();

        // Pauldron glowing trim
        ctx.strokeStyle = armorAccent;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(sign * r * 0.6, -r * 0.5);
        ctx.lineTo(sign * r * 1.1, -r * 0.3);
        ctx.stroke();
      };

      const drawArm = (offsetX: number, angle: number, isRight: boolean) => {
        ctx.save();
        ctx.translate(offsetX, -r * 0.15);
        ctx.rotate(angle);

        // Bicep
        ctx.fillStyle = armorDark;
        ctx.fillRect(-4, 0, 8, 12);

        // Mechanical Elbow
        ctx.fillStyle = armorMid;
        ctx.beginPath();
        ctx.arc(0, 12, 4, 0, Math.PI * 2);
        ctx.fill();

        // Armored Forearm (wider)
        ctx.fillStyle = armorLight;
        ctx.beginPath();
        ctx.moveTo(-5, 12);
        ctx.lineTo(5, 12);
        ctx.lineTo(4, 26);
        ctx.lineTo(-4, 26);
        ctx.closePath();
        ctx.fill();

        // Forearm power line
        ctx.fillStyle = primary;
        ctx.fillRect(-1, 14, 2, 8);

        // Cybernetic Hand/Glove
        ctx.fillStyle = '#050505';
        ctx.fillRect(-4, 26, 8, 6);
        // Knuckles
        ctx.fillStyle = armorMid;
        ctx.fillRect(-5, 28, 10, 3);

        ctx.restore();
      };

      // Draw Pauldrons (above arms, below head)
      drawPauldron(false);
      drawPauldron(true);

      // Left Arm (Idle/Swing)
      drawArm(-r * 0.85, armSwing, false);

      // === RIGHT ARM / WEAPONS ===
      const itemSwing = isMoving ? Math.sin(walkCycle + Math.PI) * 0.3 : Math.sin(timeRef.current * 2) * 0.05;

      if (hasGun) {
        ctx.save();
        ctx.translate(r * 0.85, -r * 0.15);
        ctx.rotate(itemSwing * 0.5); // Stiffer arm when holding gun

        // Upper arm & elbow
        ctx.fillStyle = armorDark;
        ctx.fillRect(-4, 0, 8, 10);
        ctx.fillStyle = armorMid;
        ctx.beginPath(); ctx.arc(0, 10, 4, 0, Math.PI * 2); ctx.fill();

        // Forearm aiming forward
        ctx.save();
        ctx.translate(0, 10);
        ctx.rotate(-Math.PI / 2 + itemSwing * 0.2); // Point gun forward

        ctx.fillStyle = armorLight;
        ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(4, 0); ctx.lineTo(3, 14); ctx.lineTo(-3, 14); ctx.closePath(); ctx.fill();

        // Hand
        ctx.fillStyle = '#050505';
        ctx.fillRect(-3, 14, 6, 5);

        // === HEAVY CYBER PISTOL ===
        ctx.save();
        ctx.translate(0, 18);

        // Gun Body (Angular)
        ctx.fillStyle = '#222';
        ctx.beginPath();
        ctx.moveTo(-6, -4);
        ctx.lineTo(25, -4); // Barrel length
        ctx.lineTo(32, 2);  // Angled muzzle
        ctx.lineTo(25, 4);
        ctx.lineTo(-4, 4);
        ctx.closePath();
        ctx.fill();

        // Weapon glowing energy chamber
        ctx.shadowColor = '#00ffff';
        ctx.shadowBlur = 8;
        ctx.fillStyle = '#00ffff';
        ctx.fillRect(5, -2, 10, 3);
        ctx.shadowBlur = 0;

        // Grip & Trigger guard
        ctx.fillStyle = '#111';
        ctx.fillRect(-4, 4, 6, 12);
        ctx.strokeStyle = '#444';
        ctx.lineWidth = 2;
        ctx.strokeRect(2, 4, 6, 4);

        // Muzzle flash / Heat
        ctx.globalAlpha = 0.5 + Math.sin(timeRef.current * 15) * 0.5;
        ctx.fillStyle = 'rgba(0, 255, 255, 0.6)';
        ctx.beginPath(); ctx.arc(33, -1, 4, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;

        ctx.restore(); // out of gun space
        ctx.restore(); // out of forearm space
        ctx.restore(); // out of arm space

      } else if (hasSword) {
        ctx.save();
        ctx.translate(r * 0.85, -r * 0.15);
        ctx.rotate(itemSwing); // Sword swings with running

        // Arm
        ctx.fillStyle = armorDark; ctx.fillRect(-4, 0, 8, 12);
        ctx.fillStyle = armorMid; ctx.beginPath(); ctx.arc(0, 12, 4, 0, Math.PI * 2); ctx.fill();

        ctx.save();
        ctx.translate(0, 12);

        // Attack logic
        if (p.isAttacking) {
          const progress = 1 - ((p as any).attackTimer / 0.2); // 0 to 1
          const swingAngle = -Math.PI / 1.2 + (progress * Math.PI * 1.5); // Wide fierce arc
          ctx.rotate(swingAngle);

          // Sick Energy Trail
          ctx.globalAlpha = 0.4 * (1 - progress);
          ctx.shadowColor = armorAccent;
          ctx.shadowBlur = 15;
          ctx.strokeStyle = armorAccent;
          ctx.lineWidth = 15;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.arc(0, 0, 45, -Math.PI, 0);
          ctx.stroke();
          ctx.globalAlpha = 1;
          ctx.shadowBlur = 0;
        } else {
          ctx.rotate(-Math.PI / 6); // Resting position
        }

        // Forearm
        ctx.fillStyle = armorLight; ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(4, 0); ctx.lineTo(3, 14); ctx.lineTo(-3, 14); ctx.closePath(); ctx.fill();
        // Hand
        ctx.fillStyle = '#050505'; ctx.fillRect(-3, 14, 6, 5);

        // === PLASMA SWORD ===
        ctx.save();
        ctx.translate(0, 18);

        // Hilt
        ctx.fillStyle = '#111';
        ctx.fillRect(-2, -5, 4, 15);
        // Guard (V-shape)
        ctx.fillStyle = armorMid;
        ctx.beginPath(); ctx.moveTo(-10, 10); ctx.lineTo(0, -2); ctx.lineTo(10, 10); ctx.lineTo(0, 5); ctx.closePath(); ctx.fill();

        // Plasma Blade
        ctx.shadowColor = armorAccent;
        ctx.shadowBlur = 20;
        const bladeGrad = ctx.createLinearGradient(0, -60, 0, -5);
        bladeGrad.addColorStop(0, '#ffffff'); // White hot tip
        bladeGrad.addColorStop(0.2, armorAccent);
        bladeGrad.addColorStop(1, 'rgba(255,255,255,0)');

        ctx.fillStyle = bladeGrad;
        ctx.beginPath();
        ctx.moveTo(0, -65); // Sharp tip
        ctx.lineTo(4, -5);  // Base right
        ctx.lineTo(-4, -5); // Base left
        ctx.closePath();
        ctx.fill();

        // Solid core
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = 0.8;
        ctx.beginPath(); ctx.moveTo(0, -60); ctx.lineTo(1, -5); ctx.lineTo(-1, -5); ctx.closePath(); ctx.fill();
        ctx.globalAlpha = 1;

        ctx.shadowBlur = 0;

        ctx.restore(); // sword space
        ctx.restore(); // forearm space
        ctx.restore(); // arm space

      } else if (hasBomb) {
        ctx.save();
        ctx.translate(r * 0.85, -r * 0.15);
        ctx.rotate(itemSwing);

        ctx.fillStyle = armorDark; ctx.fillRect(-4, 0, 8, 12);
        ctx.fillStyle = armorMid; ctx.beginPath(); ctx.arc(0, 12, 4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = armorLight; ctx.beginPath(); ctx.moveTo(-4, 12); ctx.lineTo(4, 12); ctx.lineTo(3, 26); ctx.lineTo(-3, 26); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#050505'; ctx.fillRect(-3, 26, 6, 5);

        // Glowing Cyber-Bomb in hand
        ctx.save();
        ctx.translate(0, 32);
        ctx.shadowColor = '#ff6b00';
        ctx.shadowBlur = 15;

        ctx.fillStyle = '#111';
        ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill();

        // Bomb tech lines
        ctx.strokeStyle = '#ff6b00';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(10, 0); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(0, 10); ctx.stroke();

        // Core glowing
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill();

        ctx.shadowBlur = 0;
        ctx.restore();
        ctx.restore();
      } else {
        // Unarmed Right Arm
        drawArm(r * 0.85, -armSwing, true);
      }


      // === HELMET / HEAD ===
      ctx.save();
      // Head bounce is slightly offset from body bounce for overlaps
      ctx.translate(0, -r * 0.45 - (isMoving ? Math.sin(walkCycle * 0.5) * 2 : 0));

      // Neck seal
      ctx.fillStyle = '#050505';
      ctx.fillRect(-6, -5, 12, 8);

      // Main Helmet Dome (Sleek and angular)
      ctx.fillStyle = armorMid;
      ctx.beginPath();
      ctx.moveTo(-r * 0.6, 5);
      ctx.lineTo(r * 0.6, 5);
      ctx.lineTo(r * 0.55, -r * 0.4);
      ctx.lineTo(r * 0.3, -r * 0.8);
      ctx.lineTo(-r * 0.3, -r * 0.8);
      ctx.lineTo(-r * 0.55, -r * 0.4);
      ctx.closePath();
      ctx.fill();

      // Top ridge (Mohawk style vents)
      ctx.fillStyle = armorDark;
      ctx.beginPath();
      ctx.moveTo(-4, -r * 0.8);
      ctx.lineTo(4, -r * 0.8);
      ctx.lineTo(2, -r * 0.95);
      ctx.lineTo(-2, -r * 0.95);
      ctx.closePath();
      ctx.fill();

      // === VISOR (Glowing LED strip) ===
      ctx.shadowColor = primary;
      ctx.shadowBlur = 15;

      const visorW = r * 1.1;
      const visorH = r * 0.25;

      // Visor dark background
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.moveTo(-visorW / 2, -r * 0.1);
      ctx.lineTo(visorW / 2, -r * 0.1);
      ctx.lineTo(visorW / 2 - 2, r * 0.15);
      ctx.lineTo(-visorW / 2 + 2, r * 0.15);
      ctx.closePath();
      ctx.fill();

      // Glowing optic line (Knight Rider style scan or straight pulse)
      // Scanner dot moves back and forth
      const scanPos = Math.sin(timeRef.current * 4) * (visorW / 2 - 4);

      ctx.fillStyle = primary;
      // Base faint line
      ctx.globalAlpha = 0.4;
      ctx.fillRect(-visorW / 2 + 2, -1, visorW - 4, 2);

      // Bright scanning dot
      ctx.globalAlpha = 1;
      ctx.fillStyle = visorColor;
      ctx.beginPath();
      ctx.arc(scanPos, 0, 2, 0, Math.PI * 2);
      ctx.fill();

      // Additional optic dots (spider eyes)
      ctx.fillStyle = primary;
      ctx.beginPath(); ctx.arc(-visorW / 3, -3, 1.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(visorW / 3, -3, 1.5, 0, Math.PI * 2); ctx.fill();

      ctx.shadowBlur = 0;

      // Jaw/Filter guards
      ctx.fillStyle = armorLight;
      ctx.beginPath();
      ctx.moveTo(-r * 0.4, r * 0.15);
      ctx.lineTo(r * 0.4, r * 0.15);
      ctx.lineTo(r * 0.2, r * 0.35);
      ctx.lineTo(-r * 0.2, r * 0.35);
      ctx.closePath();
      ctx.fill();

      // Breathing vents
      ctx.strokeStyle = '#050505';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(-5, r * 0.25); ctx.lineTo(5, r * 0.25); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-3, r * 0.3); ctx.lineTo(3, r * 0.3); ctx.stroke();

      ctx.restore(); // helmet space

      // === BACKPACK / POWER SUPPLY ===
      ctx.fillStyle = armorDark;
      ctx.fillRect(-r * 0.4, -r * 0.6, r * 0.8, r * 0.5);
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(-r * 0.3, -r * 0.55, r * 0.6, r * 0.4);

      // Backpack exhaust/glow
      ctx.shadowColor = energyCore;
      ctx.shadowBlur = 8;
      ctx.fillStyle = energyCore;
      ctx.globalAlpha = 0.6 + Math.sin(timeRef.current * 8) * 0.4; // Fast pulsing
      ctx.fillRect(-8, -r * 0.5, 4, r * 0.3);
      ctx.fillRect(4, -r * 0.5, 4, r * 0.3);
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;

      ctx.restore(); // End player rotated transform

      // === UI ELEMENTS (world space, not rotated) ===

      // Player name
      ctx.fillStyle = primary;
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#000';
      ctx.shadowBlur = 4;
      ctx.fillText(isMe ? 'YOU' : `P${p.playerId.slice(0, 4)}`, p.pos.x, p.pos.y - r * 2.5);
      ctx.shadowBlur = 0;

      // HP Bar — neon styled
      const hpPercent = (p.hp || 0) / (p.maxHp || 100);
      const hpBarWidth = 50;
      const hpBarHeight = 5;
      const hpBarY = p.pos.y + r + 22;

      // HP bar background
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(p.pos.x - hpBarWidth / 2 - 1, hpBarY - 1, hpBarWidth + 2, hpBarHeight + 2);

      // HP bar fill
      const hpColor = hpPercent > 0.5 ? '#39ff14' : hpPercent > 0.25 ? '#ffd700' : '#ff1744';
      const hpGlow = hpPercent > 0.5 ? 'rgba(57,255,20,0.4)' : hpPercent > 0.25 ? 'rgba(255,215,0,0.4)' : 'rgba(255,23,68,0.4)';
      ctx.shadowColor = hpColor;
      ctx.shadowBlur = 4;
      ctx.fillStyle = hpColor;
      ctx.fillRect(p.pos.x - hpBarWidth / 2, hpBarY, hpBarWidth * hpPercent, hpBarHeight);
      ctx.shadowBlur = 0;

      // HP bar border
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 1;
      ctx.strokeRect(p.pos.x - hpBarWidth / 2 - 1, hpBarY - 1, hpBarWidth + 2, hpBarHeight + 2);

      // Dodge cooldown bar (small, above name)
      const dodgeCooldown = p.cooldown || 0;
      const dodgeBarWidth = 30;
      const dodgeBarY = p.pos.y - r * 2.7;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(p.pos.x - dodgeBarWidth / 2, dodgeBarY, dodgeBarWidth, 3);
      const dodgeReady = 1 - dodgeCooldown;
      ctx.fillStyle = `rgba(255,255,255,${dodgeReady > 0.99 ? 0.8 : 0.3})`;
      ctx.fillRect(p.pos.x - dodgeBarWidth / 2, dodgeBarY, dodgeBarWidth * dodgeReady, 3);

      // Bomb cooldown
      const bombCooldown = (p as any).bombCooldown || 0;
      if (bombCooldown > 0) {
        ctx.fillStyle = 'rgba(236,72,153,0.5)';
        ctx.fillRect(p.pos.x - 15, hpBarY + hpBarHeight + 3, 30 * (1 - bombCooldown / BOMB_COOLDOWN), 2);
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

    // Custom cursor
    if (state.status === 'PLAYING') {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      // Convert world mouse pos back to screen pos
      const mx = (mouseRef.current.x - cam.x) * scale + canvasWidth / 2;
      const my = (mouseRef.current.y - cam.y) * scale + canvasHeight / 2;

      // Crosshair cursor — neon styled
      ctx.strokeStyle = '#ff1744';
      ctx.shadowColor = '#ff1744';
      ctx.shadowBlur = 6;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(mx, my, 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(mx - 16, my);
      ctx.lineTo(mx - 5, my);
      ctx.moveTo(mx + 5, my);
      ctx.lineTo(mx + 16, my);
      ctx.moveTo(mx, my - 16);
      ctx.lineTo(mx, my - 5);
      ctx.moveTo(mx, my + 5);
      ctx.lineTo(mx, my + 16);
      ctx.stroke();
      // Center dot
      ctx.fillStyle = '#fff';
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.arc(mx, my, 2, 0, Math.PI * 2);
      ctx.fill();

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
          <div className="cyber-enter mb-6 text-center relative z-10">
            <h1
              className="text-4xl sm:text-5xl font-extrabold neon-red tracking-[0.15em] glitch-title"
              data-text="DUEL ARENA"
            >
              DUEL ARENA
            </h1>
            <p className="text-[9px] tracking-[0.5em] mt-3" style={{ color: 'rgba(0,255,255,0.3)' }}>
              BLOCKCHAIN COMBAT PROTOCOL
            </p>
            <div className="flex items-center justify-center gap-4 mt-4">
              <div className="flex items-center gap-1.5">
                <Sword size={11} style={{ color: '#ff1744', opacity: 0.6 }} />
                <span className="text-[9px] tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>1v1 COMBAT</span>
              </div>
              <div className="w-px h-3" style={{ background: 'rgba(0,255,255,0.15)' }} />
              <div className="flex items-center gap-1.5">
                <Users size={11} style={{ color: '#0ff', opacity: 0.6 }} />
                <span className="text-[9px] tracking-widest" style={{ color: 'rgba(255,255,255,0.3)' }}>2 PLAYERS MAX</span>
              </div>
            </div>
          </div>

          {!walletConnected && (
            <div className="cyber-enter-d1 mb-4 px-6 py-2 relative z-10" style={{ background: 'rgba(0,255,255,0.04)', border: '1px solid rgba(0,255,255,0.08)' }}>
              <p className="text-[10px] tracking-widest text-center" style={{ color: 'rgba(0,255,255,0.5)' }}>
                WALLET OPTIONAL · CONNECT FOR ON-CHAIN WAGERS
              </p>
            </div>
          )}

          <div className="flex flex-col gap-5 w-[420px] max-w-[95vw] relative z-10">
            {/* Create Arena Section */}
            <div className="cyber-panel p-5 cyber-enter-d1">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-4" style={{ background: '#ff1744' }} />
                  <h2 className="text-xs font-bold tracking-[0.3em] neon-red">CREATE ARENA</h2>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-1" style={{ background: 'rgba(255,23,68,0.06)', border: '1px solid rgba(255,23,68,0.12)' }}>
                  <Users size={10} style={{ color: 'rgba(255,23,68,0.5)' }} />
                  <span className="text-[8px] tracking-widest" style={{ color: 'rgba(255,23,68,0.5)' }}>2P ARENA</span>
                </div>
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
                  <span className="animate-pulse">INITIALIZING ARENA...</span>
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
                    <div className="mb-3">
                      <Sword size={24} style={{ color: 'rgba(255,255,255,0.08)', margin: '0 auto' }} />
                    </div>
                    <p className="text-[10px] tracking-widest" style={{ color: 'rgba(255,255,255,0.2)' }}>
                      NO ACTIVE ARENAS
                    </p>
                    <p className="text-[9px] mt-2" style={{ color: 'rgba(0,255,255,0.2)' }}>
                      CREATE ONE TO BEGIN
                    </p>
                  </div>
                ) : (
                  openRooms.map((room, index) => (
                    <div key={room.roomId} className="room-card flex items-center justify-between p-3">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2">
                          <div className="flex items-center justify-center w-5 h-5 rounded" style={{ background: 'rgba(255,23,68,0.12)', border: '1px solid rgba(255,23,68,0.25)' }}>
                            <Sword size={10} style={{ color: '#ff1744' }} />
                          </div>
                          <span className="font-bold text-[11px]" style={{ color: 'rgba(255,255,255,0.85)' }}>
                            {room.creatorName}&apos;s Arena
                          </span>
                        </div>
                        <div className="flex items-center gap-3 ml-7">
                          <span className="text-[10px] font-bold neon-green">{room.betDisplay}</span>
                          <span className="text-[9px] flex items-center gap-1" style={{ color: 'rgba(0,255,255,0.4)' }}>
                            <Users size={10} /> {room.playerCount}/2
                          </span>
                          {room.playerCount < 2 && (
                            <span className="text-[8px] tracking-wider px-1.5 py-0.5 animate-pulse" style={{ color: '#39ff14', background: 'rgba(57,255,20,0.08)', border: '1px solid rgba(57,255,20,0.15)' }}>
                              OPEN
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => joinOpenRoom(room)}
                        disabled={isJoiningRoom || room.playerCount >= 2}
                        className="cyber-btn cyber-btn-join px-4 py-2 text-[10px] font-bold tracking-widest cursor-pointer"
                      >
                        {isJoiningRoom ? '···' : room.playerCount >= 2 ? 'FULL' : 'JOIN'}
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
                            showToast('Reward claimed successfully!');
                          } else {
                            showToast('Contract not available', 'error');
                          }
                        } catch (error: any) {
                          console.error('Error claiming reward:', error);
                          showToast('Failed to claim reward', 'error');
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

      {/* Toast notification */}
      {toast && (
        <div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[999] cyber-enter font-[monospace]"
          style={{
            background: toast.type === 'success'
              ? 'linear-gradient(135deg, rgba(57,255,20,0.12) 0%, rgba(0,0,0,0.9) 100%)'
              : 'linear-gradient(135deg, rgba(255,23,68,0.12) 0%, rgba(0,0,0,0.9) 100%)',
            border: `1px solid ${toast.type === 'success' ? 'rgba(57,255,20,0.3)' : 'rgba(255,23,68,0.3)'}`,
            clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px))',
            padding: '12px 24px',
            backdropFilter: 'blur(8px)',
          }}
        >
          <span
            className={`text-xs tracking-widest font-bold ${toast.type === 'success' ? 'neon-green' : 'neon-red'}`}
          >
            {toast.message}
          </span>
        </div>
      )}
    </div>
  );
};

export default GameCanvas;
