
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { CANVAS_WIDTH, CANVAS_HEIGHT, COLORS, PLAYER_HP } from '../constants';
import { GameState, PlayerInput, GameAssets } from '../types';
import { createInitialState, createPlayer } from '../utils/gameLogic';
import { generateAssets } from '../utils/assetGenerator';
import { Trophy, Users, Copy, Play, Shield, Sword, User } from 'lucide-react';
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
        // Update host status
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
      // Create room in smart contract (if available and wallet connected)
      if (walletConnected) {
        const contractRoomId = await createContractRoom(selectedBet);
        if (contractRoomId !== null) {
          setRoomContractId(contractRoomId);
        }
      }
      setRoomBetAmount(selectedBet);

      // Create PartyKit room with generated ID
      const newRoomId = generateRoomId();
      setRoomId(newRoomId);
      partyClientRef.current?.connect(newRoomId);

      setIsCreatingRoom(false);
    } catch (error: any) {
      console.error('Error creating room:', error);
      setIsCreatingRoom(false);
      // Still create PartyKit room even if contract fails
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

      // Join PartyKit room
      setRoomId(inputRoomId);
      partyClientRef.current?.connect(inputRoomId);

      setIsJoiningRoom(false);
    } catch (error: any) {
      console.error('Error joining room:', error);
      setIsJoiningRoom(false);
      // Still join PartyKit room even if contract fails
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
  const handleKeyDown = useCallback((e: KeyboardEvent) => { keysRef.current.add(e.key.toLowerCase()); }, []);
  const handleKeyUp = useCallback((e: KeyboardEvent) => { keysRef.current.delete(e.key.toLowerCase()); }, []);
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
    if (!assets) {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, 800, 600);
      return;
    }

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

    // Floor
    const pattern = ctx.createPattern(assets.floor, 'repeat');
    if (pattern) {
      ctx.fillStyle = pattern;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }

    // Draw Walls
    ctx.fillStyle = COLORS.wall;
    state.walls.forEach(wall => {
      if (!wall.active) return;
      ctx.fillRect(
        wall.pos.x - wall.width / 2,
        wall.pos.y - wall.height / 2,
        wall.width,
        wall.height
      );
    });

    // Draw Players
    Object.values(state.players).forEach(p => {
      if (!p.active) return;
      ctx.save();
      ctx.translate(p.pos.x, p.pos.y);
      ctx.rotate(p.angle || 0);

      const pSize = p.radius * 2.5;
      ctx.drawImage(assets.player, -pSize / 2, -pSize / 2, pSize, pSize);

      // Shield
      if (p.isBlocking) {
        ctx.save();
        ctx.translate(10, 10);
        ctx.rotate(Math.PI / 4);
        ctx.drawImage(assets.shield, -12, -12, 24, 24);
        ctx.restore();

        ctx.beginPath();
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 2;
        ctx.arc(0, 0, p.radius + 15, -Math.PI / 3, Math.PI / 3);
        ctx.stroke();
      } else {
        ctx.drawImage(assets.shield, -10, 5, 16, 16);
      }

      // Sword
      ctx.save();
      ctx.translate(15, -10);

      if (p.isAttacking) {
        const progress = 1 - (p.attackTimer / 0.2);
        const swingAngle = -Math.PI / 2 + (progress * Math.PI);
        ctx.rotate(swingAngle);
        ctx.drawImage(assets.sword, 0, -48, 96, 96);

        ctx.restore();
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 4;
        ctx.arc(0, 0, 50, -Math.PI / 2, Math.PI / 3);
        ctx.stroke();
      } else {
        ctx.rotate(Math.PI / 4);
        ctx.drawImage(assets.sword, 0, -48, 96, 96);
        ctx.restore();
      }

      ctx.restore();

      // UI: ID
      ctx.fillStyle = '#fff';
      ctx.font = '8px "Press Start 2P"';
      ctx.textAlign = 'center';
      const isMe = p.playerId === playerIdRef.current;
      ctx.fillText(isMe ? 'YOU' : `P${p.playerId.slice(0, 4)}`, p.pos.x, p.pos.y - 30);

      // UI: HP Bar
      const hpPercent = (p.hp || 0) / (p.maxHp || 100);
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(p.pos.x - 20, p.pos.y + 20, 40, 4);
      ctx.fillStyle = hpPercent > 0.5 ? '#22c55e' : hpPercent > 0.25 ? '#eab308' : '#dc2626';
      ctx.fillRect(p.pos.x - 20, p.pos.y + 20, 40 * hpPercent, 4);

      // UI: Stamina
      if (p.cooldown > 0) {
        ctx.fillStyle = '#60a5fa';
        ctx.fillRect(p.pos.x - 15, p.pos.y + 26, 30 * (1 - p.cooldown), 3);
      }
    });

    // Particles
    state.particles.forEach(pt => {
      ctx.globalAlpha = pt.life;
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.pos.x, pt.pos.y, pt.radius, pt.radius);
      ctx.globalAlpha = 1.0;
    });

    ctx.restore();

    // Cursor
    if (state.status === 'PLAYING') {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const canvasWidth = canvasRef.current?.width || 800;
      const canvasHeight = canvasRef.current?.height || 600;
      const scaleX = canvasWidth / CANVAS_WIDTH;
      const scaleY = canvasHeight / CANVAS_HEIGHT;
      const scale = Math.min(scaleX, scaleY);
      const scaledWidth = CANVAS_WIDTH * scale;
      const scaledHeight = CANVAS_HEIGHT * scale;
      const offsetX = (canvasWidth - scaledWidth) / 2;
      const offsetY = (canvasHeight - scaledHeight) / 2;

      const mx = offsetX + mouseRef.current.x * scale;
      const my = offsetY + mouseRef.current.y * scale;
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(mx, my, 4 / scale, 0, Math.PI * 2);
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
        mouseRightDown: mouseRightDownRef.current
      });
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
    <div className="relative group cursor-none">
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
          ⚠️ {connectionError}
        </div>
      )}

      {/* CONTROLS HUD */}
      <div className="absolute top-16 right-4 text-xs text-white/50 font-[monospace] flex flex-col gap-1 items-end pointer-events-none">
        <div className="flex items-center gap-2">MOVE <kbd className="bg-zinc-800 p-1 rounded">WASD</kbd></div>
        <div className="flex items-center gap-2">ATTACK <kbd className="bg-zinc-800 p-1 rounded">L-CLICK</kbd></div>
        <div className="flex items-center gap-2">BLOCK <kbd className="bg-zinc-800 p-1 rounded">R-CLICK</kbd></div>
        <div className="flex items-center gap-2">DODGE <kbd className="bg-zinc-800 p-1 rounded">SPACE</kbd></div>
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
