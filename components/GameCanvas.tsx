
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { CANVAS_WIDTH, CANVAS_HEIGHT, COLORS, PLAYER_HP, TILE_SIZE, BOMB_COOLDOWN, BOMB_RADIUS } from '../constants';
import { GameState, PlayerInput, GameAssets, Bomb, Obstacle } from '../types';
import { createInitialState, createPlayer } from '../utils/gameLogic';
import { generateAssets } from '../utils/assetGenerator';
import { Trophy, Users, Copy, Play, Shield, Sword, User, Bomb as BombIcon } from 'lucide-react';
import WalletConnect from './WalletConnect';
import BetSelector from './BetSelector';
import { checkConnection, getCurrentAddress, MIN_BET, MAX_BET } from '../utils/web3';
import { createContractRoom, joinRoom, finishGame, claimReward, getRoomBetAmount } from '../utils/contract';
import { ethers } from 'ethers';
import { PartyClient, generateRoomId } from '../utils/partyClient';

const GameCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number | null>(null);
  const stateRef = useRef<GameState>(createInitialState());
  const assetsRef = useRef<GameAssets | null>(null);

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

  const [inputRoomId, setInputRoomId] = useState('');
  const [canvasSize, setCanvasSize] = useState({ width: window.innerWidth, height: window.innerHeight });

  // Web3 State
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [selectedBet, setSelectedBet] = useState<bigint | null>(null);
  const [roomContractId, setRoomContractId] = useState<number | null>(null);
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [isJoiningRoom, setIsJoiningRoom] = useState(false);
  const [roomBetAmount, setRoomBetAmount] = useState<bigint | null>(null);
  const [gameFinished, setGameFinished] = useState(false);
  const [claimingReward, setClaimingReward] = useState(false);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // --- Asset Loading ---
  useEffect(() => {
    generateAssets().then(assets => {
      assetsRef.current = assets;
      setUiState(prev => ({ ...prev, assetsLoaded: true }));
    });
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

  // Check wallet connection on mount
  useEffect(() => {
    const checkAndPrompt = async () => {
      const connected = await checkConnection();
      if (connected) {
        const addr = await getCurrentAddress();
        if (addr) {
          setWalletConnected(true);
          setWalletAddress(addr);
        }
      } else {
        setTimeout(() => {
          setShowConnectModal(true);
        }, 500);
      }
    };
    checkAndPrompt();
  }, []);

  const handleWalletConnect = (address: string) => {
    setWalletConnected(true);
    setWalletAddress(address);
    setShowConnectModal(false);
  };

  const handleWalletDisconnect = () => {
    setWalletConnected(false);
    setWalletAddress(null);
  };

  const createRoomWithBet = async () => {
    if (!selectedBet) {
      alert('Please select bet amount');
      return;
    }

    setIsCreatingRoom(true);
    try {
      if (walletConnected) {
        const contractRoomId = await createContractRoom(selectedBet);
        if (contractRoomId !== null) {
          setRoomContractId(contractRoomId);
        }
      }
      setRoomBetAmount(selectedBet);

      const newRoomId = generateRoomId();
      setRoomId(newRoomId);
      partyClientRef.current?.connect(newRoomId);

      setIsCreatingRoom(false);
    } catch (error: any) {
      console.error('Error creating room:', error);
      setIsCreatingRoom(false);
      const newRoomId = generateRoomId();
      setRoomId(newRoomId);
      partyClientRef.current?.connect(newRoomId);
    }
  };

  const joinRoomWithBet = async () => {
    if (!inputRoomId) return;

    setIsJoiningRoom(true);
    try {
      let betAmount = roomBetAmount;
      if (!betAmount) {
        const contractBetAmount = await getRoomBetAmount(parseInt(inputRoomId));
        if (contractBetAmount !== null) {
          betAmount = contractBetAmount;
          setRoomBetAmount(betAmount);
        } else {
          betAmount = selectedBet || MIN_BET;
          setRoomBetAmount(betAmount);
        }
      }

      if (betAmount && walletConnected) {
        await joinRoom(parseInt(inputRoomId), betAmount);
      }

      setRoomId(inputRoomId);
      partyClientRef.current?.connect(inputRoomId);

      setIsJoiningRoom(false);
    } catch (error: any) {
      console.error('Error joining room:', error);
      setIsJoiningRoom(false);
      setRoomId(inputRoomId);
      partyClientRef.current?.connect(inputRoomId);
    }
  };

  const startHostedGame = () => {
    partyClientRef.current?.startGame();
  };

  const resetGame = () => {
    if (isHost) {
      partyClientRef.current?.resetGame();
    }
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
    const assets = assetsRef.current;
    const canvasWidth = canvasRef.current?.width || 800;
    const canvasHeight = canvasRef.current?.height || 600;
    
    if (!assets) {
      // Clear canvas and show loading state
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
      ctx.fillStyle = '#fff';
      ctx.font = '20px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Loading assets...', canvasWidth / 2, canvasHeight / 2);
      return;
    }

    timeRef.current += 0.016;

    const canvasWidth = canvasRef.current?.width || 800;
    const canvasHeight = canvasRef.current?.height || 600;

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

    // TileMap with animated water
    if (state.tileMap) {
      for (let y = 0; y < state.tileMap.length; y++) {
        for (let x = 0; x < state.tileMap[y].length; x++) {
          const tileIdx = state.tileMap[y][x];
          const tile = assets.tiles[tileIdx];
          if (tile) {
            ctx.drawImage(tile, x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);

            // Animated water effect
            if (tileIdx === 4) { // Water tile
              const waveOffset = Math.sin(timeRef.current * 2 + x * 0.5 + y * 0.3) * 2;
              ctx.fillStyle = 'rgba(96, 165, 250, 0.3)';
              ctx.beginPath();
              ctx.arc(
                x * TILE_SIZE + TILE_SIZE / 2 + waveOffset,
                y * TILE_SIZE + TILE_SIZE / 2,
                8 + Math.sin(timeRef.current * 3) * 2,
                0, Math.PI * 2
              );
              ctx.fill();
            }
          }
        }
      }
    } else {
      const pattern = ctx.createPattern(assets.floor, 'repeat');
      if (pattern) {
        ctx.fillStyle = pattern;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      }
    }

    // Draw Obstacles
    if (state.obstacles) {
      state.obstacles.forEach((obs: Obstacle) => {
        if (obs.destroyed) return;

        ctx.save();
        ctx.translate(obs.pos.x, obs.pos.y);

        const obsSize = obs.radius * 2.5;
        if (obs.obstacleType === 'tree') {
          ctx.drawImage(assets.tree, -obsSize / 2, -obsSize / 2, obsSize, obsSize);
        } else if (obs.obstacleType === 'rock') {
          ctx.drawImage(assets.rock, -obsSize / 2, -obsSize / 2, obsSize, obsSize);
        } else if (obs.obstacleType === 'bush') {
          ctx.drawImage(assets.bush, -obsSize / 2, -obsSize / 2, obsSize, obsSize);
        }

        ctx.restore();
      });
    }

    // Draw Bombs
    if (state.bombs) {
      state.bombs.forEach((bomb: Bomb) => {
        ctx.save();
        ctx.translate(bomb.pos.x, bomb.pos.y);

        // Pulsing effect based on fuse timer
        const pulse = 1 + Math.sin(timeRef.current * 10) * 0.1 * (1 - bomb.fuseTimer / 2);
        ctx.scale(pulse, pulse);

        // Draw bomb sprite - bigger and pink
        const bombSize = 60;
        ctx.drawImage(assets.bomb, -bombSize / 2, -bombSize / 2, bombSize, bombSize);

        // Draw fuse spark
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(0, -25, 4 + Math.random() * 2, 0, Math.PI * 2);
        ctx.fill();

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

    // Draw Health Pickups - BIG AND VISIBLE
    if ((state as any).healthPickups) {
      (state as any).healthPickups.forEach((hp: any) => {
        if (!hp.active) return;
        ctx.save();
        ctx.translate(hp.pos.x, hp.pos.y);
        
        // Strong pulsing glow effect
        const pulse = 1 + Math.sin(timeRef.current * 4) * 0.25;
        ctx.scale(pulse, pulse);
        
        // Outer glow circle
        ctx.shadowColor = '#22c55e';
        ctx.shadowBlur = 40;
        ctx.fillStyle = 'rgba(34, 197, 94, 0.3)';
        ctx.beginPath();
        ctx.arc(0, 0, 50, 0, Math.PI * 2);
        ctx.fill();
        
        // Green cross (health symbol) - BIGGER
        ctx.fillStyle = '#22c55e';
        ctx.fillRect(-30, -8, 60, 16); // Horizontal
        ctx.fillRect(-8, -30, 16, 60); // Vertical
        
        // White outline
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.strokeRect(-30, -8, 60, 16);
        ctx.strokeRect(-8, -30, 16, 60);
        
        ctx.shadowBlur = 0;
        ctx.restore();
      });
    }

    // Draw Gun Pickups - Golden pistol icon
    if ((state as any).gunPickups) {
      (state as any).gunPickups.forEach((gp: any) => {
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
    }

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

    // Draw Players
    Object.values(state.players).forEach(p => {
      if (!p.active) return;
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

      const pSize = p.radius * 2.5;
      const isMe = p.playerId === playerIdRef.current;

      // Use different sprites for players
      const playerSprite = isMe ? assets.player : assets.playerEnemy;
      ctx.drawImage(playerSprite, -pSize / 2, -pSize / 2, pSize, pSize);

      // Shield - 3x bigger
      if (p.isBlocking) {
        ctx.save();
        ctx.translate(20, 20);
        ctx.rotate(Math.PI / 4);
        // Shield 3x larger when blocking (was 48, now 144)
        ctx.drawImage(assets.shield, -72, -72, 144, 144);
        ctx.restore();

        // Shield arc effect - much more visible
        ctx.beginPath();
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 10;
        ctx.shadowColor = '#fbbf24';
        ctx.shadowBlur = 30;
        ctx.arc(0, 0, p.radius + 60, -Math.PI / 2.5, Math.PI / 2.5);
        ctx.stroke();
        ctx.shadowBlur = 0;
      } else {
        // Shield 3x larger when not blocking (was 28, now 84)
        ctx.drawImage(assets.shield, -42, 15, 84, 84);
      }

      // Weapon - Sword or Gun
      const hasGun = (p as any).hasGun;
      
      if (hasGun) {
        // Draw gun instead of sword
        ctx.save();
        ctx.translate(25, 0);
        
        // Gun shape
        ctx.fillStyle = '#fbbf24';
        ctx.shadowColor = '#fbbf24';
        ctx.shadowBlur = 10;
        // Barrel
        ctx.fillRect(0, -5, 35, 10);
        // Handle
        ctx.fillRect(-5, -5, 12, 25);
        
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.strokeRect(0, -5, 35, 10);
        ctx.strokeRect(-5, -5, 12, 25);
        
        ctx.shadowBlur = 0;
        ctx.restore();
      } else {
        // Draw sword
        ctx.save();
        ctx.translate(15, -10);

        if (p.isAttacking) {
        const progress = 1 - (p.attackTimer / 0.2);
        const swingAngle = -Math.PI / 2 + (progress * Math.PI);
        ctx.rotate(swingAngle);

        // Sword trail effect
        ctx.globalAlpha = 0.4;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.arc(0, 0, 60, -Math.PI / 4, Math.PI / 4);
        ctx.stroke();
        ctx.globalAlpha = 1;

        ctx.drawImage(assets.sword, 0, -52, 104, 104);

        ctx.restore();

        // Additional swing arc
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = 4;
        ctx.shadowColor = '#fff';
        ctx.shadowBlur = 8;
        ctx.arc(0, 0, 55, -Math.PI / 2, Math.PI / 3);
        ctx.stroke();
        ctx.shadowBlur = 0;
        } else {
          ctx.rotate(Math.PI / 4);
          ctx.drawImage(assets.sword, 0, -52, 104, 104);
          ctx.restore();
        }

        ctx.restore();
      } // End of sword drawing (hasGun else block)

      // UI: Player name/ID
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#000';
      ctx.shadowBlur = 4;
      ctx.fillText(isMe ? 'YOU' : `P${p.playerId.slice(0, 4)}`, p.pos.x, p.pos.y - 35);
      ctx.shadowBlur = 0;

      // UI: HP Bar with gradient
      const hpPercent = (p.hp || 0) / (p.maxHp || 100);
      const hpBarWidth = 44;
      const hpBarHeight = 6;

      // Background
      ctx.fillStyle = '#1f1f1f';
      ctx.fillRect(p.pos.x - hpBarWidth / 2 - 2, p.pos.y + 22, hpBarWidth + 4, hpBarHeight + 4);

      // HP fill
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

      // Border
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1;
      ctx.strokeRect(p.pos.x - hpBarWidth / 2 - 1, p.pos.y + 23, hpBarWidth + 2, hpBarHeight + 2);

      // WHITE dodge recovery bar (above HP bar)
      const dodgeCooldown = p.cooldown || 0;
      const dodgeBarWidth = 44;
      const dodgeBarY = p.pos.y - 45;
      
      // Background
      ctx.fillStyle = '#333';
      ctx.fillRect(p.pos.x - dodgeBarWidth / 2, dodgeBarY, dodgeBarWidth, 4);
      
      // Recovery fill (white) - fills up as cooldown recovers
      const dodgeReady = 1 - dodgeCooldown;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(p.pos.x - dodgeBarWidth / 2, dodgeBarY, dodgeBarWidth * dodgeReady, 4);
      
      // Border
      ctx.strokeStyle = '#666';
      ctx.lineWidth = 1;
      ctx.strokeRect(p.pos.x - dodgeBarWidth / 2, dodgeBarY, dodgeBarWidth, 4);

      // Bomb cooldown indicator (pink)
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
        finishGame(roomContractId, walletAddress).then((success) => {
          if (!success) {
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
        <div className="flex items-center gap-2">ATTACK <kbd className="bg-zinc-800 p-1 rounded">L-CLICK</kbd></div>
        <div className="flex items-center gap-2">BLOCK <kbd className="bg-zinc-800 p-1 rounded">R-CLICK</kbd></div>
        <div className="flex items-center gap-2">DODGE <kbd className="bg-zinc-800 p-1 rounded">SPACE</kbd></div>
        <div className="flex items-center gap-2 text-pink-400">BOMB <kbd className="bg-zinc-800 p-1 rounded text-pink-400">E</kbd></div>
      </div>

      {/* Connect Wallet Modal */}
      {showConnectModal && !walletConnected && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-zinc-900 border-2 border-zinc-700 rounded-lg p-8 max-w-md mx-4">
            <h2 className="text-2xl font-bold text-white mb-4 text-center">Connect Wallet (Optional)</h2>
            <p className="text-gray-300 mb-6 text-center">
              Connect your wallet for blockchain features, or play P2P only. Sepolia network will be added automatically if needed.
            </p>
            <div className="flex flex-col gap-3">
              <WalletConnect onConnect={handleWalletConnect} onDisconnect={handleWalletDisconnect} />
              <button
                onClick={() => setShowConnectModal(false)}
                className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded text-sm"
              >
                Play Without Wallet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Menu */}
      {uiState.status === 'MENU' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 text-white font-[monospace]">
          <h1 className="text-5xl font-extrabold text-red-600 mb-8 tracking-tighter">DUEL ARENA</h1>

          {!walletConnected && (
            <div className="mb-6 p-4 bg-blue-900/50 border border-blue-700 rounded">
              <p className="text-blue-300 text-sm text-center">
                Wallet optional - Connect for blockchain features, or play P2P only
              </p>
            </div>
          )}

          <div className="flex flex-col gap-6 w-96">
            {/* Create Room Section */}
            <div className="bg-zinc-800/50 border border-zinc-600 rounded p-4">
              <h2 className="text-xl font-bold mb-4 text-center">CREATE ARENA</h2>
              <BetSelector
                onSelect={setSelectedBet}
                selectedBet={selectedBet}
                disabled={isCreatingRoom}
              />
              <button
                onClick={createRoomWithBet}
                disabled={!selectedBet || isCreatingRoom}
                className="w-full mt-4 px-6 py-3 bg-red-700 hover:bg-red-600 disabled:bg-gray-600 text-white font-bold rounded flex items-center justify-center gap-2"
              >
                {isCreatingRoom ? 'Creating...' : (
                  <>
                    <Sword size={20} /> CREATE ARENA
                  </>
                )}
              </button>
            </div>

            {/* Join Room Section */}
            <div className="bg-zinc-800/50 border border-zinc-600 rounded p-4">
              <h2 className="text-xl font-bold mb-4 text-center">JOIN ARENA</h2>
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  placeholder="ROOM ID"
                  value={inputRoomId}
                  onChange={(e) => setInputRoomId(e.target.value.toUpperCase())}
                  className="flex-1 bg-zinc-800 border border-zinc-600 px-3 py-2 text-sm text-center tracking-widest uppercase focus:outline-none focus:border-red-500"
                />
              </div>
              <button
                onClick={joinRoomWithBet}
                disabled={!inputRoomId || isJoiningRoom}
                className="w-full px-6 py-3 bg-zinc-700 hover:bg-zinc-600 disabled:bg-gray-600 text-white font-bold rounded flex items-center justify-center gap-2"
              >
                {isJoiningRoom ? 'Joining...' : 'JOIN ARENA'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lobby */}
      {uiState.status === 'LOBBY' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 text-white font-[monospace]">
          <h2 className="text-3xl font-bold mb-6 text-gray-300">WAITING FOR CHALLENGERS</h2>
          {roomId && (
            <div className="bg-zinc-800 p-4 rounded border border-zinc-600 mb-8 flex flex-col items-center gap-2">
              <span className="text-gray-400 text-xs">ARENA ID</span>
              <div className="flex items-center gap-2">
                <code className="text-2xl font-bold tracking-widest text-yellow-400 select-all">{roomId}</code>
                <button onClick={() => navigator.clipboard.writeText(roomId)} className="p-2 hover:bg-zinc-700 rounded"><Copy size={16} /></button>
              </div>
            </div>
          )}
          <div className="mb-8 flex items-center gap-2 text-gray-300 animate-pulse">
            <Users size={20} />
            <span>{uiState.playerCount} Gladiator(s) Ready</span>
          </div>
          {isHost && uiState.playerCount > 1 && (
            <button onClick={startHostedGame} className="px-8 py-4 bg-green-700 hover:bg-green-600 text-white font-bold text-xl rounded flex items-center gap-2 animate-bounce">
              <Play size={24} /> FIGHT!
            </button>
          )}
          {isHost && uiState.playerCount <= 1 && (
            <div className="text-red-500 text-sm">Need at least 2 players to start</div>
          )}
          {!isHost && <p className="text-gray-500">Sharpening blade...</p>}
        </div>
      )}

      {/* Victory */}
      {uiState.status === 'VICTORY' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm text-white font-[monospace]">
          {uiState.winner === playerIdRef.current ? (
            <>
              <Trophy size={80} className="text-yellow-400 mb-4 animate-bounce" />
              <h2 className="text-5xl font-bold text-yellow-400 mb-2">VICTORY</h2>
              <p className="text-gray-400 mb-4">You are the champion</p>
              {roomContractId !== null && roomBetAmount && (
                <div className="mb-6 p-4 bg-zinc-800/50 border border-zinc-600 rounded">
                  <p className="text-sm text-gray-300 mb-2">Reward: <span className="font-bold text-green-400">{ethers.formatEther(roomBetAmount * 2n - (roomBetAmount * 2n * 5n / 100n))} ETH</span></p>
                  {roomContractId !== null && (
                    <button
                      onClick={async () => {
                        if (roomContractId === null) return;
                        setClaimingReward(true);
                        try {
                          const success = await claimReward(roomContractId);
                          if (success) {
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
                      className="px-6 py-3 bg-green-700 hover:bg-green-600 disabled:bg-gray-600 text-white font-bold rounded flex items-center gap-2"
                    >
                      {claimingReward ? 'Claiming...' : 'Claim Reward'}
                    </button>
                  )}
                </div>
              )}
            </>
          ) : (
            <>
              <User size={80} className="text-gray-600 mb-4" />
              <h2 className="text-5xl font-bold text-red-600 mb-2">DEFEATED</h2>
              <p className="text-gray-400 mb-8">Better luck next time</p>
            </>
          )}

          {isHost && (
            <button onClick={resetGame} className="px-6 py-3 bg-zinc-700 hover:bg-zinc-600 text-white font-bold rounded flex items-center gap-2">
              RESET ROUND
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default GameCanvas;
