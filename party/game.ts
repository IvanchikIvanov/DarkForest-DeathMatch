import type * as Party from "partykit/server";

// ============ TYPES (defined inline for PartyKit compatibility) ============

interface Vector2 {
  x: number;
  y: number;
}

enum EntityType {
  PLAYER = 0,
  WALL = 1,
  PARTICLE = 2,
  SWORD_HITBOX = 3
}

interface Entity {
  id: string;
  type: EntityType;
  pos: Vector2;
  vel: Vector2;
  radius: number;
  color: string;
  active: boolean;
  hp?: number;
  maxHp?: number;
  angle?: number;
}

interface Player extends Entity {
  type: EntityType.PLAYER;
  playerId: string;
  isDodging: boolean;
  dodgeTimer: number;
  cooldown: number;
  isBlocking: boolean;
  isAttacking: boolean;
  attackTimer: number;
  attackCooldown: number;
  score: number;
}

interface Particle extends Entity {
  life: number;
  decay: number;
}

interface Wall extends Entity {
  type: EntityType.WALL;
  width: number;
  height: number;
}

interface GameState {
  players: Record<string, Player>;
  particles: Particle[];
  walls: Wall[];
  shake: number;
  status: 'MENU' | 'LOBBY' | 'PLAYING' | 'VICTORY';
  winnerId?: string;
}

interface PlayerInput {
  keys: string[];
  mouse: Vector2;
  mouseDown: boolean;
  mouseRightDown: boolean;
}

// ============ CONSTANTS ============

const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 900;
const DT = 1 / 60;
const PLAYER_HP = 100;
const PLAYER_SPEED = 200;
const PLAYER_DODGE_SPEED = 600;
const PLAYER_DODGE_DURATION = 0.15;
const PLAYER_DODGE_COOLDOWN = 0.8;
const PLAYER_BLOCK_SPEED_MOD = 0.3;
const SWORD_RANGE = 60;
const SWORD_COOLDOWN = 0.4;
const SWORD_ATTACK_DURATION = 0.2;
const SHIELD_BLOCK_ANGLE = Math.PI / 2;
const SWORD_ARC = Math.PI / 2;
const SWORD_DAMAGE = 35;

const COLORS = {
  player: '#4ade80',
  enemy: '#f87171',
  wall: '#52525b',
  blood: '#dc2626',
  shield: '#fbbf24',
  playerDodge: '#60a5fa'
};

// Message types
interface InputMessage {
  type: 'INPUT';
  playerId: string;
  payload: PlayerInput;
}

interface JoinMessage {
  type: 'JOIN';
  playerId: string;
}

interface StartMessage {
  type: 'START';
}

interface ResetMessage {
  type: 'RESET';
}

type GameMessage = InputMessage | JoinMessage | StartMessage | ResetMessage;

// Helpers
const dist = (v1: Vector2, v2: Vector2) => Math.hypot(v2.x - v1.x, v2.y - v1.y);
const normalize = (v: Vector2): Vector2 => {
  const m = Math.hypot(v.x, v.y);
  return m === 0 ? { x: 0, y: 0 } : { x: v.x / m, y: v.y / m };
};
const clamp = (val: number, min: number, max: number) => Math.min(Math.max(val, min), max);
const angleDiff = (a: number, b: number) => {
  const diff = Math.abs(a - b) % (Math.PI * 2);
  return diff > Math.PI ? (Math.PI * 2) - diff : diff;
};

// Wall generation
const generateMaze = (): Wall[] => {
  const walls: Wall[] = [];
  const wallThickness = 40;
  const cellSize = 200;
  const cols = Math.floor(CANVAS_WIDTH / cellSize);
  const rows = Math.floor(CANVAS_HEIGHT / cellSize);

  // Outer walls
  walls.push({
    id: 'wall-top', type: EntityType.WALL,
    pos: { x: CANVAS_WIDTH / 2, y: wallThickness / 2 },
    vel: { x: 0, y: 0 }, radius: 0, color: COLORS.wall, active: true,
    width: CANVAS_WIDTH, height: wallThickness
  });
  walls.push({
    id: 'wall-bottom', type: EntityType.WALL,
    pos: { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT - wallThickness / 2 },
    vel: { x: 0, y: 0 }, radius: 0, color: COLORS.wall, active: true,
    width: CANVAS_WIDTH, height: wallThickness
  });
  walls.push({
    id: 'wall-left', type: EntityType.WALL,
    pos: { x: wallThickness / 2, y: CANVAS_HEIGHT / 2 },
    vel: { x: 0, y: 0 }, radius: 0, color: COLORS.wall, active: true,
    width: wallThickness, height: CANVAS_HEIGHT
  });
  walls.push({
    id: 'wall-right', type: EntityType.WALL,
    pos: { x: CANVAS_WIDTH - wallThickness / 2, y: CANVAS_HEIGHT / 2 },
    vel: { x: 0, y: 0 }, radius: 0, color: COLORS.wall, active: true,
    width: wallThickness, height: CANVAS_HEIGHT
  });

  // Use seeded random for consistent maze across all clients
  let seed = 12345;
  const seededRandom = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };

  for (let row = 1; row < rows - 1; row++) {
    for (let col = 1; col < cols - 1; col++) {
      if (seededRandom() > 0.3) continue;

      if (seededRandom() > 0.5) {
        walls.push({
          id: `wall-h-${row}-${col}`, type: EntityType.WALL,
          pos: { x: col * cellSize, y: row * cellSize },
          vel: { x: 0, y: 0 }, radius: 0, color: COLORS.wall, active: true,
          width: cellSize * 0.8, height: wallThickness
        });
      } else {
        walls.push({
          id: `wall-v-${row}-${col}`, type: EntityType.WALL,
          pos: { x: col * cellSize, y: row * cellSize },
          vel: { x: 0, y: 0 }, radius: 0, color: COLORS.wall, active: true,
          width: wallThickness, height: cellSize * 0.8
        });
      }
    }
  }

  return walls;
};

const createPlayer = (id: string, index: number): Player => ({
  id: `p-${id}`,
  playerId: id,
  type: EntityType.PLAYER,
  pos: {
    x: CANVAS_WIDTH / 2 + (index === 0 ? -150 : 150),
    y: CANVAS_HEIGHT / 2
  },
  vel: { x: 0, y: 0 },
  radius: 16,
  color: index === 0 ? COLORS.player : COLORS.enemy,
  active: true,
  hp: PLAYER_HP,
  maxHp: PLAYER_HP,
  isDodging: false,
  dodgeTimer: 0,
  cooldown: 0,
  angle: index === 0 ? 0 : Math.PI,
  isBlocking: false,
  isAttacking: false,
  attackTimer: 0,
  attackCooldown: 0,
  score: 0
});

const createParticle = (pos: Vector2, color: string, speedMod: number): Particle => {
  const angle = Math.random() * Math.PI * 2;
  const speed = Math.random() * 50 * speedMod;
  return {
    id: `p-${Math.random()}`,
    type: EntityType.PARTICLE,
    pos: { ...pos },
    vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
    radius: Math.random() * 3 + 1,
    color: color,
    active: true,
    life: 1.0,
    decay: Math.random() * 3 + 2
  };
};

const checkWallCollision = (player: Player, walls: Wall[]): boolean => {
  for (const wall of walls) {
    if (!wall.active) continue;

    const wallLeft = wall.pos.x - wall.width / 2;
    const wallRight = wall.pos.x + wall.width / 2;
    const wallTop = wall.pos.y - wall.height / 2;
    const wallBottom = wall.pos.y + wall.height / 2;

    const playerLeft = player.pos.x - player.radius;
    const playerRight = player.pos.x + player.radius;
    const playerTop = player.pos.y - player.radius;
    const playerBottom = player.pos.y + player.radius;

    if (playerRight > wallLeft && playerLeft < wallRight &&
      playerBottom > wallTop && playerTop < wallBottom) {
      return true;
    }
  }
  return false;
};

export default class GameRoom implements Party.Server {
  state: GameState;
  inputs: Record<string, PlayerInput> = {};
  hostId: string | null = null;
  gameLoop: ReturnType<typeof setInterval> | null = null;

  constructor(readonly room: Party.Room) {
    this.state = {
      status: 'LOBBY',
      shake: 0,
      players: {},
      particles: [],
      walls: generateMaze()
    };
  }

  onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
    const playerId = conn.id;
    console.log(`[SERVER] Player connected: ${playerId}`);

    // First player is host
    if (!this.hostId) {
      this.hostId = playerId;
    }

    // Add player to game
    const playerIndex = Object.keys(this.state.players).length;
    this.state.players[playerId] = createPlayer(playerId, playerIndex);

    // Send current state to new player
    conn.send(JSON.stringify({
      type: 'STATE',
      payload: this.state,
      yourId: playerId,
      isHost: playerId === this.hostId
    }));

    // Broadcast updated state to all
    this.broadcast();
  }

  onMessage(message: string, sender: Party.Connection) {
    try {
      const data: GameMessage = JSON.parse(message);

      switch (data.type) {
        case 'INPUT':
          this.inputs[data.playerId] = data.payload;
          break;

        case 'START':
          if (sender.id === this.hostId && Object.keys(this.state.players).length >= 2) {
            this.state.status = 'PLAYING';
            this.startGameLoop();
            this.broadcast();
          }
          break;

        case 'RESET':
          if (sender.id === this.hostId) {
            const playerIds = Object.keys(this.state.players);
            this.state = {
              status: 'PLAYING',
              shake: 0,
              players: {},
              particles: [],
              walls: generateMaze()
            };
            playerIds.forEach((pid, idx) => {
              this.state.players[pid] = createPlayer(pid, idx);
            });
            this.broadcast();
          }
          break;
      }
    } catch (e) {
      console.error('[SERVER] Error parsing message:', e);
    }
  }

  onClose(conn: Party.Connection) {
    const playerId = conn.id;
    console.log(`[SERVER] Player disconnected: ${playerId}`);

    delete this.state.players[playerId];
    delete this.inputs[playerId];

    // If host left, assign new host
    if (playerId === this.hostId) {
      const remaining = Object.keys(this.state.players);
      this.hostId = remaining[0] || null;
    }

    // If no players left, stop game loop
    if (Object.keys(this.state.players).length === 0) {
      this.stopGameLoop();
      this.state.status = 'LOBBY';
    }

    this.broadcast();
  }

  startGameLoop() {
    if (this.gameLoop) return;

    this.gameLoop = setInterval(() => {
      this.updateGame();
      this.broadcast();
    }, 1000 / 60); // 60 FPS
  }

  stopGameLoop() {
    if (this.gameLoop) {
      clearInterval(this.gameLoop);
      this.gameLoop = null;
    }
  }

  updateGame() {
    if (this.state.status !== 'PLAYING') return;

    let newParticles = [...this.state.particles];
    let newShake = Math.max(0, this.state.shake - 1);
    const playerIds = Object.keys(this.state.players);
    let activeCount = 0;
    let lastSurvivor = '';

    playerIds.forEach(pid => {
      const player = this.state.players[pid];
      if (!player.active) return;
      activeCount++;
      lastSurvivor = pid;

      const input = this.inputs[pid] || { keys: [], mouse: player.pos, mouseDown: false, mouseRightDown: false };
      const keySet = new Set(input.keys);

      // Cooldowns
      player.attackCooldown = Math.max(0, player.attackCooldown - DT);
      player.cooldown = Math.max(0, player.cooldown - DT);
      player.attackTimer = Math.max(0, player.attackTimer - DT);

      // Aiming
      const dx = input.mouse.x - player.pos.x;
      const dy = input.mouse.y - player.pos.y;
      player.angle = Math.atan2(dy, dx);

      // Shield
      player.isBlocking = input.mouseRightDown && !player.isAttacking && !player.isDodging;

      // Attack
      if (input.mouseDown && player.attackCooldown <= 0 && !player.isDodging && !player.isBlocking) {
        player.isAttacking = true;
        player.attackTimer = SWORD_ATTACK_DURATION;
        player.attackCooldown = SWORD_COOLDOWN;

        // Check hits
        playerIds.forEach(targetId => {
          if (targetId === pid) return;
          const target = this.state.players[targetId];
          if (!target.active) return;

          const d = dist(player.pos, target.pos);
          if (d < SWORD_RANGE) {
            const angleToTarget = Math.atan2(target.pos.y - player.pos.y, target.pos.x - player.pos.x);
            const aDiff = angleDiff(player.angle || 0, angleToTarget);

            if (aDiff < SWORD_ARC / 2) {
              let blocked = false;
              if (target.isBlocking) {
                const angleToAttacker = Math.atan2(player.pos.y - target.pos.y, player.pos.x - target.pos.x);
                const blockDiff = angleDiff(target.angle || 0, angleToAttacker);
                if (blockDiff < SHIELD_BLOCK_ANGLE / 2) {
                  blocked = true;
                }
              }

              if (blocked) {
                newShake += 5;
                for (let i = 0; i < 5; i++) newParticles.push(createParticle(target.pos, COLORS.shield, 4));
                const pushDir = normalize({ x: target.pos.x - player.pos.x, y: target.pos.y - player.pos.y });
                target.pos.x += pushDir.x * 20;
                target.pos.y += pushDir.y * 20;
              } else if (!target.isDodging && target.hp > 0) {
                target.hp = Math.max(0, target.hp - SWORD_DAMAGE);
                newShake += 10;
                for (let i = 0; i < 10; i++) newParticles.push(createParticle(target.pos, COLORS.blood, 6));

                if (target.hp <= 0) {
                  target.active = false;
                  newShake += 10;
                  for (let i = 0; i < 15; i++) newParticles.push(createParticle(target.pos, COLORS.blood, 8));
                }
              }
            }
          }
        });
      }

      if (player.attackTimer <= 0) player.isAttacking = false;

      // Dodge
      if (keySet.has(' ') && !player.isDodging && player.cooldown <= 0 && !player.isBlocking) {
        player.isDodging = true;
        player.dodgeTimer = PLAYER_DODGE_DURATION;
        player.cooldown = PLAYER_DODGE_COOLDOWN;

        let dashDir = { x: 0, y: 0 };
        if (keySet.has('w')) dashDir.y -= 1;
        if (keySet.has('s')) dashDir.y += 1;
        if (keySet.has('a')) dashDir.x -= 1;
        if (keySet.has('d')) dashDir.x += 1;

        if (dashDir.x === 0 && dashDir.y === 0) {
          dashDir = { x: Math.cos(player.angle || 0), y: Math.sin(player.angle || 0) };
        } else {
          dashDir = normalize(dashDir);
        }
        player.vel = { x: dashDir.x * PLAYER_DODGE_SPEED, y: dashDir.y * PLAYER_DODGE_SPEED };

        for (let i = 0; i < 3; i++) newParticles.push(createParticle(player.pos, COLORS.playerDodge, 2));
      }

      // Movement
      if (player.isDodging) {
        player.dodgeTimer -= DT;
        if (player.dodgeTimer <= 0) {
          player.isDodging = false;
          player.vel = { x: 0, y: 0 };
        }
      } else {
        let moveDir = { x: 0, y: 0 };
        if (keySet.has('w')) moveDir.y -= 1;
        if (keySet.has('s')) moveDir.y += 1;
        if (keySet.has('a')) moveDir.x -= 1;
        if (keySet.has('d')) moveDir.x += 1;
        moveDir = normalize(moveDir);

        let speed = PLAYER_SPEED;
        if (player.isBlocking) speed *= PLAYER_BLOCK_SPEED_MOD;
        if (player.isAttacking) speed *= 0.2;

        player.vel = { x: moveDir.x * speed, y: moveDir.y * speed };
      }

      // Apply position with collision
      const oldX = player.pos.x;
      const oldY = player.pos.y;

      player.pos.x += player.vel.x * DT;
      player.pos.y += player.vel.y * DT;

      if (checkWallCollision(player, this.state.walls)) {
        player.pos.x = oldX;
        player.pos.y = oldY;
      }

      player.pos.x = clamp(player.pos.x, player.radius, CANVAS_WIDTH - player.radius);
      player.pos.y = clamp(player.pos.y, player.radius, CANVAS_HEIGHT - player.radius);
    });

    // Particles
    newParticles.forEach(p => {
      p.pos.x += p.vel.x * DT;
      p.pos.y += p.vel.y * DT;
      p.life -= DT * p.decay;
    });
    newParticles = newParticles.filter(p => p.life > 0);

    // Win condition
    if (activeCount === 1 && playerIds.length > 1) {
      this.state.status = 'VICTORY';
      this.state.winnerId = lastSurvivor;
      this.stopGameLoop();
    }

    this.state.particles = newParticles;
    this.state.shake = newShake;
  }

  broadcast() {
    const message = JSON.stringify({
      type: 'STATE',
      payload: this.state,
      hostId: this.hostId
    });

    for (const conn of this.room.getConnections()) {
      conn.send(message);
    }
  }
}
