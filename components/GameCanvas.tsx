'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { CANVAS_WIDTH, CANVAS_HEIGHT, COLORS, PLAYER_HP, TILE_SIZE, BOMB_COOLDOWN, BOMB_RADIUS, CTF_MATCH_DURATION, CTF_BASE_RADIUS } from '../constants';
import { GameState, PlayerInput, Bomb, Obstacle, Unicorn, Satan, ShurikenPickup, ShurikenProjectile, BurningGrenadePickup, BurningGrenade, FireZone, MinigunPickup, ElectricPanel, Flag } from '../types';
import { createInitialState, createPlayer } from '../utils/gameLogic';
import { Trophy, Users, Sword, User, Bomb as BombIcon, BookOpen, Medal } from 'lucide-react';
import { PartyClient, LobbyClient, generateRoomId, type OpenRoom } from '../utils/partyClient';
import MenuBackgroundCanvas, { type MenuBackgroundCanvasRef } from './MenuBackgroundCanvas';

const GameCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number | null>(null);
  const stateRef = useRef<GameState>(createInitialState());

  // Inputs
  const keysRef = useRef<Set<string>>(new Set());
  const mouseRef = useRef<{ x: number, y: number }>({ x: 0, y: 0 });
  const mouseDownRef = useRef<boolean>(false);
  const mouseRightDownRef = useRef<boolean>(false);

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
  interface UiState {
    status: 'MENU' | 'HERO_SELECT' | 'LOBBY' | 'PLAYING' | 'VICTORY';
    winner: string;
    winnerTeamId?: 0 | 1 | null;
    playerCount: number;
    actionParams?: { type: 'create' } | { type: 'join', room: OpenRoom };
  }
  const [uiState, setUiState] = useState<UiState>({
    status: 'MENU',
    playerCount: 0,
    winner: ''
  });

  // Lobby — open rooms list
  const [openRooms, setOpenRooms] = useState<OpenRoom[]>([]);

  const [canvasSize, setCanvasSize] = useState({ width: typeof window !== 'undefined' ? window.innerWidth : 800, height: typeof window !== 'undefined' ? window.innerHeight : 600 });

  const [createRoomMaxPlayers, setCreateRoomMaxPlayers] = useState(2);
  const [createRoomGameMode, setCreateRoomGameMode] = useState<'deathmatch' | 'ctf'>('deathmatch');
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [isJoiningRoom, setIsJoiningRoom] = useState(false);
  const pendingRoomInfoRef = useRef<{ creatorName: string; maxPlayers: number; gameMode: 'deathmatch' | 'ctf' } | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [showRules, setShowRules] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboard, setLeaderboard] = useState<{ rank?: number; playerId?: string; ogpId?: string; points?: number;[k: string]: unknown }[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const playFunSdkRef = useRef<any>(null);
  const menuBgRef = useRef<MenuBackgroundCanvasRef>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const fetchLeaderboard = useCallback(async () => {
    setLeaderboardLoading(true);
    try {
      const res = await fetch('/api/leaderboard');
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed');
      setLeaderboard(Array.isArray(data) ? data : []);
    } catch {
      setLeaderboard([]);
    } finally {
      setLeaderboardLoading(false);
    }
  }, []);

  // Assets no longer loaded - all rendering is vector-based

  const lastUiStateRef = useRef<{ status: string; playerCount: number; winner: string; winnerTeamId?: number | null } | null>(null);

  // --- Initialize PartyKit Client ---
  useEffect(() => {
    const client = new PartyClient({
      onStateUpdate: (state, hostId) => {
        stateRef.current = { ...state, tileMap: state.tileMap ?? stateRef.current?.tileMap };
        const pc = Object.keys(state.players).length;
        const w = state.winnerId || '';
        const wt = (state as any).winnerTeamId;
        const next = { status: state.status, playerCount: pc, winner: w, winnerTeamId: wt };
        const prev = lastUiStateRef.current;
        if (!prev || prev.status !== next.status || prev.playerCount !== next.playerCount || prev.winner !== next.winner || prev.winnerTeamId !== next.winnerTeamId) {
          lastUiStateRef.current = next;
          setUiState(u => ({ ...u, ...next }));
        }
        if (hostId && playerIdRef.current) {
          setIsHost(hostId === playerIdRef.current);
        }
      },
      onConnect: (id, host) => {
        console.log('[GameCanvas] onConnect id=', id, 'host=', host, 'pendingRoomInfo=', !!pendingRoomInfoRef.current);
        setPlayerId(id);
        playerIdRef.current = id;
        setIsHost(host);
        setConnectionError(null);
        if (host && pendingRoomInfoRef.current) {
          const p = pendingRoomInfoRef.current;
          partyClientRef.current?.sendRoomInfo(p.creatorName, p.maxPlayers, p.gameMode);
          pendingRoomInfoRef.current = null;
        } else {
          console.log('[GameCanvas] NOT sending roomInfo: host=', host, 'hasPending=', !!pendingRoomInfoRef.current);
        }
        const token = playFunSdkRef.current?.sessionToken;
        if (token) partyClientRef.current?.sendAuthSession(token);
        playFunSdkRef.current?.refreshPointsAndMultiplier?.();
      },
      onClose: () => {
        console.log('[GameCanvas] Disconnected');
        setConnectionError('Connection lost');
      },
      onOpen: () => {
        setConnectionError(null);
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

  // --- Initialize Play Fun SDK ---
  useEffect(() => {
    const GAME_ID = process.env.NEXT_PUBLIC_PLAYFUN_GAME_ID;
    if (!GAME_ID) return;

    import('@playdotfun/game-sdk').then(({ default: OpenGameSDK }) => {
      const sdk = new OpenGameSDK({ ui: { usePointsWidget: true } });
      playFunSdkRef.current = sdk;
      sdk.init({ gameId: GAME_ID }).then(() => {
        const token = sdk.sessionToken;
        if (token && partyClientRef.current?.isConnected()) {
          partyClientRef.current.sendAuthSession(token);
        }
      });
      sdk.on?.('LoginSuccess' as any, () => {
        const token = sdk.sessionToken;
        if (token && partyClientRef.current?.isConnected()) {
          partyClientRef.current.sendAuthSession(token);
        }
      });
      return () => {
        playFunSdkRef.current = null;
      };
    });
  }, []);

  // --- Refresh Play Fun points on VICTORY and periodically in LOBBY/PLAYING ---
  const prevStatusRef = useRef(uiState.status);
  useEffect(() => {
    if (prevStatusRef.current !== 'VICTORY' && uiState.status === 'VICTORY') {
      playFunSdkRef.current?.refreshPointsAndMultiplier?.();
    }
    prevStatusRef.current = uiState.status;
  }, [uiState.status]);
  useEffect(() => {
    if (uiState.status !== 'LOBBY' && uiState.status !== 'PLAYING') return;
    const iv = setInterval(() => playFunSdkRef.current?.refreshPointsAndMultiplier?.(), 15000);
    return () => clearInterval(iv);
  }, [uiState.status]);

  // --- Initialize Lobby Client ---
  useEffect(() => {
    const lobby = new LobbyClient({
      onRoomsUpdate: (rooms) => {
        console.log('[GameCanvas] onRoomsUpdate', rooms.length, rooms.map(r => r.roomId));
        setOpenRooms(rooms);
      },
    });
    lobby.connect();
    lobbyClientRef.current = lobby;

    return () => {
      lobby.disconnect();
    };
  }, []);

  const createRoom = () => {
    setIsCreatingRoom(true);
    const newRoomId = generateRoomId();
    setRoomId(newRoomId);
    const creatorName = 'Anonymous';
    pendingRoomInfoRef.current = { creatorName, maxPlayers: createRoomMaxPlayers, gameMode: createRoomGameMode };
    console.log('[GameCanvas] createRoom roomId=', newRoomId);
    partyClientRef.current?.connect(newRoomId, selectedHero);
    setTimeout(() => {
      if (pendingRoomInfoRef.current && partyClientRef.current?.isConnected()) {
        const p = pendingRoomInfoRef.current;
        partyClientRef.current.sendRoomInfo(p.creatorName, p.maxPlayers, p.gameMode);
        pendingRoomInfoRef.current = null;
      }
    }, 800);
    setIsCreatingRoom(false);
  };

  const joinOpenRoom = (room: OpenRoom) => {
    setIsJoiningRoom(true);
    setRoomId(room.roomId);
    partyClientRef.current?.connect(room.roomId, selectedHero);
    setIsJoiningRoom(false);
  };

  const startHostedGame = () => {
    partyClientRef.current?.startGame();
  };

  // State for hero selection
  const [selectedHero, setSelectedHero] = useState<'kenny' | 'cartman' | 'kyle' | 'stanNinja' | 'snoopDogg' | 'superhero'>('cartman');
  const heroPreviewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const uiStateRef = useRef(uiState);
  const selectedHeroRef = useRef(selectedHero);
  uiStateRef.current = uiState;
  selectedHeroRef.current = selectedHero;

  const HERO_ORDER: ('kenny' | 'cartman' | 'kyle' | 'stanNinja' | 'snoopDogg' | 'superhero')[] = ['kenny', 'cartman', 'kyle', 'stanNinja', 'snoopDogg', 'superhero'];

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const k = e.key.toLowerCase();
    keysRef.current.add(k);
    if (uiState.status === 'PLAYING') {
      if (['w', 'a', 's', 'd', ' '].includes(k)) e.preventDefault();
    }
    if (uiState.status === 'HERO_SELECT') {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const idx = HERO_ORDER.indexOf(selectedHero);
        setSelectedHero(HERO_ORDER[(idx - 1 + HERO_ORDER.length) % HERO_ORDER.length]);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        const idx = HERO_ORDER.indexOf(selectedHero);
        setSelectedHero(HERO_ORDER[(idx + 1) % HERO_ORDER.length]);
      }
    }
  }, [uiState.status, selectedHero]);

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    keysRef.current.delete(e.key.toLowerCase());
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
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

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    if (e.button === 0) {
      mouseDownRef.current = true;
    } else if (e.button === 2) {
      mouseRightDownRef.current = true;
    }
    // Capture pointer so we receive pointerup even when cursor leaves canvas (e.g. during WASD + click)
    if (canvasRef.current && 'setPointerCapture' in canvasRef.current) {
      (canvasRef.current as HTMLElement).setPointerCapture(e.pointerId);
    }
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
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
          } else if (tileIdx === 7) {
            // Street tile - Asphalt with texture
            ctx.fillStyle = '#3f3f46'; // zinc-700
            ctx.fillRect(tx, ty, TILE_SIZE, TILE_SIZE);
            // Asphalt noise dots
            ctx.fillStyle = '#27272a'; // zinc-800
            const seed = x * 11 + y * 17;
            for (let i = 0; i < 15; i++) {
              ctx.fillRect(tx + ((seed + i * 29) % Math.floor(TILE_SIZE)), ty + ((seed + i * 31) % Math.floor(TILE_SIZE)), 2, 2);
            }
            // Yellow dashed line in the middle occasionally
            if (y % 2 === 0 && x % 4 !== 0) { // arbitrary pattern
              ctx.fillStyle = '#facc15';
              ctx.fillRect(tx + TILE_SIZE / 2 - 2, ty + 10, 4, TILE_SIZE - 20);
            }
          } else if (tileIdx === 8) {
            // Sidewalk tile
            ctx.fillStyle = '#a1a1aa'; // zinc-400
            ctx.fillRect(tx, ty, TILE_SIZE, TILE_SIZE);
            // Concrete cracks/lines
            ctx.strokeStyle = '#71717a'; // zinc-500
            ctx.lineWidth = 2;
            ctx.strokeRect(tx, ty, TILE_SIZE, TILE_SIZE);
          } else if (tileIdx === 9) {
            // Indoor Floor - Wood planks
            ctx.fillStyle = '#854d0e'; // yellow-800
            ctx.fillRect(tx, ty, TILE_SIZE, TILE_SIZE);
            ctx.strokeStyle = '#451a03'; // dark wood lines
            ctx.lineWidth = 1;
            for (let i = 1; i < 4; i++) {
              ctx.beginPath();
              ctx.moveTo(tx, ty + (TILE_SIZE / 4) * i);
              ctx.lineTo(tx + TILE_SIZE, ty + (TILE_SIZE / 4) * i);
              ctx.stroke();
            }
            // Nail dots
            ctx.fillStyle = '#451a03';
            ctx.fillRect(tx + 4, ty + 10, 2, 2);
            ctx.fillRect(tx + TILE_SIZE - 6, ty + 10, 2, 2);
          } else if (tileIdx === 10) {
            // Roof tile - Red brick shingles
            ctx.fillStyle = '#991b1b'; // red-800
            ctx.fillRect(tx, ty, TILE_SIZE, TILE_SIZE);
            ctx.strokeStyle = '#7f1d1d'; // darker red
            ctx.lineWidth = 1;
            for (let i = 1; i < 4; i++) {
              ctx.beginPath();
              ctx.moveTo(tx, ty + (TILE_SIZE / 4) * i);
              ctx.lineTo(tx + TILE_SIZE, ty + (TILE_SIZE / 4) * i);
              ctx.stroke();
            }
            for (let j = 0; j < 4; j++) {
              ctx.beginPath();
              // stagger vertical lines
              const offset = (j % 2 === 0) ? 0 : TILE_SIZE / 8;
              ctx.moveTo(tx + offset + TILE_SIZE / 4, ty + (TILE_SIZE / 4) * j);
              ctx.lineTo(tx + offset + TILE_SIZE / 4, ty + (TILE_SIZE / 4) * (j + 1));
              ctx.stroke();
            }
          } else if (tileIdx === 11) {
            // Stairs tile
            ctx.fillStyle = '#b45309'; // amber-700
            ctx.fillRect(tx, ty, TILE_SIZE, TILE_SIZE);
            // Horizontal steps
            ctx.fillStyle = '#78350f'; // amber-900
            for (let i = 0; i < 4; i++) {
              ctx.fillRect(tx, ty + (i * 16) + 10, TILE_SIZE, 6);
            }
            // Side rails
            ctx.fillStyle = '#fbbf24'; // amber-400
            ctx.fillRect(tx + 2, ty, 6, TILE_SIZE);
            ctx.fillRect(tx + TILE_SIZE - 8, ty, 6, TILE_SIZE);
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

    // Draw unicorn herd (big pink unicorns with lush mane)
    const drawBigUnicorn = (c: CanvasRenderingContext2D, u: Unicorn, t: number) => {
      c.save();
      c.translate(u.pos.x, u.pos.y);
      const angle = Math.atan2(u.vel.y, u.vel.x) + Math.PI / 2;
      c.rotate(angle);
      const hop = Math.abs(Math.sin(t * 3)) * 5;
      c.translate(0, -hop);

      c.lineWidth = 4;
      c.strokeStyle = '#000';

      c.fillStyle = '#F472B6';
      c.beginPath();
      if (typeof c.roundRect === 'function') {
        c.roundRect(-40, 0, 25, 60, [10, 10, 15, 15]);
        c.roundRect(15, 0, 25, 60, [10, 10, 15, 15]);
      } else {
        c.rect(-40, 0, 25, 60);
        c.rect(15, 0, 25, 60);
      }
      c.fill();
      c.stroke();

      c.fillStyle = '#DB2777';
      c.beginPath();
      c.moveTo(-35, 10);
      c.quadraticCurveTo(-70, 30, -50, 80);
      c.quadraticCurveTo(-40, 50, -35, 10);
      c.fill();
      c.stroke();

      c.fillStyle = '#F472B6';
      c.beginPath();
      if (typeof c.roundRect === 'function') {
        c.roundRect(-50, -40, 100, 70, 30);
      } else {
        c.rect(-50, -40, 100, 70);
      }
      c.fill();
      c.stroke();

      c.fillStyle = '#fdf2f8';
      c.beginPath();
      c.moveTo(0, -70);
      c.lineTo(-8, -120);
      c.lineTo(8, -120);
      c.closePath();
      c.fill();
      c.stroke();

      c.fillStyle = '#F472B6';
      c.beginPath();
      c.ellipse(0, -75, 45, 55, 0, 0, Math.PI * 2);
      c.fill();
      c.stroke();

      c.fillStyle = '#FBCFE8';
      c.beginPath();
      if (typeof c.roundRect === 'function') {
        c.roundRect(-10, -70, 75, 40, [10, 20, 20, 10]);
      } else {
        c.rect(-10, -70, 75, 40);
      }
      c.fill();
      c.stroke();

      c.fillStyle = '#DB2777';
      c.beginPath();
      c.moveTo(-30, -110);
      c.lineTo(-50, -140);
      c.lineTo(-15, -115);
      c.fill();
      c.stroke();
      c.beginPath();
      c.moveTo(30, -110);
      c.lineTo(50, -140);
      c.lineTo(15, -115);
      c.fill();
      c.stroke();

      c.fillStyle = '#fff';
      c.beginPath();
      c.ellipse(20, -95, 14, 18, 0, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      c.fillStyle = '#000';
      c.beginPath();
      c.arc(24, -95, 4, 0, Math.PI * 2);
      c.fill();

      c.strokeStyle = '#000';
      c.lineWidth = 6;
      c.lineCap = 'round';
      for (let i = 0; i < 5; i++) {
        c.beginPath();
        c.moveTo(-35, -90 + i * 15);
        c.quadraticCurveTo(-60, -80 + i * 15, -50, -60 + i * 15);
        c.strokeStyle = (i % 2 === 0) ? '#DB2777' : '#FBCFE8';
        c.stroke();
      }

      c.restore();
    };

    if (state.unicorns?.length) {
      state.unicorns.forEach((u: Unicorn) => {
        if (u.active) drawBigUnicorn(ctx, u, timeRef.current);
      });
    }

    // Satan — rift opens, rises from below, strikes with lightning
    const satan = (state as any).satan as Satan | null | undefined;
    if (satan) {
      const t = timeRef.current;
      const riftOpen = satan.riftOpen ?? 0;
      const riftW = 300;
      const riftH = 500;

      // 1. Lava in rift gap
      if (riftOpen > 5) {
        const grad = ctx.createLinearGradient(satan.pos.x, satan.pos.y - riftH / 2, satan.pos.x, satan.pos.y + riftH / 2);
        grad.addColorStop(0, '#7f1d1d');
        grad.addColorStop(0.5, '#dc2626');
        grad.addColorStop(1, '#7f1d1d');
        ctx.fillStyle = grad;
        ctx.fillRect(satan.pos.x - riftOpen, satan.pos.y - riftH / 2, riftOpen * 2, riftH);
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 12; i++) {
          const x = satan.pos.x + (Math.random() - 0.5) * riftOpen * 1.5;
          const y = satan.pos.y - riftH / 2 + ((i * 0.3 + t * 2) % 1) * riftH;
          const r = 15 + Math.sin(t + i) * 8;
          ctx.fillStyle = '#f97316';
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over';
      }

      const drawSatanBolt = (x1: number, y1: number, x2: number, y2: number, thickness: number, alpha: number) => {
        ctx.save();
        ctx.strokeStyle = `rgba(255, 215, 0, ${alpha})`;
        ctx.lineWidth = thickness;
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#fbbf24';
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        const segments = 6;
        for (let i = 1; i < segments; i++) {
          const px = x1 + (x2 - x1) * (i / segments) + (Math.random() - 0.5) * 80;
          const py = y1 + (y2 - y1) * (i / segments) + (Math.random() - 0.5) * 80;
          ctx.lineTo(px, py);
        }
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.restore();
      };

      ctx.save();
      ctx.translate(satan.pos.x, satan.visibleY ?? satan.pos.y);
      const scale = 2.2;
      ctx.scale(scale, scale);

      const playerIds = Object.keys(state.players);
      const firstAlive = playerIds.find(pid => state.players[pid]?.active && state.players[pid].hp > 0);
      const angleToPlayer = firstAlive && state.players[firstAlive]?.pos
        ? Math.atan2(state.players[firstAlive].pos.y - satan.pos.y, state.players[firstAlive].pos.x - satan.pos.x) + Math.PI / 2
        : 0;
      ctx.rotate(angleToPlayer * 0.1);

      ctx.lineWidth = 2;
      ctx.strokeStyle = '#000';
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.ellipse(-40, 60, 25, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(40, 60, 25, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.moveTo(-60, 60);
      ctx.lineTo(-40, -10);
      ctx.lineTo(40, -10);
      ctx.lineTo(60, 60);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#000';
      if (typeof ctx.roundRect === 'function') {
        ctx.beginPath();
        ctx.roundRect(-65, 30, 130, 35, 10);
      } else {
        ctx.fillRect(-65, 30, 130, 35);
      }
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.ellipse(0, -20, 85, 75, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.strokeStyle = '#7f1d1d';
      ctx.lineWidth = 1;
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.moveTo(-30 + i * 15, -40);
        ctx.lineTo(-20 + i * 15, -10);
        ctx.stroke();
      }

      const leftArmX = -95, leftArmY = -30;
      const rightArmX = 95, rightArmY = -30;
      ctx.save();
      ctx.translate(leftArmX, leftArmY);
      ctx.rotate(-0.5 + Math.sin(t * 2) * 0.1);
      ctx.fillStyle = '#dc2626';
      if (typeof ctx.roundRect === 'function') {
        ctx.beginPath();
        ctx.roundRect(0, 0, 30, 80, 12);
      } else {
        ctx.fillRect(0, 0, 30, 80);
      }
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      ctx.save();
      ctx.translate(rightArmX, rightArmY);
      ctx.rotate(0.5 - Math.sin(t * 2) * 0.1);
      ctx.fillStyle = '#dc2626';
      if (typeof ctx.roundRect === 'function') {
        ctx.beginPath();
        ctx.roundRect(-30, 0, 30, 80, 12);
      } else {
        ctx.fillRect(-30, 0, 30, 80);
      }
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = '#dc2626';
      ctx.beginPath();
      ctx.ellipse(0, -90, 60, 55, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.moveTo(-35, -135);
      ctx.lineTo(-65, -170);
      ctx.lineTo(-15, -145);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(35, -135);
      ctx.lineTo(65, -170);
      ctx.lineTo(15, -145);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.ellipse(-22, -105, 18, 22, 0.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(22, -105, 18, 22, -0.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      const lookX = Math.cos(angleToPlayer - Math.PI / 2) * 6;
      const lookY = Math.sin(angleToPlayer - Math.PI / 2) * 6;
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(-18 + lookX, -105 + lookY, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(18 + lookX, -105 + lookY, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.moveTo(-15, -85);
      ctx.lineTo(15, -85);
      ctx.lineTo(0, -55);
      ctx.closePath();
      ctx.fill();

      ctx.restore();

      // 2. Ground pieces (split earth overlay) — drawn on top so Satan rises from crack
      if (riftOpen > 10) {
        const jiggle = (seed: number) => Math.sin(seed * 7) * 18 + Math.sin(seed * 13) * 12;
        ctx.fillStyle = '#334155';
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(satan.pos.x - riftW, satan.pos.y - riftH / 2);
        ctx.lineTo(satan.pos.x - riftOpen, satan.pos.y - riftH / 2);
        for (let i = 1; i <= 8; i++) {
          const y = satan.pos.y - riftH / 2 + (riftH * i) / 8;
          ctx.lineTo(satan.pos.x - riftOpen + jiggle(i + t), y);
        }
        ctx.lineTo(satan.pos.x - riftW, satan.pos.y + riftH / 2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(satan.pos.x + riftOpen, satan.pos.y - riftH / 2);
        for (let i = 1; i <= 8; i++) {
          const y = satan.pos.y - riftH / 2 + (riftH * i) / 8;
          ctx.lineTo(satan.pos.x + riftOpen + jiggle(i + t + 5), y);
        }
        ctx.lineTo(satan.pos.x + riftW, satan.pos.y + riftH / 2);
        ctx.lineTo(satan.pos.x + riftW, satan.pos.y - riftH / 2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }

      // Lightning to target (from visible position)
      const satanDrawY = satan.visibleY ?? satan.pos.y;
      if (satan.lightningTarget) {
        drawSatanBolt(satan.pos.x, satanDrawY, satan.lightningTarget.x, satan.lightningTarget.y, 10, 1);
      }
      // Random ambient lightning from rift
      if (Math.random() > 0.85) {
        const side = Math.random() > 0.5 ? 1 : -1;
        const startX = satan.pos.x + side * 200;
        const startY = satanDrawY + (Math.random() - 0.5) * 150;
        drawSatanBolt(startX, startY, startX + (Math.random() - 0.5) * 300, startY + 200, 6 + Math.random() * 4, 0.8);
      }
    }

    const drawBurningGrenade = (c: CanvasRenderingContext2D, scale: number, isItem: boolean, t: number) => {
      c.save();
      c.scale(scale, scale);
      if (isItem) {
        const glowSize = 30 + Math.sin(t * 5) * 10;
        const gradient = c.createRadialGradient(0, 0, 0, 0, 0, glowSize * 2);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
        gradient.addColorStop(0.5, 'rgba(234, 88, 12, 0.4)');
        gradient.addColorStop(1, 'rgba(234, 88, 12, 0)');
        c.fillStyle = gradient;
        c.beginPath();
        c.arc(0, 0, glowSize * 2, 0, Math.PI * 2);
        c.fill();
      }
      c.lineWidth = 2.5;
      c.strokeStyle = '#000';
      c.fillStyle = '#166534';
      c.beginPath();
      c.ellipse(0, 0, 15, 20, 0, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      c.fillStyle = '#475569';
      c.beginPath();
      if (typeof c.roundRect === 'function') {
        c.roundRect(-5, -25, 10, 8, 2);
      } else {
        c.rect(-5, -25, 10, 8);
      }
      c.fill();
      c.stroke();
      c.restore();
    };

    const burningGrenades = state.burningGrenades || [];
    burningGrenades.forEach((g: BurningGrenade) => {
      if (!g.active) return;
      const p = g.progress;
      const curX = g.startPos.x + (g.targetPos.x - g.startPos.x) * p;
      const curY = g.startPos.y + (g.targetPos.y - g.startPos.y) * p - Math.sin(p * Math.PI) * g.arcHeight;
      ctx.save();
      ctx.translate(curX, curY);
      drawBurningGrenade(ctx, 0.8, false, timeRef.current);
      ctx.restore();
    });

    const fireZones = state.fireZones || [];
    fireZones.forEach((fz: FireZone) => {
      if (!fz.active) return;
      ctx.save();
      const t = timeRef.current;
      const flicker = 0.85 + Math.sin(t * 12) * 0.15;
      ctx.globalCompositeOperation = 'lighter';
      const g1 = ctx.createRadialGradient(fz.pos.x, fz.pos.y, 0, fz.pos.x, fz.pos.y, fz.radius * 0.5);
      g1.addColorStop(0, `rgba(255, 255, 200, ${0.95 * flicker})`);
      g1.addColorStop(0.3, `rgba(255, 180, 50, ${0.85 * flicker})`);
      g1.addColorStop(0.6, 'rgba(255, 80, 20, 0.8)');
      g1.addColorStop(1, 'rgba(200, 30, 0, 0.5)');
      ctx.fillStyle = g1;
      ctx.beginPath();
      ctx.arc(fz.pos.x, fz.pos.y, fz.radius, 0, Math.PI * 2);
      ctx.fill();
      const g2 = ctx.createRadialGradient(fz.pos.x, fz.pos.y, 0, fz.pos.x, fz.pos.y, fz.radius);
      g2.addColorStop(0, 'rgba(255, 200, 100, 0.9)');
      g2.addColorStop(0.4, 'rgba(255, 100, 30, 0.7)');
      g2.addColorStop(0.8, 'rgba(220, 50, 10, 0.4)');
      g2.addColorStop(1, 'rgba(180, 20, 0, 0.15)');
      ctx.fillStyle = g2;
      ctx.beginPath();
      ctx.arc(fz.pos.x, fz.pos.y, fz.radius, 0, Math.PI * 2);
      ctx.fill();
      for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2 + t * 2;
        const dist = fz.radius * (0.6 + Math.sin(t * 8 + i) * 0.2);
        const px = fz.pos.x + Math.cos(angle) * dist;
        const py = fz.pos.y + Math.sin(angle) * dist;
        const size = 25 + Math.sin(t * 10 + i * 2) * 10;
        const grad = ctx.createRadialGradient(px, py, 0, px, py, size);
        grad.addColorStop(0, `rgba(255, 255, 150, ${0.9 * flicker})`);
        grad.addColorStop(0.5, 'rgba(255, 120, 30, 0.7)');
        grad.addColorStop(1, 'rgba(255, 50, 0, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(px, py, size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = 'rgba(255, 150, 50, 0.8)';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#ff6600';
      ctx.shadowBlur = 15;
      ctx.beginPath();
      ctx.arc(fz.pos.x, fz.pos.y, fz.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.restore();
    });

    // Draw Electric Panel — zone, glow, heal (charger), shock (random lightning)
    const electricPanel = (state as any).electricPanel as ElectricPanel | undefined;
    if (electricPanel) {
      const ep = electricPanel;
      const t = timeRef.current;

      // Zone outline (dashed) — danger zone
      ctx.strokeStyle = 'rgba(96, 165, 250, 0.35)';
      ctx.setLineDash([10, 10]);
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(ep.pos.x, ep.pos.y, ep.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Shock: random lightning inside zone (danger zone visual)
      const drawLightning = (x1: number, y1: number, x2: number, y2: number, intensity = 1) => {
        ctx.strokeStyle = '#93c5fd';
        ctx.lineWidth = 2 * intensity;
        ctx.shadowBlur = 8 * intensity;
        ctx.shadowColor = '#60a5fa';
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        const segs = 5;
        let lx = x1, ly = y1;
        for (let i = 1; i < segs; i++) {
          const tt = i / segs;
          const nx = x1 + (x2 - x1) * tt + (Math.random() - 0.5) * 25;
          const ny = y1 + (y2 - y1) * tt + (Math.random() - 0.5) * 25;
          ctx.lineTo(nx, ny);
          lx = nx;
          ly = ny;
        }
        ctx.lineTo(x2, y2);
        ctx.stroke();
      };
      if (Math.random() > 0.85) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 20 + Math.random() * (ep.radius - 30);
        const tx = ep.pos.x + Math.cos(angle) * dist;
        const ty = ep.pos.y + Math.sin(angle) * dist;
        drawLightning(ep.pos.x, ep.pos.y, tx, ty, 0.8);
      }
      if (Math.random() > 0.9) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 30 + Math.random() * (ep.radius - 40);
        const tx = ep.pos.x + Math.cos(angle) * dist;
        const ty = ep.pos.y + Math.sin(angle) * dist;
        drawLightning(ep.pos.x, ep.pos.y, tx, ty, 0.6);
      }
      ctx.shadowBlur = 0;

      // Glow behind panel
      const glowSize = 80 + Math.sin(t * 4) * 15;
      const gradient = ctx.createRadialGradient(ep.pos.x, ep.pos.y, 0, ep.pos.x, ep.pos.y, glowSize);
      gradient.addColorStop(0, 'rgba(96, 165, 250, 0.25)');
      gradient.addColorStop(0.4, 'rgba(96, 165, 250, 0.08)');
      gradient.addColorStop(1, 'rgba(96, 165, 250, 0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(ep.pos.x, ep.pos.y, glowSize, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      ctx.translate(ep.pos.x, ep.pos.y);

      ctx.lineWidth = 4;
      ctx.strokeStyle = '#000';
      ctx.fillStyle = '#475569';
      if (typeof ctx.roundRect === 'function') {
        ctx.beginPath();
        ctx.roundRect(-30, -40, 60, 80, 5);
        ctx.fill();
      } else {
        ctx.fillRect(-30, -40, 60, 80);
      }
      ctx.stroke();

      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.moveTo(0, -20);
      ctx.lineTo(-10, 5);
      ctx.lineTo(5, 0);
      ctx.lineTo(-5, 25);
      ctx.lineTo(15, -5);
      ctx.lineTo(0, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.arc(-15, 30, 5, 0, Math.PI * 2);
      ctx.arc(15, 30, 5, 0, Math.PI * 2);
      ctx.fill();

      // Lightning sparks on panel (random)
      if (Math.random() > 0.7) {
        ctx.strokeStyle = '#60a5fa';
        ctx.lineWidth = 2;
        ctx.shadowColor = '#93c5fd';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        let lx = 0, ly = 0;
        for (let i = 0; i < 5; i++) {
          const nx = lx + (Math.random() - 0.5) * 40;
          const ny = ly + (Math.random() - 0.5) * 40;
          ctx.lineTo(nx, ny);
          lx = nx;
          ly = ny;
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      ctx.restore();

      // Heal: lightning to charger (player in zone)
      const chargerId = (state as any).electricChargerId as string | null | undefined;
      if (chargerId) {
        const charger = state.players[chargerId];
        if (charger?.active && charger.pos) {
          ctx.strokeStyle = '#93c5fd';
          ctx.lineWidth = 3;
          ctx.shadowBlur = 12;
          ctx.shadowColor = '#60a5fa';
          ctx.beginPath();
          ctx.moveTo(ep.pos.x, ep.pos.y);
          const segs = 6;
          for (let i = 1; i < segs; i++) {
            const tt = i / segs;
            const nx = ep.pos.x + (charger.pos.x - ep.pos.x) * tt + (Math.random() - 0.5) * 30;
            const ny = ep.pos.y + (charger.pos.y - ep.pos.y) * tt + (Math.random() - 0.5) * 30;
            ctx.lineTo(nx, ny);
          }
          ctx.lineTo(charger.pos.x, charger.pos.y);
          ctx.stroke();
          ctx.shadowBlur = 0;
        }
      }
    }

    // Draw CTF flags and bases
    const gameMode = (state as any).gameMode as 'deathmatch' | 'ctf' | undefined;
    const flags = (state as any).flags as Flag[] | undefined;
    if (gameMode === 'ctf' && flags?.length >= 2) {
      const teamColors = ['#3b82f6', '#ef4444'];
      flags.forEach((f: Flag) => {
        const basePos = f.basePos;
        ctx.save();
        ctx.translate(basePos.x, basePos.y);
        ctx.strokeStyle = `rgba(${f.teamId === 0 ? '59,130,246' : '239,68,68'}, 0.3)`;
        ctx.setLineDash([10, 10]);
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, CTF_BASE_RADIUS, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();

        ctx.save();
        ctx.translate(f.pos.x, f.pos.y);
        const bobY = f.carriedBy ? 0 : Math.sin(timeRef.current * 4) * 5;
        ctx.translate(0, bobY);
        ctx.fillStyle = teamColors[f.teamId];
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, -35);
        ctx.lineTo(12, 25);
        ctx.lineTo(6, 15);
        ctx.lineTo(0, 25);
        ctx.lineTo(-6, 15);
        ctx.lineTo(-12, 25);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
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

    const drawPistol = (c: CanvasRenderingContext2D, angle: number, scale: number, isItem: boolean, t: number, showMuzzleFlash?: boolean) => {
      c.save();
      c.rotate(angle);
      c.scale(scale, scale);

      if (isItem) {
        const glowSize = 35 + Math.sin(t * 5) * 8;
        const gradient = c.createRadialGradient(0, 0, 0, 0, 0, glowSize * 2);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0.6)');
        gradient.addColorStop(0.5, 'rgba(234, 88, 12, 0.3)');
        gradient.addColorStop(1, 'rgba(234, 88, 12, 0)');
        c.fillStyle = gradient;
        c.beginPath();
        c.arc(0, 0, glowSize * 2, 0, Math.PI * 2);
        c.fill();
      }

      c.lineWidth = 3.5;
      c.strokeStyle = '#000';
      c.lineJoin = 'round';

      c.fillStyle = '#57534e';
      if (typeof c.roundRect === 'function') {
        c.beginPath();
        c.roundRect(-25, 0, 22, 55, [0, 0, 15, 15]);
        c.fill();
      } else {
        c.fillRect(-25, 0, 22, 55);
      }
      c.stroke();

      c.fillStyle = '#a8a29e';
      if (typeof c.roundRect === 'function') {
        c.beginPath();
        c.roundRect(-30, -25, 100, 30, 5);
        c.fill();
      } else {
        c.fillRect(-30, -25, 100, 30);
      }
      c.stroke();

      c.fillStyle = '#78716c';
      if (typeof c.roundRect === 'function') {
        c.beginPath();
        c.roundRect(-5, -28, 45, 36, 8);
        c.fill();
      } else {
        c.fillRect(-5, -28, 45, 36);
      }
      c.stroke();

      c.fillStyle = '#44403c';
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        c.beginPath();
        c.arc(17 + Math.cos(a) * 10, -10 + Math.sin(a) * 10, 3, 0, Math.PI * 2);
        c.fill();
      }

      c.fillStyle = '#d6d3d1';
      if (typeof c.roundRect === 'function') {
        c.beginPath();
        c.roundRect(40, -22, 100, 18, 2);
        c.fill();
      } else {
        c.fillRect(40, -22, 100, 18);
      }
      c.stroke();

      c.fillStyle = '#000';
      c.beginPath();
      c.arc(135, -13, 6, 0, Math.PI * 2);
      c.fill();

      if (showMuzzleFlash) {
        c.fillStyle = `rgba(251, 191, 36, ${0.6 + Math.sin(t * 30) * 0.4})`;
        c.beginPath();
        c.arc(155, -13, 25 + Math.sin(t * 20) * 10, 0, Math.PI * 2);
        c.fill();
      }

      c.restore();
    };

    const drawMinigun = (c: CanvasRenderingContext2D, angle: number, scale: number, isItem: boolean, t: number, showMuzzleFlash?: boolean) => {
      c.save();
      c.rotate(angle);
      c.scale(scale, scale);

      if (isItem) {
        const glowSize = 40 + Math.sin(t * 5) * 10;
        const gradient = c.createRadialGradient(0, 0, 0, 0, 0, glowSize * 2);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
        gradient.addColorStop(0.5, 'rgba(71, 85, 105, 0.4)');
        gradient.addColorStop(1, 'rgba(71, 85, 105, 0)');
        c.fillStyle = gradient;
        c.beginPath();
        c.arc(0, 0, glowSize * 2, 0, Math.PI * 2);
        c.fill();
      }

      c.lineWidth = 3;
      c.strokeStyle = '#000';
      c.fillStyle = '#334155';
      if (typeof c.roundRect === 'function') {
        c.beginPath();
        c.roundRect(-20, -15, 40, 30, 5);
        c.fill();
      } else {
        c.fillRect(-20, -15, 40, 30);
      }
      c.stroke();

      c.fillStyle = '#1e293b';
      if (typeof c.roundRect === 'function') {
        c.beginPath();
        c.roundRect(15, -20, 10, 40, 3);
        c.fill();
      } else {
        c.fillRect(15, -20, 10, 40);
      }
      c.stroke();

      const spin = t * 25;
      c.save();
      c.translate(25, 0);
      c.fillStyle = '#475569';
      if (typeof c.roundRect === 'function') {
        c.beginPath();
        c.roundRect(0, -18, 60, 36, 2);
        c.fill();
      } else {
        c.fillRect(0, -18, 60, 36);
      }
      c.stroke();

      c.fillStyle = '#94a3b8';
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + spin;
        const by = Math.sin(a) * 12;
        const bh = 4;
        c.fillRect(0, by - bh / 2, 65, bh);
        c.strokeRect(0, by - bh / 2, 65, bh);
      }
      c.restore();

      if (showMuzzleFlash) {
        c.fillStyle = `rgba(251, 191, 36, ${0.6 + Math.sin(t * 30) * 0.4})`;
        c.beginPath();
        c.arc(90, 0, 25 + Math.sin(t * 20) * 10, 0, Math.PI * 2);
        c.fill();
      }

      c.restore();
    };

    // Draw Gun Pickups — Kenny-style pistol on ground with glow
    gunPickups.forEach((gp: any) => {
      if (!gp.active) return;
      ctx.save();
      ctx.translate(gp.pos.x, gp.pos.y);

      const bobY = Math.sin(timeRef.current * 2.5 + 1) * 4;
      ctx.translate(0, bobY);

      const rot = Math.sin(timeRef.current * 1.2) * 0.15;
      drawPistol(ctx, -Math.PI / 4 + rot, 0.4, true, timeRef.current);

      ctx.restore();
    });

    // Draw Minigun Pickups
    const minigunPickups = (state as any).minigunPickups ?? [];
    minigunPickups.forEach((mp: MinigunPickup) => {
      if (!mp.active) return;
      ctx.save();
      ctx.translate(mp.pos.x, mp.pos.y);

      const bobY = Math.sin(timeRef.current * 2.5 + 2) * 4;
      ctx.translate(0, bobY);

      const rot = Math.sin(timeRef.current * 1.2) * 0.15;
      drawMinigun(ctx, -Math.PI / 4 + rot, 0.4, true, timeRef.current);

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
        ctx.ellipse(0, 0, 8, 2, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      });
    }

    const drawFlamethrower = (c: CanvasRenderingContext2D, angle: number, scale: number, isItem: boolean, t: number, isAttacking: boolean = false) => {
      c.save();
      c.rotate(angle);
      c.scale(scale, scale);

      const isHeld = !isItem;

      if (isItem) {
        const glowSize = 45 + Math.sin(t * 5) * 10;
        const gradient = c.createRadialGradient(0, 0, 0, 0, 0, glowSize * 2);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
        gradient.addColorStop(0.5, 'rgba(239, 68, 68, 0.4)');
        gradient.addColorStop(1, 'rgba(239, 68, 68, 0)');
        c.fillStyle = gradient;
        c.beginPath();
        c.arc(0, 0, glowSize * 2, 0, Math.PI * 2);
        c.fill();
      }

      c.lineWidth = 3;
      c.strokeStyle = '#000';

      if (isItem || isHeld) {
        c.fillStyle = '#991b1b';
        c.beginPath();
        if (typeof c.roundRect === 'function') c.roundRect(isHeld ? -35 : -60, isHeld ? -10 : -30, 30, 50, 8);
        else c.rect(isHeld ? -35 : -60, isHeld ? -10 : -30, 30, 50);
        c.fill();
        c.stroke();

        c.fillStyle = '#7f1d1d';
        c.beginPath();
        c.arc(isHeld ? -20 : -45, isHeld ? -10 : -30, 10, 0, Math.PI, true);
        c.fill();
        c.stroke();

        if (isHeld) {
          c.beginPath();
          c.moveTo(-10, 10);
          c.bezierCurveTo(0, 20, 20, 20, 30, 10);
          c.lineWidth = 6;
          c.strokeStyle = '#1e293b';
          c.stroke();
          c.lineWidth = 3;
          c.strokeStyle = '#000';
        }
      }

      c.fillStyle = '#475569';
      c.beginPath();
      if (typeof c.roundRect === 'function') c.roundRect(isHeld ? 35 : 0, isHeld ? 5 : -15, 80, 12, 2);
      else c.rect(isHeld ? 35 : 0, isHeld ? 5 : -15, 80, 12);
      c.fill();
      c.stroke();

      c.fillStyle = '#1e293b';
      c.beginPath();
      if (typeof c.roundRect === 'function') c.roundRect(isHeld ? 45 : 10, isHeld ? 15 : -5, 15, 20, 3);
      else c.rect(isHeld ? 45 : 10, isHeld ? 15 : -5, 15, 20);
      c.fill();
      c.stroke();

      c.fillStyle = '#334155';
      c.beginPath();
      if (typeof c.roundRect === 'function') c.roundRect(isHeld ? 105 : 70, isHeld ? 2 : -18, 15, 18, 3);
      else c.rect(isHeld ? 105 : 70, isHeld ? 2 : -18, 15, 18);
      c.fill();
      c.stroke();

      c.restore();
    };

    // Draw Flamethrower Pickups
    const flamethrowerPickups = (state as any).flamethrowerPickups || [];
    flamethrowerPickups.forEach((fp: any) => {
      if (!fp.active) return;
      ctx.save();
      ctx.translate(fp.pos.x, fp.pos.y);

      const bobY = Math.sin(timeRef.current * 2.5 + 4) * 4;
      ctx.translate(0, bobY);

      const rot = Math.sin(timeRef.current * 1.2) * 0.2;
      drawFlamethrower(ctx, -Math.PI / 6 + rot, 0.4, true, timeRef.current);

      ctx.restore();
    });

    // Draw Flames - dense stream with ellipses along direction
    if ((state as any).flames) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';

      (state as any).flames.forEach((flame: any) => {
        if (!flame.active) return;

        const normalizedLife = Math.max(0, flame.life / (flame.maxLife || 0.5));
        const size = flame.size || 20;
        const r = 255;
        const g = Math.floor(180 * normalizedLife + 40);
        const b = Math.floor(30 * normalizedLife);

        const vx = flame.vel?.x ?? 1;
        const vy = flame.vel?.y ?? 0;
        const angle = Math.atan2(vy, vx);
        const len = Math.sqrt(vx * vx + vy * vy) || 1;
        const stretch = Math.min(2.5, 1 + len / 400);

        const grad = ctx.createRadialGradient(
          flame.pos.x, flame.pos.y, 0,
          flame.pos.x, flame.pos.y, size * stretch
        );
        grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${normalizedLife * 0.95})`);
        grad.addColorStop(0.5, `rgba(${r}, ${Math.floor(g * 0.7)}, ${b}, ${normalizedLife * 0.6})`);
        grad.addColorStop(1, `rgba(200, 40, 0, 0)`);

        ctx.fillStyle = grad;
        ctx.save();
        ctx.translate(flame.pos.x, flame.pos.y);
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.ellipse(0, 0, size * stretch, size / stretch, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
      ctx.restore();
    }

    // Nozzle cone glow when player firing flamethrower
    Object.values(state.players || {}).forEach((p: any) => {
      if (!p?.active || !p?.hasFlamethrower || !p?.isFlamethrowerFiring) return;
      const angle = p.angle ?? -Math.PI / 2;
      const tipX = p.pos.x + Math.cos(angle) * 90;
      const tipY = p.pos.y + Math.sin(angle) * 90;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(p.pos.x, p.pos.y, 0, tipX, tipY, 120);
      g.addColorStop(0, 'rgba(255, 200, 80, 0.5)');
      g.addColorStop(0.4, 'rgba(255, 100, 30, 0.35)');
      g.addColorStop(0.8, 'rgba(220, 50, 0, 0.15)');
      g.addColorStop(1, 'rgba(180, 20, 0, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(p.pos.x + Math.cos(angle - 0.3) * 40, p.pos.y + Math.sin(angle - 0.3) * 40);
      ctx.lineTo(tipX + Math.cos(angle - 0.25) * 80, tipY + Math.sin(angle - 0.25) * 80);
      ctx.lineTo(tipX + Math.cos(angle + 0.25) * 80, tipY + Math.sin(angle + 0.25) * 80);
      ctx.lineTo(p.pos.x + Math.cos(angle + 0.3) * 40, p.pos.y + Math.sin(angle + 0.3) * 40);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    });


    const drawSword = (c: CanvasRenderingContext2D, angle: number, scale: number, isItem: boolean, t: number) => {
      c.save();
      c.rotate(angle);
      c.scale(scale, scale);

      if (isItem) {
        const glowSize = 40 + Math.sin(t * 5) * 10;
        const gradient = c.createRadialGradient(0, -100, 0, 0, -100, glowSize * 2);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0.6)');
        gradient.addColorStop(0.5, 'rgba(59, 130, 246, 0.3)');
        gradient.addColorStop(1, 'rgba(59, 130, 246, 0)');
        c.fillStyle = gradient;
        c.beginPath();
        c.arc(0, -100, glowSize * 2, 0, Math.PI * 2);
        c.fill();
      }

      c.lineWidth = 3;
      c.strokeStyle = '#000';

      c.fillStyle = '#451a03';
      c.fillRect(-6, -10, 12, 40);
      c.strokeRect(-6, -10, 12, 40);

      c.fillStyle = '#1e293b';
      c.fillRect(-20, -10, 40, 8);
      c.strokeRect(-20, -10, 40, 8);

      c.fillStyle = '#94a3b8';
      c.beginPath();
      c.moveTo(-18, -10);
      c.lineTo(18, -10);
      c.lineTo(22, -220);
      c.lineTo(0, -250);
      c.lineTo(-22, -220);
      c.closePath();
      c.fill();
      c.stroke();

      c.strokeStyle = 'rgba(0,0,0,0.1)';
      c.beginPath();
      c.moveTo(0, -10);
      c.lineTo(0, -240);
      c.stroke();

      c.restore();
    };

    // Draw Sword Pickups — Kenny-style sword lying on ground with glow
    swordPickups.forEach((sp: any) => {
      if (!sp.active) return;
      ctx.save();
      ctx.translate(sp.pos.x, sp.pos.y);

      const bobY = Math.sin(timeRef.current * 2.8 + 2) * 5;
      ctx.translate(0, bobY);

      const rot = Math.sin(timeRef.current * 1.2) * 0.2;
      drawSword(ctx, Math.PI / 4 + rot, 0.4, true, timeRef.current);

      ctx.restore();
    });

    const drawShuriken = (c: CanvasRenderingContext2D, rot: number, scale: number, isItem: boolean, t: number) => {
      c.save();
      c.rotate(rot);
      c.scale(scale, scale);
      if (isItem) {
        const glowSize = 30 + Math.sin(t * 5) * 10;
        const gradient = c.createRadialGradient(0, 0, 0, 0, 0, glowSize * 2);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
        gradient.addColorStop(0.5, 'rgba(148, 163, 184, 0.4)');
        gradient.addColorStop(1, 'rgba(148, 163, 184, 0)');
        c.fillStyle = gradient;
        c.beginPath();
        c.arc(0, 0, glowSize * 2, 0, Math.PI * 2);
        c.fill();
      }
      c.lineWidth = 2.5;
      c.strokeStyle = '#000';
      c.fillStyle = '#94a3b8';
      for (let i = 0; i < 4; i++) {
        c.rotate(Math.PI / 2);
        c.beginPath();
        c.moveTo(0, 0);
        c.lineTo(-10, -25);
        c.lineTo(0, -35);
        c.lineTo(10, -25);
        c.closePath();
        c.fill();
        c.stroke();
      }
      c.fillStyle = '#475569';
      c.beginPath();
      c.arc(0, 0, 8, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      c.fillStyle = '#cbd5e1';
      c.beginPath();
      c.arc(0, 0, 3, 0, Math.PI * 2);
      c.fill();
      c.restore();
    };

    const shurikenPickups = state.shurikenPickups || [];
    shurikenPickups.forEach((sp: ShurikenPickup) => {
      if (!sp.active) return;
      ctx.save();
      ctx.translate(sp.pos.x, sp.pos.y);
      const bobY = Math.sin(timeRef.current * 3 + 1) * 5;
      ctx.translate(0, bobY);
      const rot = timeRef.current * 5;
      drawShuriken(ctx, rot, 0.5, true, timeRef.current);
      ctx.restore();
    });

    const burningGrenadePickups = state.burningGrenadePickups || [];
    burningGrenadePickups.forEach((bg: BurningGrenadePickup) => {
      if (!bg.active) return;
      ctx.save();
      ctx.translate(bg.pos.x, bg.pos.y);
      const bobY = Math.sin(timeRef.current * 2.5 + 2) * 5;
      ctx.translate(0, bobY);
      drawBurningGrenade(ctx, 1, true, timeRef.current);
      ctx.restore();
    });

    const drawBomb = (c: CanvasRenderingContext2D, angle: number, scale: number, isItem: boolean, t: number) => {
      c.save();
      c.rotate(angle);
      c.scale(scale, scale);

      if (isItem) {
        const glowSize = 30 + Math.sin(t * 5) * 5;
        const gradient = c.createRadialGradient(0, 0, 0, 0, 0, glowSize * 2);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0.6)');
        gradient.addColorStop(0.5, 'rgba(0, 0, 0, 0.3)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        c.fillStyle = gradient;
        c.beginPath();
        c.arc(0, 0, glowSize * 2, 0, Math.PI * 2);
        c.fill();
      }

      c.lineWidth = 3;
      c.strokeStyle = '#000';

      c.beginPath();
      c.moveTo(0, -25);
      c.quadraticCurveTo(10, -40, 20, -35);
      c.stroke();

      c.fillStyle = '#fbbf24';
      c.beginPath();
      c.arc(20, -35, 4 + Math.sin(t * 15) * 2, 0, Math.PI * 2);
      c.fill();

      c.fillStyle = '#1c1917';
      c.beginPath();
      c.arc(0, 0, 25, 0, Math.PI * 2);
      c.fill();
      c.stroke();

      c.fillStyle = '#44403c';
      if (typeof c.roundRect === 'function') {
        c.beginPath();
        c.roundRect(-8, -28, 16, 8, 2);
        c.fill();
      } else {
        c.fillRect(-8, -28, 16, 8);
      }
      c.stroke();

      c.fillStyle = 'rgba(255,255,255,0.1)';
      c.beginPath();
      c.arc(-8, -8, 6, 0, Math.PI * 2);
      c.fill();

      c.restore();
    };

    const drawChainsaw = (c: CanvasRenderingContext2D, angle: number, scale: number, isItem: boolean, t: number) => {
      c.save();
      c.rotate(angle);
      c.scale(scale, scale);

      if (isItem) {
        const glowSize = 40 + Math.sin(t * 5) * 8;
        const gradient = c.createRadialGradient(0, 0, 0, 0, 0, glowSize * 2);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0.7)');
        gradient.addColorStop(0.4, 'rgba(239, 68, 68, 0.4)');
        gradient.addColorStop(1, 'rgba(239, 68, 68, 0)');
        c.fillStyle = gradient;
        c.beginPath();
        c.arc(0, 0, glowSize * 2, 0, Math.PI * 2);
        c.fill();
      }

      c.lineWidth = 3;
      c.strokeStyle = '#000';
      c.lineJoin = 'round';

      c.fillStyle = '#ef4444';
      if (typeof c.roundRect === 'function') {
        c.beginPath();
        c.roundRect(-40, -25, 50, 45, 8);
        c.fill();
      } else {
        c.fillRect(-40, -25, 50, 45);
      }
      c.stroke();

      c.fillStyle = '#1c1917';
      if (typeof c.roundRect === 'function') {
        c.beginPath();
        c.roundRect(-45, -20, 15, 25, 4);
        c.fill();
      } else {
        c.fillRect(-45, -20, 15, 25);
      }
      c.stroke();

      // Engine arc
      ctx.strokeStyle = '#44403c';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(-15, -25, 15, Math.PI, 0);
      ctx.stroke();

      ctx.lineWidth = 3;
      ctx.strokeStyle = '#000';

      c.fillStyle = '#94a3b8';
      if (typeof c.roundRect === 'function') {
        c.beginPath();
        c.roundRect(10, -18, 140, 25, 4);
        c.fill();
      } else {
        c.fillRect(10, -18, 140, 25);
      }
      c.stroke();

      const chainPos = (t * 40) % 20;
      c.fillStyle = '#44403c';
      for (let i = 0; i < 140; i += 20) {
        c.beginPath();
        c.moveTo(10 + i + chainPos, -20);
        c.lineTo(15 + i + chainPos, -24);
        c.lineTo(20 + i + chainPos, -20);
        c.fill();
        c.beginPath();
        c.moveTo(10 + i + chainPos, 8);
        c.lineTo(15 + i + chainPos, 12);
        c.lineTo(20 + i + chainPos, 8);
        c.fill();
      }

      c.fillStyle = '#1e293b';
      c.beginPath();
      c.arc(-15, -5, 10, 0, Math.PI * 2);
      c.fill();
      c.stroke();

      c.restore();
    };

    // Draw Chainsaw Pickups
    const chainsawPickups = (state as any).chainsawPickups || [];
    chainsawPickups.forEach((cp: any) => {
      if (!cp.active) return;
      ctx.save();
      ctx.translate(cp.pos.x, cp.pos.y);

      const bobY = Math.sin(timeRef.current * 2.5 + 4) * 4;
      ctx.translate(0, bobY);

      const rot = Math.sin(timeRef.current * 1.2) * 0.2;
      drawChainsaw(ctx, -Math.PI / 6 + rot, 0.4, true, timeRef.current);

      ctx.restore();
    });

    // Draw Bomb Pickups — Kenny-style grenade on ground with glow
    const bombPickups = (state as any).bombPickups || [];
    bombPickups.forEach((bp: any) => {
      if (!bp.active) return;
      ctx.save();
      ctx.translate(bp.pos.x, bp.pos.y);

      const bobY = Math.sin(timeRef.current * 2.2 + 3) * 4;
      ctx.translate(0, bobY);

      drawBomb(ctx, 0, 1, true, timeRef.current);

      ctx.restore();
    });

    // Draw Thrown Swords — same Kenny-style sword as in hand (scale 1, same colors)
    const thrownSwords = (state as any).thrownSwords || [];
    thrownSwords.forEach((sword: any) => {
      if (!sword.active) return;
      ctx.save();
      ctx.translate(sword.pos.x, sword.pos.y);

      const velAngle = Math.atan2(sword.vel.y, sword.vel.x);
      const spin = timeRef.current * 15;
      drawSword(ctx, velAngle + Math.PI / 2 + spin, 1, false, timeRef.current);

      ctx.restore();
    });

    const shurikenProjectiles = state.shurikenProjectiles || [];
    shurikenProjectiles.forEach((s: ShurikenProjectile) => {
      if (!s.active) return;
      ctx.save();
      ctx.translate(s.pos.x, s.pos.y);
      drawShuriken(ctx, s.rot, 0.6, false, timeRef.current);
      ctx.restore();
    });

    const drawCartman = (c: CanvasRenderingContext2D, p: any, t: number, isMe: boolean) => {
      const velMag = Math.sqrt((p.vel?.x || 0) ** 2 + (p.vel?.y || 0) ** 2);
      const isMoving = velMag > 5;
      const hop = isMoving ? Math.abs(Math.sin(t * 15)) * 12 : 0;
      const sideTilt = isMoving ? Math.sin(t * 15) * 0.1 : 0;
      const attackProgress = p.isAttacking ? 1 - ((p.attackTimer ?? 0) / 0.2) : 0;
      const swing = p.isAttacking ? Math.sin(attackProgress * Math.PI) * -2.8 : 0;

      c.translate(0, -hop);
      c.rotate(sideTilt);

      c.lineWidth = 3;
      c.strokeStyle = '#000';

      // Feet (black)
      c.fillStyle = '#000000';
      c.beginPath();
      c.ellipse(-20, 42, 12, 6, 0, 0, Math.PI * 2);
      c.fill();
      c.beginPath();
      c.ellipse(20, 42, 12, 6, 0, 0, Math.PI * 2);
      c.fill();

      // Pants (Brown)
      c.fillStyle = '#653E23';
      c.beginPath();
      c.ellipse(0, 32, 40, 15, 0, 0, Math.PI * 2);
      c.fill();
      c.stroke();

      // Body/Jacket (Red)
      c.fillStyle = '#E51219';
      c.beginPath();
      c.ellipse(0, 5, 48, 40, 0, 0, Math.PI * 2);
      c.fill();
      c.stroke();

      // Jacket middle line & buttons
      c.beginPath();
      c.moveTo(0, -32);
      c.lineTo(0, 44);
      c.stroke();

      c.fillStyle = '#000';
      c.beginPath(); c.arc(0, -10, 2, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(0, 5, 2, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(0, 20, 2, 0, Math.PI * 2); c.fill();

      // Hands/Mittens (Yellow)
      c.fillStyle = '#FCE301';
      c.beginPath();
      c.arc(-42, 15, 12, 0, Math.PI * 2); // Left
      c.fill();
      c.stroke();
      c.beginPath();
      c.arc(42, 15, 12, 0, Math.PI * 2); // Right
      c.fill();
      c.stroke();

      // Head (Flesh tone)
      c.fillStyle = '#FFE2B8';
      c.beginPath();
      // Double chin / wide oval
      c.ellipse(0, -40, 45, 38, 0, 0, Math.PI * 2);
      c.fill();
      c.stroke();

      // Hat (Cyan with Yellow pompom and brim)
      c.fillStyle = '#20C1D0'; // Cyan base
      c.beginPath();
      c.arc(0, -40, 45, Math.PI, Math.PI * 2);
      c.lineTo(45, -40);
      c.ellipse(0, -78, 43, 8, 0, 0, Math.PI, true); // Curve the top
      c.closePath();
      c.fill();
      c.stroke();

      // Hat yellow brim
      c.fillStyle = '#FCE301'; // Yellow
      c.beginPath();
      c.moveTo(-45, -40);
      c.quadraticCurveTo(0, -55, 45, -40);
      c.lineTo(45, -34);
      c.quadraticCurveTo(0, -49, -45, -34);
      c.closePath();
      c.fill();
      c.stroke();

      // Eyes (White with small black dots)
      c.fillStyle = '#FFFFFF';
      c.beginPath();
      // Slightly angled eyes
      c.ellipse(-12, -45, 14, 18, Math.PI * 0.1, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      c.beginPath();
      c.ellipse(12, -45, 14, 18, -Math.PI * 0.1, 0, Math.PI * 2);
      c.fill();
      c.stroke();

      // Pupils (Looking towards center)
      c.fillStyle = '#000000';
      c.beginPath();
      c.arc(-6, -45, 2.5, 0, Math.PI * 2);
      c.fill();
      c.beginPath();
      c.arc(6, -45, 2.5, 0, Math.PI * 2);
      c.fill();

      // Hat Pom-pom
      c.beginPath();
      c.arc(0, -84, 12, 0, Math.PI * 2);
      c.fill();
      c.stroke();

      // Mouth (Small annoyed line/frown)
      c.strokeStyle = '#000';
      c.lineWidth = 1.5;
      c.beginPath();
      c.moveTo(-6, -20);
      c.lineTo(6, -20);
      c.stroke();

      // Double chin line
      c.beginPath();
      c.moveTo(-15, -12);
      c.quadraticCurveTo(0, -4, 15, -12);
      c.stroke();

      c.save();
      c.translate(45, -5);
      c.rotate(swing);

      const hasGun = (p as any).hasGun;
      const hasMinigun = (p as any).hasMinigun;
      const hasFlamethrower = (p as any).hasFlamethrower;
      const hasSword = (p as any).hasSword;
      const hasChainsaw = (p as any).hasChainsaw;
      const hasBomb = (p as any).hasBomb;

      if (hasMinigun) {
        const minigunAngle = -Math.PI / 2 + (p.isAttacking ? -0.3 : 0);
        drawMinigun(c, minigunAngle, 1, false, t, p.isAttacking);
      } else if (hasFlamethrower) {
        const flamethrowerAngle = -Math.PI / 2 + (p.isAttacking ? -0.1 : 0);
        drawFlamethrower(c, flamethrowerAngle, 1, false, t, p.isAttacking);
      } else if (hasGun) {
        const pistolAngle = -Math.PI / 2 + (p.isAttacking ? -0.3 : 0);
        drawPistol(c, pistolAngle, 0.6, false, t, p.isAttacking);
      } else if (hasBomb) {
        const bombScale = p.isAttacking ? 1.2 + Math.sin(t * 20) * 0.2 : 0.8;
        drawBomb(c, 0, bombScale, false, t);
      } else if (hasChainsaw) {
        const chainsawAngle = -Math.PI / 2 + (p.isAttacking ? Math.sin(t * 40) * 0.15 : 0);
        drawChainsaw(c, chainsawAngle, 0.6, false, t);
      } else if (hasSword) {
        drawSword(c, swing, 1, false, t);
        if (p.isAttacking) {
          c.strokeStyle = 'rgba(255,255,255,0.4)';
          c.lineWidth = 50;
          c.lineCap = 'round';
          c.beginPath();
          c.arc(0, 0, 160, -Math.PI / 2 - 1.2, -Math.PI / 2 + 1.2);
          c.stroke();
          c.lineWidth = 3;
        }
      }
      c.restore();
    };

    const drawKenny = (c: CanvasRenderingContext2D, p: any, t: number, isMe: boolean) => {
      const r = p.radius;
      const velMag = Math.sqrt((p.vel?.x || 0) ** 2 + (p.vel?.y || 0) ** 2);
      const isMoving = velMag > 5;
      const hop = isMoving ? Math.abs(Math.sin(t * 15)) * 12 : 0;
      const sideTilt = isMoving ? Math.sin(t * 15) * 0.1 : 0;
      const attackProgress = p.isAttacking ? 1 - ((p.attackTimer ?? 0) / 0.2) : 0;
      const swing = p.isAttacking ? Math.sin(attackProgress * Math.PI) * -2.8 : 0;

      const bodyColor = isMe ? '#ea580c' : '#c2410c';
      const faceColor = isMe ? '#7c2d12' : '#5c1d0c';

      c.fillStyle = 'rgba(0,0,0,0.2)';
      c.beginPath();
      c.ellipse(0, 10, 30, 10, 0, 0, Math.PI * 2);
      c.fill();

      c.translate(0, -hop);
      c.rotate(sideTilt);

      c.lineWidth = 3;
      c.strokeStyle = '#000';

      c.fillStyle = '#78350f';
      c.beginPath();
      c.ellipse(-15, 15, 12, 7, 0, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      c.beginPath();
      c.ellipse(15, 15, 12, 7, 0, 0, Math.PI * 2);
      c.fill();
      c.stroke();

      c.fillStyle = bodyColor;
      c.beginPath();
      if (typeof c.roundRect === 'function') {
        c.roundRect(-24, -20, 48, 40, [18, 18, 5, 5]);
      } else {
        c.rect(-24, -20, 48, 40);
      }
      c.fill();
      c.stroke();

      c.fillStyle = '#78350f';
      c.beginPath();
      c.arc(0, -35, 34, 0, Math.PI * 2);
      c.fill();
      c.stroke();

      c.fillStyle = bodyColor;
      c.beginPath();
      c.arc(0, -35, 30, 0, Math.PI * 2);
      c.fill();
      c.stroke();

      c.fillStyle = faceColor;
      c.beginPath();
      c.ellipse(0, -35, 22, 25, 0, 0, Math.PI * 2);
      c.fill();
      c.stroke();

      c.fillStyle = '#fecaca';
      c.beginPath();
      c.ellipse(0, -35, 18, 20, 0, 0, Math.PI * 2);
      c.fill();

      c.fillStyle = '#fff';
      c.beginPath();
      c.ellipse(-7, -38, 9, 11, 0.1, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      c.beginPath();
      c.ellipse(7, -38, 9, 11, -0.1, 0, Math.PI * 2);
      c.fill();
      c.stroke();

      c.fillStyle = '#000';
      c.beginPath();
      c.arc(-5, -38, 2, 0, Math.PI * 2);
      c.arc(5, -38, 2, 0, Math.PI * 2);
      c.fill();

      c.fillStyle = '#78350f';
      c.beginPath();
      c.arc(-34, -5, 9, 0, Math.PI * 2);
      c.fill();
      c.stroke();

      c.save();
      c.translate(34, -5);
      c.rotate(swing);

      c.fillStyle = '#78350f';
      c.beginPath();
      c.arc(0, 0, 9, 0, Math.PI * 2);
      c.fill();
      c.stroke();

      const hasGun = (p as any).hasGun;
      const hasMinigun = (p as any).hasMinigun;
      const hasFlamethrower = (p as any).hasFlamethrower;
      const hasSword = (p as any).hasSword;
      const hasChainsaw = (p as any).hasChainsaw;
      const hasBomb = (p as any).hasBomb;

      if (hasMinigun) {
        const minigunAngle = -Math.PI / 2 + (p.isAttacking ? -0.3 : 0);
        drawMinigun(c, minigunAngle, 1, false, t, p.isAttacking);
      } else if (hasFlamethrower) {
        const flamethrowerAngle = -Math.PI / 2 + (p.isAttacking ? -0.1 : 0);
        drawFlamethrower(c, flamethrowerAngle, 1, false, t, p.isAttacking);
      } else if (hasGun) {
        const pistolAngle = -Math.PI / 2 + (p.isAttacking ? -0.3 : 0);
        drawPistol(c, pistolAngle, 0.6, false, t, p.isAttacking);
      } else if (hasBomb) {
        const bombScale = p.isAttacking ? 1.2 + Math.sin(t * 20) * 0.2 : 0.8;
        drawBomb(c, 0, bombScale, false, t);
      } else if (hasChainsaw) {
        const chainsawAngle = -Math.PI / 2 + (p.isAttacking ? Math.sin(t * 40) * 0.15 : 0);
        drawChainsaw(c, chainsawAngle, 0.6, false, t);
      } else if (hasSword) {
        drawSword(c, swing, 1, false, t);
        if (p.isAttacking) {
          c.strokeStyle = 'rgba(255,255,255,0.4)';
          c.lineWidth = 50;
          c.lineCap = 'round';
          c.beginPath();
          c.arc(0, 0, 160, -Math.PI / 2 - 1.2, -Math.PI / 2 + 1.2);
          c.stroke();
          c.lineWidth = 3;
        }
      } else {
        c.fillStyle = '#78350f';
        c.beginPath();
        c.arc(0, 0, 9, 0, Math.PI * 2);
        c.fill();
        c.stroke();
      }

      c.restore();
    };

    const drawStar = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number, points: number, innerRatio: number) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.beginPath();
      ctx.moveTo(0, -r);
      for (let i = 0; i < points; i++) {
        ctx.rotate(Math.PI / points);
        ctx.lineTo(0, -(r * innerRatio));
        ctx.rotate(Math.PI / points);
        ctx.lineTo(0, -r);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    };

    const drawSuperhero = (c: CanvasRenderingContext2D, p: any, t: number, isMe: boolean) => {
      const velMag = Math.sqrt((p.vel?.x || 0) ** 2 + (p.vel?.y || 0) ** 2);
      const isMoving = velMag > 5;
      const hop = isMoving ? Math.abs(Math.sin(t * 15)) * 12 : 0;
      const sideTilt = isMoving ? Math.sin(t * 15) * 0.1 : 0;
      const attackProgress = p.isAttacking ? 1 - ((p.attackTimer ?? 0) / 0.2) : 0;
      const swing = p.isAttacking ? Math.sin(attackProgress * Math.PI) * -2.8 : 0;
      const scaleY = 1 + (isMoving ? 0 : Math.sin(t * 0.5) * 0.02);
      const legOffset = isMoving ? Math.sin(t * 15) * 10 : 0;
      const armOffset = isMoving ? Math.sin(t * 15) * 8 : 0;
      const headCenterY = -55 * scaleY;

      c.fillStyle = 'rgba(0,0,0,0.2)';
      c.beginPath();
      c.ellipse(0, 10, 28, 8, 0, 0, Math.PI * 2);
      c.fill();

      c.translate(0, -hop);
      c.rotate(sideTilt);

      c.lineWidth = 2;
      c.strokeStyle = '#000';

      c.fillStyle = '#452b1f';
      c.beginPath();
      c.ellipse(-15 + legOffset, 15, 12, 7, 0, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      c.beginPath();
      c.ellipse(15 - legOffset, 15, 12, 7, 0, 0, Math.PI * 2);
      c.fill();
      c.stroke();

      c.fillStyle = '#a88d71';
      c.beginPath();
      if (typeof c.roundRect === 'function') c.roundRect(-22, -20, 44, 40, [5]);
      else c.rect(-22, -20, 44, 40);
      c.fill();
      c.stroke();

      c.fillStyle = '#ffffff';
      c.beginPath();
      if (typeof c.roundRect === 'function') c.roundRect(-22, -38 * scaleY, 44, 28 * scaleY, [5]);
      else c.rect(-22, -38 * scaleY, 44, 28 * scaleY);
      c.fill();
      c.stroke();

      c.strokeStyle = '#000';
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(-10, -35 * scaleY);
      c.quadraticCurveTo(-5, -30 * scaleY, 0, -35 * scaleY);
      c.moveTo(2, -33 * scaleY);
      c.quadraticCurveTo(7, -28 * scaleY, 12, -33 * scaleY);
      c.stroke();

      c.lineWidth = 2;
      c.save();
      c.translate(-25, -28 + armOffset);
      c.rotate(0.2);
      c.fillStyle = '#fecaca';
      c.beginPath();
      if (typeof c.roundRect === 'function') c.roundRect(0, 0, 10, 18, 5);
      else c.rect(0, 0, 10, 18);
      c.fill();
      c.stroke();
      c.restore();

      c.save();
      c.translate(25, -28 - armOffset);
      c.rotate(-0.2);
      c.fillStyle = '#fecaca';
      c.beginPath();
      if (typeof c.roundRect === 'function') c.roundRect(-10, 0, 10, 18, 5);
      else c.rect(-10, 0, 10, 18);
      c.fill();
      c.stroke();
      c.restore();

      c.fillStyle = '#000';
      c.beginPath();
      c.ellipse(0, headCenterY - 18, 50, 38, 0, 0, Math.PI * 2);
      c.fill();

      for (let i = 0; i < 10; i++) {
        const a = Math.PI + (i / 9) * Math.PI;
        const hx = Math.cos(a) * 46;
        const hy = (headCenterY - 18) + Math.sin(a) * 34;
        c.beginPath();
        c.arc(hx, hy, 17, 0, Math.PI * 2);
        c.fill();
      }

      c.fillStyle = '#fecaca';
      c.beginPath();
      c.arc(0, headCenterY, 34, 0, Math.PI * 2);
      c.fill();
      c.stroke();

      c.fillStyle = '#ec4899';
      c.strokeStyle = '#000';
      drawStar(c, -14, headCenterY - 4, 16, 5, 0.5);
      drawStar(c, 14, headCenterY - 4, 16, 5, 0.5);

      c.fillStyle = '#000';
      c.beginPath();
      c.arc(-14, headCenterY - 4, 2.5, 0, Math.PI * 2);
      c.arc(14, headCenterY - 4, 2.5, 0, Math.PI * 2);
      c.fill();

      c.beginPath();
      c.moveTo(-6, headCenterY + 12);
      c.quadraticCurveTo(0, headCenterY + 14, 6, headCenterY + 12);
      c.stroke();

      c.fillStyle = '#000';
      c.beginPath();
      c.arc(-34, -5, 9, 0, Math.PI * 2);
      c.fill();
      c.stroke();

      c.save();
      c.translate(34, -5);
      c.rotate(swing);

      c.fillStyle = '#000';
      c.beginPath();
      c.arc(0, 0, 9, 0, Math.PI * 2);
      c.fill();
      c.stroke();

      const hasGun = (p as any).hasGun;
      const hasMinigun = (p as any).hasMinigun;
      const hasFlamethrower = (p as any).hasFlamethrower;
      const hasSword = (p as any).hasSword;
      const hasChainsaw = (p as any).hasChainsaw;
      const hasBomb = (p as any).hasBomb;

      if (hasMinigun) {
        const minigunAngle = -Math.PI / 2 + (p.isAttacking ? -0.3 : 0);
        drawMinigun(c, minigunAngle, 1, false, t, p.isAttacking);
      } else if (hasFlamethrower) {
        const flamethrowerAngle = -Math.PI / 2 + (p.isAttacking ? -0.1 : 0);
        drawFlamethrower(c, flamethrowerAngle, 1, false, t, p.isAttacking);
      } else if (hasGun) {
        const pistolAngle = -Math.PI / 2 + (p.isAttacking ? -0.3 : 0);
        drawPistol(c, pistolAngle, 0.6, false, t, p.isAttacking);
      } else if (hasBomb) {
        const bombScale = p.isAttacking ? 1.2 + Math.sin(t * 20) * 0.2 : 0.8;
        drawBomb(c, 0, bombScale, false, t);
      } else if (hasChainsaw) {
        const chainsawAngle = -Math.PI / 2 + (p.isAttacking ? Math.sin(t * 40) * 0.15 : 0);
        drawChainsaw(c, chainsawAngle, 0.6, false, t);
      } else if (hasSword) {
        drawSword(c, swing, 1, false, t);
        if (p.isAttacking) {
          c.strokeStyle = 'rgba(255,255,255,0.4)';
          c.lineWidth = 50;
          c.lineCap = 'round';
          c.beginPath();
          c.arc(0, 0, 160, -Math.PI / 2 - 1.2, -Math.PI / 2 + 1.2);
          c.stroke();
          c.lineWidth = 2;
        }
      } else {
        c.fillStyle = '#000';
        c.beginPath();
        c.arc(0, 0, 9, 0, Math.PI * 2);
        c.fill();
        c.stroke();
      }

      c.restore();
    };

    const drawKyle = (c: CanvasRenderingContext2D, p: any, t: number, isMe: boolean) => {
      const velMag = Math.sqrt((p.vel?.x || 0) ** 2 + (p.vel?.y || 0) ** 2);
      const isMoving = velMag > 5;
      const hop = isMoving ? Math.abs(Math.sin(t * 15)) * 12 : 0;
      const sideTilt = isMoving ? Math.sin(t * 15) * 0.1 : 0;
      const attackProgress = p.isAttacking ? 1 - ((p.attackTimer ?? 0) / 0.2) : 0;
      const swing = p.isAttacking ? Math.sin(attackProgress * Math.PI) * -2.8 : 0;
      c.translate(0, -hop);
      c.rotate(sideTilt);
      c.lineWidth = 3;
      c.strokeStyle = '#000';
      c.fillStyle = '#000';
      c.beginPath();
      c.ellipse(-15, 20, 12, 6, 0, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      c.beginPath();
      c.ellipse(15, 20, 12, 6, 0, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      c.fillStyle = '#f97316';
      c.beginPath();
      if (typeof c.roundRect === 'function') c.roundRect(-22, -15, 44, 40, [15, 15, 5, 5]);
      else c.rect(-22, -15, 44, 40);
      c.fill();
      c.stroke();
      c.fillStyle = '#22c55e';
      c.beginPath();
      c.arc(-26, 0, 8, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      c.beginPath();
      c.arc(26, 0, 8, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      c.fillStyle = '#22c55e';
      c.beginPath();
      c.arc(0, -35, 34, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      c.beginPath();
      if (typeof c.roundRect === 'function') c.roundRect(-38, -45, 15, 45, 5);
      else c.rect(-38, -45, 15, 45);
      c.fill();
      c.stroke();
      c.beginPath();
      if (typeof c.roundRect === 'function') c.roundRect(23, -45, 15, 45, 5);
      else c.rect(23, -45, 15, 45);
      c.fill();
      c.stroke();
      c.fillStyle = '#FEE1C8';
      c.beginPath();
      c.arc(0, -30, 30, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      c.fillStyle = '#fff';
      c.beginPath();
      c.ellipse(-10, -38, 11, 13, 0, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      c.beginPath();
      c.ellipse(10, -38, 11, 13, 0, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      c.fillStyle = '#000';
      c.beginPath();
      c.arc(-8, -38, 2, 0, Math.PI * 2);
      c.arc(8, -38, 2, 0, Math.PI * 2);
      c.fill();
      c.save();
      c.translate(34, -5);
      c.rotate(swing);
      const hasGun = (p as any).hasGun, hasMinigun = (p as any).hasMinigun, hasFlamethrower = (p as any).hasFlamethrower, hasSword = (p as any).hasSword, hasChainsaw = (p as any).hasChainsaw, hasBomb = (p as any).hasBomb, hasShurikens = (p as any).hasShurikens, hasBurningGrenade = (p as any).hasBurningGrenade;
      if (hasMinigun) drawMinigun(c, -Math.PI / 2 + (p.isAttacking ? -0.3 : 0), 1, false, t, p.isAttacking);
      else if (hasFlamethrower) drawFlamethrower(c, -Math.PI / 2 + (p.isAttacking ? -0.1 : 0), 1, false, t, p.isAttacking);
      else if (hasGun) drawPistol(c, -Math.PI / 2 + (p.isAttacking ? -0.3 : 0), 0.6, false, t, p.isAttacking);
      else if (hasBomb) drawBomb(c, 0, p.isAttacking ? 1.2 + Math.sin(t * 20) * 0.2 : 0.8, false, t);
      else if (hasBurningGrenade) drawBurningGrenade(c, 0.7, false, t);
      else if (hasChainsaw) drawChainsaw(c, -Math.PI / 2 + (p.isAttacking ? Math.sin(t * 40) * 0.15 : 0), 0.6, false, t);
      else if (hasSword) { drawSword(c, swing, 1, false, t); if (p.isAttacking) { c.strokeStyle = 'rgba(255,255,255,0.4)'; c.lineWidth = 50; c.lineCap = 'round'; c.beginPath(); c.arc(0, 0, 160, -Math.PI / 2 - 1.2, -Math.PI / 2 + 1.2); c.stroke(); c.lineWidth = 3; } }
      else if (hasShurikens) drawShuriken(c, (p.angle ?? 0) + t * 5, 0.4, false, t);
      else { c.fillStyle = '#78350f'; c.beginPath(); c.arc(0, 0, 9, 0, Math.PI * 2); c.fill(); c.stroke(); }
      c.restore();
    };

    const drawStanNinja = (c: CanvasRenderingContext2D, p: any, t: number, isMe: boolean) => {
      const velMag = Math.sqrt((p.vel?.x || 0) ** 2 + (p.vel?.y || 0) ** 2);
      const isMoving = velMag > 5;
      const hop = isMoving ? Math.abs(Math.sin(t * 15)) * 12 : 0;
      const sideTilt = isMoving ? Math.sin(t * 15) * 0.1 : 0;
      const attackProgress = p.isAttacking ? 1 - ((p.attackTimer ?? 0) / 0.2) : 0;
      const swing = p.isAttacking ? Math.sin(attackProgress * Math.PI) * -2.8 : 0;
      c.translate(0, -hop);
      c.rotate(sideTilt);
      c.lineWidth = 3;
      c.strokeStyle = '#000';
      c.fillStyle = '#000';
      c.beginPath();
      c.ellipse(-15, 20, 12, 6, 0, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      c.beginPath();
      c.ellipse(15, 20, 12, 6, 0, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      c.fillStyle = '#1e3a8a';
      c.beginPath();
      if (typeof c.roundRect === 'function') c.roundRect(-22, -15, 44, 40, [15, 15, 5, 5]);
      else c.rect(-22, -15, 44, 40);
      c.fill();
      c.stroke();
      c.fillStyle = '#1e3a8a';
      c.beginPath();
      c.arc(-26, 0, 8, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      c.beginPath();
      c.arc(26, 0, 8, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      c.fillStyle = '#1e40af';
      c.beginPath();
      c.arc(0, -35, 34, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      c.fillStyle = '#000';
      c.beginPath();
      if (typeof c.roundRect === 'function') c.roundRect(-25, -45, 50, 20, 2);
      else c.rect(-25, -45, 50, 20);
      c.fill();
      c.stroke();
      c.fillStyle = '#FEE1C8';
      c.beginPath();
      c.ellipse(0, -35, 20, 10, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#fff';
      c.beginPath();
      c.ellipse(-8, -35, 10, 8, 0, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      c.beginPath();
      c.ellipse(8, -35, 10, 8, 0, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      c.fillStyle = '#000';
      c.beginPath();
      c.arc(-6, -35, 2, 0, Math.PI * 2);
      c.arc(6, -35, 2, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#ef4444';
      c.beginPath();
      c.arc(0, -68, 8, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      c.save();
      c.translate(34, -5);
      c.rotate(swing);
      const hasGun = (p as any).hasGun, hasMinigun = (p as any).hasMinigun, hasFlamethrower = (p as any).hasFlamethrower, hasSword = (p as any).hasSword, hasChainsaw = (p as any).hasChainsaw, hasBomb = (p as any).hasBomb, hasShurikens = (p as any).hasShurikens, hasBurningGrenade = (p as any).hasBurningGrenade;
      if (hasMinigun) drawMinigun(c, -Math.PI / 2 + (p.isAttacking ? -0.3 : 0), 1, false, t, p.isAttacking);
      else if (hasFlamethrower) drawFlamethrower(c, -Math.PI / 2 + (p.isAttacking ? -0.1 : 0), 1, false, t, p.isAttacking);
      else if (hasGun) drawPistol(c, -Math.PI / 2 + (p.isAttacking ? -0.3 : 0), 0.6, false, t, p.isAttacking);
      else if (hasBomb) drawBomb(c, 0, p.isAttacking ? 1.2 + Math.sin(t * 20) * 0.2 : 0.8, false, t);
      else if (hasBurningGrenade) drawBurningGrenade(c, 0.7, false, t);
      else if (hasChainsaw) drawChainsaw(c, -Math.PI / 2 + (p.isAttacking ? Math.sin(t * 40) * 0.15 : 0), 0.6, false, t);
      else if (hasSword) { drawSword(c, swing, 1, false, t); if (p.isAttacking) { c.strokeStyle = 'rgba(255,255,255,0.4)'; c.lineWidth = 50; c.lineCap = 'round'; c.beginPath(); c.arc(0, 0, 160, -Math.PI / 2 - 1.2, -Math.PI / 2 + 1.2); c.stroke(); c.lineWidth = 3; } }
      else if (hasShurikens) drawShuriken(c, (p.angle ?? 0) + t * 5, 0.4, false, t);
      else { c.fillStyle = '#78350f'; c.beginPath(); c.arc(0, 0, 9, 0, Math.PI * 2); c.fill(); c.stroke(); }
      c.restore();
    };

    const drawSnoopDogg = (c: CanvasRenderingContext2D, p: any, t: number, isMe: boolean) => {
      const velMag = Math.sqrt((p.vel?.x || 0) ** 2 + (p.vel?.y || 0) ** 2);
      const isMoving = velMag > 5;
      const hop = isMoving ? Math.abs(Math.sin(t * 15)) * 12 : 0;
      const sideTilt = isMoving ? Math.sin(t * 15) * 0.1 : 0;
      const attackProgress = p.isAttacking ? 1 - ((p.attackTimer ?? 0) / 0.2) : 0;
      const swing = p.isAttacking ? Math.sin(attackProgress * Math.PI) * -2.8 : 0;
      c.translate(0, -hop);
      c.rotate(sideTilt);
      c.lineWidth = 3;
      c.strokeStyle = '#000';

      // Feet/Shoes (White/Blue sneakers)
      c.fillStyle = '#FFFFFF';
      c.beginPath();
      c.ellipse(-14, 42, 12, 6, 0, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      c.beginPath();
      c.ellipse(14, 42, 12, 6, 0, 0, Math.PI * 2);
      c.fill();
      c.stroke();

      c.fillStyle = '#1d4ed8'; // Blue shoe detail
      c.beginPath(); c.ellipse(-14, 42, 6, 3, 0, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.ellipse(14, 42, 6, 3, 0, 0, Math.PI * 2); c.fill();

      // Pants (Baggy Denim Blue)
      c.fillStyle = '#4B5563';
      c.beginPath();
      c.ellipse(0, 25, 20, 22, 0, 0, Math.PI * 2);
      c.fill();
      c.stroke();

      // Pants line
      c.beginPath();
      c.moveTo(0, 15);
      c.lineTo(0, 45);
      c.stroke();

      // Body/Hoodie (Blue with white strings)
      c.fillStyle = '#1d4ed8'; // Royal Blue Hoodie
      c.beginPath();
      c.ellipse(0, -5, 24, 30, 0, 0, Math.PI * 2);
      c.fill();
      c.stroke();

      // Hoodie pocket
      c.beginPath();
      c.moveTo(-12, 10);
      c.lineTo(12, 10);
      c.lineTo(18, 20);
      c.lineTo(-18, 20);
      c.closePath();
      c.stroke();

      // Draw Gold Chain
      c.strokeStyle = '#FDE047'; // Gold
      c.lineWidth = 2.5;
      c.beginPath();
      c.moveTo(-10, -25);
      c.quadraticCurveTo(0, -5, 10, -25);
      c.stroke();
      // Chain Medallion
      c.fillStyle = '#EAB308';
      c.beginPath();
      c.arc(0, -7, 6, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = '#000';
      c.lineWidth = 1;
      c.stroke();

      // reset stroke
      c.lineWidth = 3;

      // Hands (Brown skin tone)
      c.fillStyle = '#6B4226';
      c.beginPath();
      c.arc(-26, 8, 10, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      c.beginPath();
      c.arc(26, 8, 10, 0, Math.PI * 2);
      c.fill();
      c.stroke();

      // Head Base (Brown Skin) - Taller and narrower than Cartman/Stan
      c.fillStyle = '#6B4226';
      c.beginPath();
      c.ellipse(0, -42, 28, 30, 0, 0, Math.PI * 2);
      c.fill();
      c.stroke();

      // Hair/Dreadlocks (Black hanging down with braided texture)
      c.fillStyle = '#0a0a0a';
      c.strokeStyle = '#000';
      const drawBraid = (x: number, y: number, segments: number, angle: number) => {
        c.save();
        c.translate(x, y);
        c.rotate(angle);
        c.lineWidth = 1.5;
        // Draw overlapping ellipses to simulate a braid
        for (let j = 0; j < segments; j++) {
          c.beginPath();
          c.ellipse(0, j * 5, 5 - (j * 0.15), 4, 0, 0, Math.PI * 2);
          c.fill();
          c.stroke();
        }
        c.restore();
      };

      // Left side locs
      drawBraid(-27, -42, 7, 0.3);
      drawBraid(-23, -32, 6, 0.1);
      drawBraid(-18, -22, 5, -0.1);
      // Right side locs
      drawBraid(27, -42, 7, -0.3);
      drawBraid(23, -32, 6, -0.1);
      drawBraid(18, -22, 5, 0.1);

      c.lineWidth = 3;

      // Top braided hair
      c.beginPath();
      c.arc(0, -68, 22, Math.PI, Math.PI * 2);
      c.fill();
      c.stroke();

      // Hairtie/Bandana (Blue)
      c.fillStyle = '#1d4ed8';
      c.beginPath();
      c.ellipse(0, -66, 22, 5, 0, 0, Math.PI * 2);
      c.fill();
      c.stroke();

      // Goatee/Facial Hair
      c.fillStyle = '#0a0a0a';
      c.beginPath();
      c.ellipse(0, -22, 8, 8, 0, 0, Math.PI, false); // Bottom curve
      c.lineTo(-8, -25);
      c.lineTo(8, -25);
      c.closePath();
      c.fill();
      c.stroke();

      // Mouth (Relaxed smirk)
      c.strokeStyle = '#000';
      c.lineWidth = 1.5;
      c.beginPath();
      c.moveTo(-5, -24);
      c.lineTo(5, -24);
      c.stroke();

      // Sunglasses (Classic rectangular black shades)
      c.fillStyle = '#0a0a0a';
      c.lineWidth = 2;
      c.beginPath();
      // Left lens
      if (typeof c.roundRect === 'function') {
        c.roundRect(-22, -50, 20, 12, 2);
        // Right lens
        c.roundRect(2, -50, 20, 12, 2);
      } else {
        c.rect(-22, -50, 20, 12);
        c.rect(2, -50, 20, 12);
      }
      c.fill();
      c.stroke();
      // Bridge
      c.beginPath();
      c.moveTo(-2, -45);
      c.lineTo(2, -45);
      c.stroke();

      // Smoke trail from mouth (Joint effect)
      c.strokeStyle = `rgba(200, 200, 200, ${0.4 + Math.sin(t * 3) * 0.2})`;
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(-6, -24);
      c.quadraticCurveTo(-15, -30 + Math.sin(t * 5) * 2, -20, -50 + Math.cos(t * 4) * 5);
      c.stroke();
      c.save();
      c.translate(34, -5);
      c.rotate(swing);
      const hasGun = (p as any).hasGun, hasMinigun = (p as any).hasMinigun, hasFlamethrower = (p as any).hasFlamethrower, hasSword = (p as any).hasSword, hasChainsaw = (p as any).hasChainsaw, hasBomb = (p as any).hasBomb, hasShurikens = (p as any).hasShurikens, hasBurningGrenade = (p as any).hasBurningGrenade;
      if (hasMinigun) drawMinigun(c, -Math.PI / 2 + (p.isAttacking ? -0.3 : 0), 1, false, t, p.isAttacking);
      else if (hasFlamethrower) drawFlamethrower(c, -Math.PI / 2 + (p.isAttacking ? -0.1 : 0), 1, false, t, p.isAttacking);
      else if (hasGun) drawPistol(c, -Math.PI / 2 + (p.isAttacking ? -0.3 : 0), 0.6, false, t, p.isAttacking);
      else if (hasBomb) drawBomb(c, 0, p.isAttacking ? 1.2 + Math.sin(t * 20) * 0.2 : 0.8, false, t);
      else if (hasBurningGrenade) drawBurningGrenade(c, 0.7, false, t);
      else if (hasChainsaw) drawChainsaw(c, -Math.PI / 2 + (p.isAttacking ? Math.sin(t * 40) * 0.15 : 0), 0.6, false, t);
      else if (hasSword) { drawSword(c, swing, 1, false, t); if (p.isAttacking) { c.strokeStyle = 'rgba(255,255,255,0.4)'; c.lineWidth = 50; c.lineCap = 'round'; c.beginPath(); c.arc(0, 0, 160, -Math.PI / 2 - 1.2, -Math.PI / 2 + 1.2); c.stroke(); c.lineWidth = 3; } }
      else if (hasShurikens) drawShuriken(c, (p.angle ?? 0) + t * 5, 0.4, false, t);
      else { c.fillStyle = '#78350f'; c.beginPath(); c.arc(0, 0, 9, 0, Math.PI * 2); c.fill(); c.stroke(); }
      c.restore();
    };

    Object.values(state.players).forEach(p => {
      if (!p.active) return;
      const isMe = p.playerId === playerIdRef.current;
      const r = p.radius;

      const gameModePlayer = (state as any).gameMode as 'deathmatch' | 'ctf' | undefined;
      const teamIdPlayer = (p as any).teamId as 0 | 1 | undefined;
      const teamColors = ['#3b82f6', '#ef4444'];
      const primary = gameModePlayer === 'ctf' && teamIdPlayer !== undefined
        ? teamColors[teamIdPlayer]
        : isMe ? '#00e5ff' : '#ff003c';

      ctx.save();

      // Handle elevation rendering (make player look higher)
      const isElevated = p.elevation === 1;
      const elevationScale = isElevated ? 1.2 : 1.0;
      const shadowOffset = isElevated ? 40 : 0;

      // Draw massive drop shadow if elevated
      if (isElevated) {
        ctx.save();
        ctx.translate(p.pos.x, p.pos.y + shadowOffset);
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.beginPath();
        ctx.ellipse(0, 0, r * 1.5, r * 0.8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      ctx.translate(p.pos.x, p.pos.y);
      ctx.rotate((p.angle ?? 0) + Math.PI / 2);
      ctx.scale(r / 35 * elevationScale, r / 35 * elevationScale);
      const heroDraw = p.heroType === 'cartman' ? drawCartman : p.heroType === 'kyle' ? drawKyle : p.heroType === 'stanNinja' ? drawStanNinja : p.heroType === 'snoopDogg' ? drawSnoopDogg : p.heroType === 'superhero' ? drawSuperhero : drawKenny;
      heroDraw(ctx, p, timeRef.current, isMe);
      ctx.restore();

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

      // HP bar fill (blue when charging at electric panel)
      const isCharging = (state as any).electricChargerId === p.playerId;
      const hpColor = isCharging ? '#60a5fa' : hpPercent > 0.5 ? '#39ff14' : hpPercent > 0.25 ? '#ffd700' : '#ff1744';
      const hpGlow = isCharging ? 'rgba(96,165,250,0.4)' : hpPercent > 0.5 ? 'rgba(57,255,20,0.4)' : hpPercent > 0.25 ? 'rgba(255,215,0,0.4)' : 'rgba(255,23,68,0.4)';
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

    // CTF timer and flag status
    const ctfGameMode = (state as any).gameMode as 'deathmatch' | 'ctf' | undefined;
    const ctfFlags = (state as any).flags as Flag[] | undefined;
    if (ctfGameMode === 'ctf' && state.status === 'PLAYING' && ctfFlags?.length >= 2) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const gameTime = (state as any).gameTime as number ?? 0;
      const remaining = Math.max(0, Math.ceil(CTF_MATCH_DURATION - gameTime));
      const mins = Math.floor(remaining / 60);
      const secs = remaining % 60;
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 28px monospace';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#000';
      ctx.shadowBlur = 4;
      ctx.fillText(`${mins}:${secs.toString().padStart(2, '0')}`, canvasWidth / 2, 50);
      ctx.shadowBlur = 0;
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(59,130,246,0.9)';
      ctx.fillText(ctfFlags[0]?.carriedBy ? 'FLAG TAKEN' : 'BASE', 30, 45);
      ctx.fillStyle = 'rgba(239,68,68,0.9)';
      ctx.textAlign = 'right';
      ctx.fillText(ctfFlags[1]?.carriedBy ? 'FLAG TAKEN' : 'BASE', canvasWidth - 30, 45);
      ctx.restore();
    }

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

    // Hero select preview — draw selected character full-body
    if (uiStateRef.current?.status === 'HERO_SELECT' && heroPreviewCanvasRef.current) {
      const pc = heroPreviewCanvasRef.current;
      const pctx = pc.getContext('2d');
      if (pctx) {
        const w = pc.width, h = pc.height;
        pctx.clearRect(0, 0, w, h);
        pctx.save();

        // Idle animation (breathing)
        const breathe = Math.sin(timeRef.current * 2.5);
        const scaleY = 1 + breathe * 0.03;
        const scaleX = 1 - breathe * 0.01;

        pctx.translate(w / 2, h * 0.78);

        // Drop shadow
        pctx.fillStyle = 'rgba(0,0,0,0.6)';
        pctx.filter = 'blur(4px)';
        pctx.beginPath();
        pctx.ellipse(0, 5, 50 + breathe * 2, 16 + breathe * 0.5, 0, 0, Math.PI * 2);
        pctx.fill();
        pctx.filter = 'none';

        pctx.scale(3.6 * scaleX, 3.6 * scaleY);
        pctx.translate(0, -breathe * 2);

        const fakeP: any = {
          heroType: selectedHeroRef.current,
          vel: { x: 0, y: 0 },
          isAttacking: false,
          attackTimer: 0,
          hasGun: false,
          hasSword: false,
          hasChainsaw: false,
          hasBomb: false
        };
        const heroDraw = fakeP.heroType === 'cartman' ? drawCartman : fakeP.heroType === 'kyle' ? drawKyle : fakeP.heroType === 'stanNinja' ? drawStanNinja : fakeP.heroType === 'snoopDogg' ? drawSnoopDogg : fakeP.heroType === 'superhero' ? drawSuperhero : drawKenny;
        heroDraw(pctx, fakeP, timeRef.current, true);
        pctx.restore();
      }
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
        throwBomb: mouseDownRef.current
      });
    }

    draw(ctx, stateRef.current);
    requestRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    const handleWindowPointerUp = (e: PointerEvent) => {
      if (e.button === 0) mouseDownRef.current = false;
      if (e.button === 2) mouseRightDownRef.current = false;
    };
    window.addEventListener('pointerup', handleWindowPointerUp);

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
      window.removeEventListener('pointerup', handleWindowPointerUp);
      window.removeEventListener('resize', handleResize);
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [tick, handleKeyDown, handleKeyUp]);


  return (
    <div className={`relative group ${uiState.status === 'PLAYING' ? 'cursor-none' : 'cursor-auto'}`} tabIndex={0}>
      <canvas
        ref={canvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        onPointerMove={handlePointerMove}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onContextMenu={handleContextMenu}
        className="w-full h-full border-4 border-zinc-700 bg-black shadow-2xl"
        style={{ display: 'block' }}
      />

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
        <div className="flex items-center gap-2 text-orange-400">FIRE GRENADE <kbd className="bg-zinc-800 p-1 rounded text-orange-400">R-CLICK</kbd></div>
        <div className="flex items-center gap-2 text-slate-400">SHURIKENS <kbd className="bg-zinc-800 p-1 rounded text-slate-400">L-CLICK</kbd></div>
        <div className="flex items-center gap-2">DODGE <kbd className="bg-zinc-800 p-1 rounded">SPACE</kbd></div>
        <div className="flex items-center gap-2 text-pink-400">BOMB <kbd className="bg-zinc-800 p-1 rounded text-pink-400">L-CLICK</kbd></div>
      </div>

      {/* Rules Modal */}
      {showRules && (uiState.status === 'MENU' || uiState.status === 'HERO_SELECT') && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => setShowRules(false)}>
          <div className="bg-slate-800 border-4 border-slate-600 rounded-2xl p-6 max-w-md max-h-[80vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-black text-orange-500">RULES & POINTS</h3>
              <button onClick={() => setShowRules(false)} className="text-slate-400 hover:text-white text-2xl leading-none">×</button>
            </div>
            <div className="space-y-4 text-slate-300 text-sm">
              <p><strong className="text-white">How to play:</strong> WASD move, L-CLICK attack/shoot, R-CLICK throw sword/grenade. Collect weapons, eliminate opponents. Last survivor wins.</p>
              <p><strong className="text-orange-400">Play Fun Points:</strong></p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Kill: +50 pts</li>
                <li>Victory: +200 pts</li>
                <li>Participation: +25 pts</li>
              </ul>
              <p className="text-slate-500 text-xs">Play via play.fun (embed) and log in to earn points. Points are saved at the end of each match. Configure game rules in Play Fun dashboard if points don&apos;t appear.</p>
            </div>
          </div>
        </div>
      )}

      {/* Leaderboard Modal */}
      {showLeaderboard && (uiState.status === 'MENU' || uiState.status === 'HERO_SELECT') && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => setShowLeaderboard(false)}>
          <div className="bg-slate-800 border-4 border-amber-600 rounded-2xl p-6 max-w-md max-h-[80vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-black text-amber-500 flex items-center gap-2"><Medal size={24} /> LEADERBOARD</h3>
              <button onClick={() => setShowLeaderboard(false)} className="text-slate-400 hover:text-white text-2xl leading-none">×</button>
            </div>
            {leaderboardLoading ? (
              <p className="text-slate-400 text-center py-8">Loading...</p>
            ) : leaderboard.length === 0 ? (
              <p className="text-slate-500 text-center py-8">No scores yet. Play via play.fun to earn points!</p>
            ) : (
              <div className="space-y-2">
                {leaderboard.map((entry, i) => {
                  const obj = entry as Record<string, unknown>;
                  let pts: number | undefined;
                  let label: string;
                  if (typeof obj?.points === 'number') {
                    pts = obj.points;
                    label = (obj.playerId ?? obj.ogpId ?? obj.wallet ?? obj.displayName ?? `Player ${i + 1}`) as string;
                  } else {
                    const entries = Object.entries(obj ?? {});
                    const numEntry = entries.find(([, v]) => typeof v === 'number');
                    pts = numEntry?.[1] as number;
                    label = (numEntry ? (numEntry[0].length > 20 ? numEntry[0].slice(0, 8) + '...' : numEntry[0]) : `Player ${i + 1}`);
                  }
                  const short = label.length > 20 ? label.slice(0, 10) + '...' + label.slice(-4) : label;
                  return (
                    <div key={i} className="flex items-center justify-between py-2 px-3 bg-slate-700/80 rounded-lg">
                      <span className="font-bold text-amber-400 w-8">#{i + 1}</span>
                      <span className="text-slate-300 truncate flex-1 mx-2">{short}</span>
                      <span className="font-black text-white">{pts ?? '-'}</span>
                    </div>
                  );
                })}
              </div>
            )}
            <p className="text-slate-500 text-xs mt-4">Play via play.fun and log in to earn points.</p>
          </div>
        </div>
      )}

      {/* Connect Wallet Modal (REMOVED) */}

      {/* Menu / Hero Select */}
      {(uiState.status === 'MENU' || uiState.status === 'HERO_SELECT') && (
        <div className="absolute inset-0 flex flex-col items-center justify-start pt-8 text-white select-none overflow-auto" style={{ fontFamily: "'Chalkboard SE', 'Comic Sans MS', sans-serif" }}>
          <MenuBackgroundCanvas ref={menuBgRef} />

          {uiState.status === 'MENU' ? (
            <>
              <div className="text-center mb-10 relative z-10 title-glow">
                <div className="h-[160px]" />
                <p className="text-yellow-200 font-black tracking-widest text-sm mt-4 drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">READY FOR CHAOS?</p>
              </div>

              <div className="w-full max-w-[500px] flex flex-col gap-6 relative z-10 px-4">
                <div className="cartoon-panel">
                  <div className="flex justify-between items-center mb-6">
                    <div className="text-white font-black text-2xl drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">QUICK PLAY</div>
                    <div className="cartoon-badge flex items-center gap-2">
                      <span className="w-3 h-3 bg-green-500 rounded-full border-2 border-slate-900" />
                      ONLINE
                    </div>
                  </div>
                  <div className="flex flex-col gap-4">
                    <button
                      onClick={(e) => { menuBgRef.current?.spawnSplatter(e.clientX, e.clientY); setUiState(prev => ({ ...prev, status: 'HERO_SELECT', actionParams: { type: 'create' } })); }}
                      disabled={isCreatingRoom}
                      className="cartoon-btn cartoon-btn-primary text-xl"
                    >
                      Create Custom Arena
                    </button>
                    <button
                      onClick={(e) => { menuBgRef.current?.spawnSplatter(e.clientX, e.clientY); setUiState(prev => ({ ...prev, status: 'HERO_SELECT', actionParams: { type: 'create' } })); }}
                      className="cartoon-btn cartoon-btn-secondary"
                    >
                      Select Your Hero
                    </button>
                  </div>
                </div>

                {openRooms.length > 0 && (
                  <div className="cartoon-panel">
                    <div className="flex justify-between items-center mb-4">
                      <div className="text-slate-300 font-bold text-sm uppercase">Active Sessions</div>
                      <div className="text-green-400 text-xs font-bold animate-pulse">● JOIN NOW</div>
                    </div>
                    <div className="flex flex-col gap-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                      {openRooms.map((room) => (
                        <div key={room.roomId} className="cartoon-arena-card">
                          <div>
                            <div className="text-yellow-400 font-black text-lg drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]">{room.creatorName}'s Arena</div>
                            <div className="text-slate-400 text-sm font-bold">
                              Players: {room.playerCount} / {room.maxPlayers ?? 2}
                              {room.gameMode === 'ctf' && ' • CTF'}
                            </div>
                          </div>
                          <button
                            onClick={(e) => {
                              menuBgRef.current?.spawnSplatter(e.clientX, e.clientY);
                              if (!isJoiningRoom && room.playerCount < (room.maxPlayers ?? 2)) {
                                setUiState(prev => ({ ...prev, status: 'HERO_SELECT', actionParams: { type: 'join', room } }));
                              }
                            }}
                            disabled={isJoiningRoom || room.playerCount >= (room.maxPlayers ?? 2)}
                            className="cartoon-btn cartoon-btn-primary py-2 px-6 w-auto text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isJoiningRoom ? 'WAIT' : room.playerCount >= (room.maxPlayers ?? 2) ? 'FULL' : 'JOIN'}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-4">
                  <button
                    onClick={(e) => { menuBgRef.current?.spawnSplatter(e.clientX, e.clientY); setShowRules(true); }}
                    className="cartoon-btn cartoon-btn-purple flex-1 text-sm"
                  >
                    RULES
                  </button>
                  <button
                    onClick={(e) => { menuBgRef.current?.spawnSplatter(e.clientX, e.clientY); setShowLeaderboard(true); fetchLeaderboard(); }}
                    className="cartoon-btn cartoon-btn-pink flex-1 text-sm"
                  >
                    LEADERBOARD
                  </button>
                </div>
              </div>
            </>
          ) : (
            /* Hero Select Screen — hero left (no frame), menu right, lower on screen */
            <div className="flex flex-row gap-10 w-[1024px] max-w-[95vw] relative z-10 items-center mt-24">
              {/* Hero — left, no frame, full body */}
              <div className="flex-1 flex flex-col items-center justify-center min-h-[500px] relative">
                <canvas
                  ref={heroPreviewCanvasRef}
                  width={420}
                  height={580}
                  className="bg-transparent pointer-events-none"
                />
                <h2 className="text-2xl font-black text-white drop-shadow-md tracking-wide mt-2">CHOOSE YOUR FIGHTER</h2>
                <div className="flex items-center justify-center gap-6 mt-3">
                  <button
                    onClick={() => {
                      const idx = HERO_ORDER.indexOf(selectedHero);
                      setSelectedHero(HERO_ORDER[(idx - 1 + HERO_ORDER.length) % HERO_ORDER.length]);
                    }}
                    className="w-14 h-14 rounded-full bg-slate-800/90 hover:bg-slate-700 border-2 border-slate-500 flex items-center justify-center text-2xl font-black text-white shrink-0 transition-transform active:scale-90"
                  >
                    ←
                  </button>
                  <span className="font-black text-3xl text-slate-100 tracking-wider drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                    {selectedHero === 'kenny' ? 'KENNY' : selectedHero === 'cartman' ? 'CARTMAN' : selectedHero === 'kyle' ? 'KYLE' : selectedHero === 'stanNinja' ? 'STAN NINJA' : selectedHero === 'snoopDogg' ? 'SNOOP DOGG' : 'SUPERHERO'}
                  </span>
                  <button
                    onClick={() => {
                      const idx = HERO_ORDER.indexOf(selectedHero);
                      setSelectedHero(HERO_ORDER[(idx + 1) % HERO_ORDER.length]);
                    }}
                    className="w-14 h-14 rounded-full bg-slate-800/90 hover:bg-slate-700 border-2 border-slate-500 flex items-center justify-center text-2xl font-black text-white shrink-0 transition-transform active:scale-90"
                  >
                    →
                  </button>
                </div>
              </div>

              {/* Menu panel — right, opposite hero, compact, lower than center */}
              <div className="flex-1 flex flex-col bg-slate-800 rounded-2xl p-4 border-4 border-slate-900 shadow-[0_8px_0_0_#1e293b] self-center w-full max-w-[320px] translate-y-[50%]">
                {uiState.actionParams?.type === 'create' && (
                  <>
                    <div className="mb-2 p-2 bg-slate-700 rounded-lg border-2 border-slate-600">
                      <span className="font-bold text-slate-300 block mb-0.5 text-xs">Game mode</span>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => setCreateRoomGameMode('deathmatch')}
                          className={`flex-1 px-3 py-1.5 rounded font-black text-sm border-2 transition-all ${createRoomGameMode === 'deathmatch' ? 'bg-cyan-500 border-cyan-400 text-slate-900' : 'bg-slate-600 border-slate-500 text-slate-300 hover:border-slate-400'}`}
                        >
                          DEATHMATCH
                        </button>
                        <button
                          onClick={() => setCreateRoomGameMode('ctf')}
                          className={`flex-1 px-3 py-1.5 rounded font-black text-sm border-2 transition-all ${createRoomGameMode === 'ctf' ? 'bg-cyan-500 border-cyan-400 text-slate-900' : 'bg-slate-600 border-slate-500 text-slate-300 hover:border-slate-400'}`}
                        >
                          CTF
                        </button>
                      </div>
                    </div>
                    <div className="mb-2 p-2 bg-slate-700 rounded-lg border-2 border-slate-600">
                      <span className="font-bold text-slate-300 block mb-0.5 text-xs">Players in arena</span>
                      <div className="flex gap-1.5 flex-wrap">
                        {[2, 3, 4, 5, 6].map((n) => (
                          <button
                            key={n}
                            onClick={() => setCreateRoomMaxPlayers(n)}
                            className={`px-3 py-1.5 rounded font-black text-sm border-2 transition-all ${createRoomMaxPlayers === n ? 'bg-cyan-500 border-cyan-400 text-slate-900' : 'bg-slate-600 border-slate-500 text-slate-300 hover:border-slate-400'}`}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                <div className="flex gap-3 mt-2">
                  <button
                    onClick={(e) => { menuBgRef.current?.spawnSplatter(e.clientX, e.clientY); setUiState(prev => ({ ...prev, status: 'MENU', actionParams: undefined })); }}
                    className="flex-1 cartoon-btn cartoon-btn-secondary !w-auto !py-2 !text-sm"
                  >
                    BACK
                  </button>
                  <button
                    onClick={(e) => {
                      menuBgRef.current?.spawnSplatter(e.clientX, e.clientY);
                      if (uiState.actionParams?.type === 'create') {
                        createRoom();
                      } else if (uiState.actionParams?.type === 'join' && uiState.actionParams.room) {
                        joinOpenRoom(uiState.actionParams.room);
                      }
                    }}
                    className="flex-2 cartoon-btn cartoon-btn-primary !w-auto !py-2 !text-sm"
                  >
                    {uiState.actionParams?.type === 'create' ? 'CREATE ARENA' : uiState.actionParams?.type === 'join' ? 'JOIN ARENA' : 'ENTER ARENA'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Lobby — waiting for opponent */}
      {uiState.status === 'LOBBY' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white" style={{ backgroundColor: '#0f172a', fontFamily: "'Comic Sans MS', 'Chalkboard SE', sans-serif" }}>

          <div className="bg-slate-800 p-8 rounded-3xl border-4 border-slate-900 shadow-[0_8px_0_0_#1e293b] flex flex-col items-center max-w-lg w-full z-10">
            <h2
              className="text-4xl sm:text-5xl font-black text-orange-500 mb-2 text-center"
              style={{ textShadow: '2px 2px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000' }}
            >
              WAITING FOR CHALLENGER
            </h2>
            <p className="text-lg font-bold text-slate-400 mb-8">
              Arena initialized · Scanning for opponents
            </p>

            <div className="bg-slate-700 border-4 border-slate-800 rounded-xl mb-6 flex items-center justify-center gap-4 px-6 py-4">
              <Users size={24} className="text-cyan-400" />
              <span className="text-3xl font-black text-cyan-400">{uiState.playerCount}/{isHost ? createRoomMaxPlayers : (stateRef.current.maxPlayers ?? 2)}</span>
              <span className="text-lg font-bold text-slate-400">Gladiators</span>
            </div>

            {uiState.playerCount >= (isHost ? createRoomMaxPlayers : (stateRef.current.maxPlayers ?? 2)) ? (
              <div className="bg-green-500 border-4 border-green-700 rounded-xl mb-6 px-6 py-4 text-center w-full animate-bounce">
                <p className="text-xl font-black text-white" style={{ textShadow: '1px 1px 0 #000' }}>
                  OPPONENT FOUND · INITIATING COMBAT
                </p>
              </div>
            ) : (
              <p className="text-lg font-bold text-slate-400 animate-pulse mb-6">
                Scanning lobby for opponents...
              </p>
            )}

            <button
              onClick={() => {
                partyClientRef.current?.disconnect();
                setUiState(prev => ({ ...prev, status: 'MENU', winner: '' }));
              }}
              className="w-full bg-slate-600 hover:bg-slate-500 text-white border-4 border-slate-900 rounded-xl px-4 py-3 font-black text-xl shadow-[0_6px_0_0_#1e293b] active:shadow-none active:translate-y-[6px] transition-all"
            >
              ABORT MISSION
            </button>
          </div>
        </div>
      )}

      {/* Victory / Defeat */}
      {uiState.status === 'VICTORY' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white" style={{ backgroundColor: '#0f172a', fontFamily: "'Comic Sans MS', 'Chalkboard SE', sans-serif" }}>

          <div className="bg-slate-800 p-8 rounded-3xl border-4 border-slate-900 shadow-[0_8px_0_0_#1e293b] flex flex-col items-center max-w-lg w-full z-10 text-center">
            {(() => {
              const isCTF = uiState.winnerTeamId !== undefined && uiState.winnerTeamId !== null;
              const myTeam = stateRef.current.players[playerIdRef.current]?.teamId;
              const myTeamWon = isCTF ? myTeam === uiState.winnerTeamId : uiState.winner === playerIdRef.current;
              return myTeamWon;
            })() ? (
              <>
                <div className="mb-6 p-4 rounded-full bg-yellow-500 border-4 border-yellow-700 shadow-[0_0_20px_rgba(234,179,8,0.5)]">
                  <Trophy size={64} className="text-yellow-100" />
                </div>

                <h2
                  className="text-5xl sm:text-6xl font-black text-yellow-400 mb-2"
                  style={{ textShadow: '2px 2px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000' }}
                >
                  VICTORY
                </h2>
                <p className="text-lg font-bold text-slate-400 mb-8">
                  {uiState.winnerTeamId !== undefined && uiState.winnerTeamId !== null
                    ? `TEAM ${uiState.winnerTeamId + 1} WINS · FLAG SECURED`
                    : 'COMBAT PROTOCOL COMPLETE · CHAMPION'}
                </p>

              </>
            ) : (
              <>
                <div className="mb-6 p-4 rounded-full bg-red-500 border-4 border-red-700 shadow-[0_0_20px_rgba(239,68,68,0.5)]">
                  <User size={64} className="text-red-100" />
                </div>

                <h2
                  className="text-5xl sm:text-6xl font-black text-red-500 mb-2"
                  style={{ textShadow: '2px 2px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000' }}
                >
                  DEFEATED
                </h2>
                <p className="text-lg font-bold text-slate-400 mb-8">
                  {uiState.winnerTeamId !== undefined && uiState.winnerTeamId !== null
                    ? `TEAM ${(uiState.winnerTeamId ?? 0) + 1} CAPTURED THE FLAG`
                    : 'COMBAT PROTOCOL TERMINATED'}
                </p>

              </>
            )}

            <button
              onClick={() => {
                partyClientRef.current?.disconnect();
                setUiState(prev => ({ ...prev, status: 'MENU', winner: '' }));
              }}
              className="w-full bg-slate-600 hover:bg-slate-500 text-white border-4 border-slate-900 rounded-xl px-4 py-3 font-black text-xl shadow-[0_6px_0_0_#1e293b] active:shadow-none active:translate-y-[6px] transition-all"
            >
              BACK TO LOBBY
            </button>
          </div>
        </div>
      )}

      {/* Toast notification */}
      {/* Toast notification */}
      {toast && (
        <div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[999]"
          style={{ fontFamily: "'Comic Sans MS', 'Chalkboard SE', sans-serif" }}
        >
          <div className={`px-6 py-3 rounded-xl border-4 shadow-lg font-black text-sm tracking-wide ${toast.type === 'success' ? 'bg-green-500 border-green-700 text-white' : 'bg-red-500 border-red-700 text-white'}`}>
            {toast.message}
          </div>
        </div>
      )}
    </div >
  );
};

export default GameCanvas;
