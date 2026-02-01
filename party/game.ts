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
  SWORD_HITBOX = 3,
  BOMB = 4,
  OBSTACLE = 5
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
  knockbackVel: Vector2;
  isBlocking: boolean;
  isAttacking: boolean;
  attackTimer: number;
  attackCooldown: number;
  bombCooldown: number;
  hasGun: boolean;   // Has picked up gun
  hasSword: boolean; // Has picked up sword
  hasBomb: boolean;  // Has picked up bomb
  score: number;
}

interface Particle extends Entity {
  life: number;
  decay: number;
  particleType?: 'blood' | 'spark' | 'explosion' | 'trail' | 'water';
}

interface Wall extends Entity {
  type: EntityType.WALL;
  width: number;
  height: number;
}

interface Bomb extends Entity {
  type: EntityType.BOMB;
  fuseTimer: number;
  ownerId: string;
}

interface Obstacle {
  id: string;
  pos: Vector2;
  obstacleType: 'tree' | 'rock' | 'bush';
  hp: number;
  radius: number;
  destroyed: boolean;
}

interface HealthPickup {
  id: string;
  pos: Vector2;
  active: boolean;
  healAmount: number;
}

interface GunPickup {
  id: string;
  pos: Vector2;
  active: boolean;
}

interface SwordPickup {
  id: string;
  pos: Vector2;
  active: boolean;
}

interface BombPickup {
  id: string;
  pos: Vector2;
  active: boolean;
}

interface ThrownSword {
  id: string;
  pos: Vector2;
  vel: Vector2;
  ownerId: string;
  active: boolean;
}

interface Bullet {
  id: string;
  pos: Vector2;
  vel: Vector2;
  ownerId: string;
  active: boolean;
}

interface GameState {
  players: Record<string, Player>;
  particles: Particle[];
  walls: Wall[];
  bombs: Bomb[];
  obstacles: Obstacle[];
  healthPickups: HealthPickup[];
  gunPickups: GunPickup[];
  swordPickups: SwordPickup[];
  bombPickups: BombPickup[];
  bullets: Bullet[];
  thrownSwords: ThrownSword[];
  tileMap?: number[][];
  shake: number;
  status: 'MENU' | 'LOBBY' | 'PLAYING' | 'VICTORY';
  winnerId?: string;
  lastHealthSpawnTime: number;
  lastGunSpawnTime: number;
  lastSwordSpawnTime: number;
  lastBombSpawnTime: number;
}

interface PlayerInput {
  keys: string[];
  mouse: Vector2;
  mouseDown: boolean;
  mouseRightDown: boolean;
  throwBomb: boolean;
}

// ============ CONSTANTS ============

const CANVAS_WIDTH = 4800; // Doubled from 2400
const CANVAS_HEIGHT = 3600; // Doubled from 1800
const TILE_SIZE = 64;
const DT = 1 / 60;
const PLAYER_HP = 100;
const PLAYER_SPEED = 500; // Increased for faster movement
const PLAYER_DODGE_SPEED = 1000; // Doubled from 500
const PLAYER_DODGE_DURATION = 0.3;
const PLAYER_DODGE_COOLDOWN = 1.0;
const PLAYER_BLOCK_SPEED_MOD = 0.4;
const SWORD_RANGE = 220; // Increased to match visual sword length
const SWORD_COOLDOWN = 0.6;
const SWORD_ATTACK_DURATION = 0.2;
const SHIELD_BLOCK_ANGLE = Math.PI / 1.2;
const SWORD_ARC = Math.PI * 2;
const SWORD_DAMAGE = 25;
const SWORD_KNOCKBACK = 500; // Knockback distance when hit by sword
const SWORD_KNOCKBACK_SPEED = 2500; // Knockback velocity speed - VERY strong
const KNOCKBACK_FRICTION = 0.94; // Friction for smooth knockback decay (higher = longer)

// Bomb constants
const BOMB_DAMAGE = 25;
const BOMB_RADIUS = 120;
const BOMB_FUSE_TIME = 2.0;
const BOMB_COOLDOWN = 3.0;
const BOMB_THROW_DISTANCE = 300;
const BOMB_FLY_SPEED = 500; // Speed at which bomb flies

// Health pickup constants
const HEALTH_SPAWN_INTERVAL = 15; // Seconds between spawns
const MAX_HEALTH_PICKUPS = 4;
const HEALTH_HEAL_AMOUNT = 30;
const HEALTH_PICKUP_RADIUS = 25; // Increased for visibility

// Gun pickup constants
const GUN_SPAWN_INTERVAL = 20; // Seconds between gun spawns
const MAX_GUN_PICKUPS = 2; // Allow up to 2 guns at a time
const GUN_PICKUP_RADIUS = 25;
const BULLET_SPEED = 1200;
const BULLET_DAMAGE = 40;
const BULLET_RADIUS = 8;

// Sword pickup constants
const SWORD_SPAWN_INTERVAL = 15; // Seconds between sword spawns
const MAX_SWORD_PICKUPS = 2; // Allow up to 2 swords at a time
const SWORD_PICKUP_RADIUS = 25;
const THROWN_SWORD_SPEED = 900;
const THROWN_SWORD_DAMAGE = 35;
const THROWN_SWORD_RADIUS = 15;

// Bomb pickup constants
const BOMB_SPAWN_INTERVAL = 10; // Seconds between bomb spawns
const MAX_BOMB_PICKUPS = 3; // Allow up to 3 bombs at a time
const BOMB_PICKUP_RADIUS = 25;

// Center spawn cluster radius for all pickups
const CENTER_SPAWN_RADIUS = 100;

// Terrain constants
const WATER_SPEED_MOD = 0.5;
const BUSH_SPEED_MOD = 0.7;

// Tile types
const TILE_FLOOR = 0;
const TILE_WALL = 1;
const TILE_WALL_TOP = 2;
const TILE_GRASS = 3;
const TILE_WATER = 4;
const TILE_BUSH = 5;
const TILE_STONE = 6;

const COLORS = {
  player: '#3b82f6',
  enemy: '#ef4444',
  wall: '#52525b',
  blood: '#dc2626',
  shield: '#fbbf24',
  playerDodge: '#93c5fd',
  bomb: '#f97316',
  explosion: '#fbbf24',
  explosionInner: '#ef4444'
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

// Seeded random for consistent arena generation
const seededRandom = (seed: number) => {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
};

// Arena generation with terrain variety
const generateArena = (): { walls: Wall[], tileMap: number[][], obstacles: Obstacle[] } => {
  const walls: Wall[] = [];
  const obstacles: Obstacle[] = [];
  const cols = Math.ceil(CANVAS_WIDTH / TILE_SIZE);
  const rows = Math.ceil(CANVAS_HEIGHT / TILE_SIZE);
  const tileMap: number[][] = Array(rows).fill(0).map(() => Array(cols).fill(TILE_FLOOR));

  const centerX = cols / 2;
  const centerY = rows / 2;
  const arenaRadius = Math.min(cols, rows) / 2 - 2;

  let seed = 12345;

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const d = Math.hypot(x - centerX, y - centerY);

      if (d > arenaRadius) {
        // Outside arena - Solid wall
        tileMap[y][x] = TILE_WALL_TOP;
        if (y < rows - 1 && Math.hypot(x - centerX, (y + 1) - centerY) <= arenaRadius) {
          tileMap[y][x] = TILE_WALL;
        }
      } else if (d > arenaRadius - 1) {
        // Arena edge - floor
        tileMap[y][x] = TILE_FLOOR;
      } else {
        // Inside arena - varied terrain
        seed++;
        const rand = seededRandom(seed);
        const rand2 = seededRandom(seed + 1000); // Second random for obstacles

        // Only grass for now - clean arena
        tileMap[y][x] = TILE_GRASS;

        // DISABLED: Water pools - kept for future use
        // if (rand > 0.92 && d < arenaRadius - 3) {
        //   // Create small water cluster
        //   for (let dy = -1; dy <= 1; dy++) {
        //     for (let dx = -1; dx <= 1; dx++) {
        //       const ny = y + dy;
        //       const nx = x + dx;
        //       if (ny >= 0 && ny < rows && nx >= 0 && nx < cols) {
        //         const nd = Math.hypot(nx - centerX, ny - centerY);
        //         if (nd < arenaRadius - 2) {
        //           tileMap[ny][nx] = TILE_WATER;
        //         }
        //       }
        //     }
        //   }
        // }

        // DISABLED: Bush tile patches - kept for future use
        // if (rand > 0.90 && rand <= 0.94 && d < arenaRadius - 2) {
        //   tileMap[y][x] = TILE_BUSH;
        // }

        // DISABLED: Stone tile obstacles - kept for future use
        // if (rand > 0.99 && d < arenaRadius - 4 && d > 3) {
        //   tileMap[y][x] = TILE_STONE;
        // }

        // DISABLED: Tree obstacles - kept for future use
        // if (rand2 > 0.99 && d < arenaRadius - 4 && d > 3) {
        //   obstacles.push({
        //     id: `tree-${x}-${y}`,
        //     pos: { x: x * TILE_SIZE + TILE_SIZE / 2, y: y * TILE_SIZE + TILE_SIZE / 2 },
        //     obstacleType: 'tree',
        //     hp: 50, // Can be destroyed by bombs
        //     radius: 24,
        //     destroyed: false
        //   });
        // }

        // DISABLED: Rock obstacles - kept for future use
        // if (rand2 > 0.995 && rand2 <= 0.997 && d < arenaRadius - 4 && d > 3) {
        //   obstacles.push({
        //     id: `rock-${x}-${y}`,
        //     pos: { x: x * TILE_SIZE + TILE_SIZE / 2, y: y * TILE_SIZE + TILE_SIZE / 2 },
        //     obstacleType: 'rock',
        //     hp: -1, // Indestructible
        //     radius: 28,
        //     destroyed: false
        //   });
        // }

        // DISABLED: Bush obstacles - kept for future use
        // if (rand2 > 0.993 && rand2 <= 0.995 && d < arenaRadius - 3 && d > 2) {
        //   obstacles.push({
        //     id: `bush-${x}-${y}`,
        //     pos: { x: x * TILE_SIZE + TILE_SIZE / 2, y: y * TILE_SIZE + TILE_SIZE / 2 },
        //     obstacleType: 'bush',
        //     hp: 20, // Easily destroyed
        //     radius: 20,
        //     destroyed: false
        //   });
        // }
      }
    }
  }

  return { walls, tileMap, obstacles };
};

const createPlayer = (id: string, index: number): Player => {
  // Spawn players at perimeter of arena, facing center
  const centerX = CANVAS_WIDTH / 2;  // 2400
  const centerY = CANVAS_HEIGHT / 2; // 1800
  const spawnRadius = 1500; // Distance from center to spawn point

  // For 2 players, spawn at opposite sides (index 0 = left, index 1 = right)
  const spawnAngle = index === 0 ? Math.PI : 0;
  const spawnX = centerX + Math.cos(spawnAngle) * spawnRadius;
  const spawnY = centerY + Math.sin(spawnAngle) * spawnRadius;

  // Face toward center
  const faceAngle = Math.atan2(centerY - spawnY, centerX - spawnX);

  return {
    id: `p-${id}`,
    playerId: id,
    type: EntityType.PLAYER,
    pos: { x: spawnX, y: spawnY },
    vel: { x: 0, y: 0 },
    radius: 20,
    color: index === 0 ? COLORS.player : COLORS.enemy,
    active: true,
    hp: PLAYER_HP,
    maxHp: PLAYER_HP,
    isDodging: false,
    dodgeTimer: 0,
    cooldown: 0,
    knockbackVel: { x: 0, y: 0 },
    angle: faceAngle,
    isBlocking: false,
    isAttacking: false,
    attackTimer: 0,
    attackCooldown: 0,
    bombCooldown: 0,
    hasGun: false,
    hasSword: false, // Start unarmed - must pick up weapons
    hasBomb: false,  // Start without bomb
    score: 0
  };
};

const createGunPickup = (x: number, y: number): GunPickup => ({
  id: `gun-${Math.random()}`,
  pos: { x, y },
  active: true
});

const createSwordPickup = (x: number, y: number): SwordPickup => ({
  id: `sword-${Math.random()}`,
  pos: { x, y },
  active: true
});

const createBombPickup = (x: number, y: number): BombPickup => ({
  id: `bomb-pickup-${Math.random()}`,
  pos: { x, y },
  active: true
});

// Helper function to spawn items at center cluster
const spawnAtCenter = (): Vector2 => {
  const angle = Math.random() * Math.PI * 2;
  const radius = Math.random() * CENTER_SPAWN_RADIUS;
  return {
    x: CANVAS_WIDTH / 2 + Math.cos(angle) * radius,
    y: CANVAS_HEIGHT / 2 + Math.sin(angle) * radius
  };
};

const createThrownSword = (pos: Vector2, angle: number, ownerId: string): ThrownSword => ({
  id: `thrown-sword-${Math.random()}`,
  pos: { x: pos.x, y: pos.y },
  vel: { x: Math.cos(angle) * THROWN_SWORD_SPEED, y: Math.sin(angle) * THROWN_SWORD_SPEED },
  ownerId,
  active: true
});

const createBullet = (pos: Vector2, angle: number, ownerId: string): Bullet => ({
  id: `bullet-${Math.random()}`,
  pos: { x: pos.x, y: pos.y },
  vel: { x: Math.cos(angle) * BULLET_SPEED, y: Math.sin(angle) * BULLET_SPEED },
  ownerId,
  active: true
});

const createParticle = (pos: Vector2, color: string, speedMod: number, particleType?: 'blood' | 'spark' | 'explosion' | 'trail' | 'water'): Particle => {
  const angle = Math.random() * Math.PI * 2;
  const speed = Math.random() * 80 * speedMod; // Increased base speed
  // Blood particles are bigger
  const radius = particleType === 'blood' ? (Math.random() * 6 + 3) : (Math.random() * 3 + 1);
  return {
    id: `p-${Math.random()}`,
    type: EntityType.PARTICLE,
    pos: { ...pos },
    vel: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
    radius: radius,
    color: color,
    active: true,
    life: particleType === 'blood' ? 1.5 : 1.0, // Blood lasts longer
    decay: Math.random() * 3 + 2,
    particleType
  };
};

const createBomb = (pos: Vector2, ownerId: string, angle: number): Bomb => {
  // Bomb starts at player position and flies toward target
  return {
    id: `bomb-${Math.random()}`,
    type: EntityType.BOMB,
    pos: { x: pos.x, y: pos.y },
    vel: { x: Math.cos(angle) * BOMB_FLY_SPEED, y: Math.sin(angle) * BOMB_FLY_SPEED },
    radius: 16,
    color: COLORS.bomb,
    active: true,
    fuseTimer: BOMB_FUSE_TIME,
    ownerId
  };
};

const createHealthPickup = (x: number, y: number): HealthPickup => ({
  id: `health-${Math.random()}`,
  pos: { x, y },
  active: true,
  healAmount: HEALTH_HEAL_AMOUNT
});

const getTileAt = (tileMap: number[][], x: number, y: number): number => {
  const tx = Math.floor(x / TILE_SIZE);
  const ty = Math.floor(y / TILE_SIZE);
  if (ty < 0 || ty >= tileMap.length || tx < 0 || tx >= tileMap[0].length) return TILE_WALL;
  return tileMap[ty][tx];
};

const checkWallCollision = (player: Player, tileMap: number[][]): boolean => {
  if (!tileMap) return false;
  const checkPoint = (px: number, py: number) => {
    const tx = Math.floor(px / TILE_SIZE);
    const ty = Math.floor(py / TILE_SIZE);
    if (ty < 0 || ty >= tileMap.length || tx < 0 || tx >= tileMap[0].length) return true;
    const tile = tileMap[ty][tx];
    // Wall, wall top, and stone are non-walkable
    return tile === TILE_WALL || tile === TILE_WALL_TOP || tile === TILE_STONE;
  };
  const r = player.radius;
  const points = [
    { x: player.pos.x + r, y: player.pos.y },
    { x: player.pos.x - r, y: player.pos.y },
    { x: player.pos.x, y: player.pos.y + r },
    { x: player.pos.x, y: player.pos.y - r },
    { x: player.pos.x + r * 0.7, y: player.pos.y + r * 0.7 },
    { x: player.pos.x - r * 0.7, y: player.pos.y + r * 0.7 },
    { x: player.pos.x + r * 0.7, y: player.pos.y - r * 0.7 },
    { x: player.pos.x - r * 0.7, y: player.pos.y - r * 0.7 },
  ];
  return points.some(p => checkPoint(p.x, p.y));
};

const checkObstacleCollision = (pos: Vector2, radius: number, obstacles: Obstacle[]): Obstacle | null => {
  for (const obs of obstacles) {
    if (obs.destroyed) continue;
    const d = dist(pos, obs.pos);
    if (d < radius + obs.radius) {
      return obs;
    }
  }
  return null;
};

const getTerrainSpeedModifier = (tileMap: number[][], pos: Vector2): number => {
  const tile = getTileAt(tileMap, pos.x, pos.y);
  if (tile === TILE_WATER) return WATER_SPEED_MOD;
  if (tile === TILE_BUSH) return BUSH_SPEED_MOD;
  return 1.0;
};

export default class GameRoom implements Party.Server {
  state: GameState;
  inputs: Record<string, PlayerInput> = {};
  hostId: string | null = null;
  gameLoop: ReturnType<typeof setInterval> | null = null;

  constructor(readonly room: Party.Room) {
    const { walls, tileMap, obstacles } = generateArena();
    this.state = {
      status: 'LOBBY',
      shake: 0,
      players: {},
      particles: [],
      walls: walls,
      bombs: [],
      obstacles: obstacles,
      healthPickups: [],
      gunPickups: [],
      swordPickups: [],
      bombPickups: [],
      bullets: [],
      thrownSwords: [],
      tileMap: tileMap,
      lastHealthSpawnTime: 0,
      lastGunSpawnTime: 0,
      lastSwordSpawnTime: 0,
      lastBombSpawnTime: 0
    };
  }

  onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
    const playerId = conn.id;
    if (!this.hostId) {
      this.hostId = playerId;
    }
    const playerIndex = Object.keys(this.state.players).length;
    this.state.players[playerId] = createPlayer(playerId, playerIndex);
    conn.send(JSON.stringify({
      type: 'STATE',
      payload: this.state,
      yourId: playerId,
      isHost: playerId === this.hostId
    }));
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
            const { walls, tileMap, obstacles } = generateArena();
            this.state = {
              status: 'PLAYING',
              shake: 0,
              players: {},
              particles: [],
              walls: walls,
              bombs: [],
              obstacles: obstacles,
              healthPickups: [],
              gunPickups: [],
              swordPickups: [],
              bombPickups: [],
              bullets: [],
              thrownSwords: [],
              tileMap: tileMap,
              lastHealthSpawnTime: 0,
              lastGunSpawnTime: 0,
              lastSwordSpawnTime: 0,
              lastBombSpawnTime: 0
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
    delete this.state.players[playerId];
    delete this.inputs[playerId];
    if (playerId === this.hostId) {
      const remaining = Object.keys(this.state.players);
      this.hostId = remaining[0] || null;
    }
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
    }, 1000 / 60);
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
    let newBombs = [...this.state.bombs];
    let newShake = Math.max(0, this.state.shake - 1);
    const playerIds = Object.keys(this.state.players);
    let activeCount = 0;
    let lastSurvivor = '';

    // Update bombs - move them like grenades
    newBombs = newBombs.filter(bomb => {
      bomb.fuseTimer -= DT;

      // Move bomb (flying like grenade)
      bomb.pos.x += bomb.vel.x * DT;
      bomb.pos.y += bomb.vel.y * DT;
      
      // Apply friction to slow down
      bomb.vel.x *= 0.98;
      bomb.vel.y *= 0.98;

      // Add spark particles while fuse is burning
      if (Math.random() > 0.7) {
        newParticles.push(createParticle(
          { x: bomb.pos.x, y: bomb.pos.y - 20 },
          '#f472b6', // Pink spark
          2,
          'spark'
        ));
      }

      if (bomb.fuseTimer <= 0) {
        // EXPLODE!
        newShake += 20;

        // Create explosion particles
        for (let i = 0; i < 30; i++) {
          newParticles.push(createParticle(bomb.pos, COLORS.explosion, 8, 'explosion'));
        }
        for (let i = 0; i < 15; i++) {
          newParticles.push(createParticle(bomb.pos, COLORS.explosionInner, 6, 'explosion'));
        }

        // Damage players in radius
        playerIds.forEach(pid => {
          const player = this.state.players[pid];
          if (!player.active) return;
          const d = dist(bomb.pos, player.pos);
          if (d < BOMB_RADIUS) {
            // Damage falls off with distance
            const damageMultiplier = 1 - (d / BOMB_RADIUS);
            const damage = Math.floor(BOMB_DAMAGE * damageMultiplier);
            if (!player.isDodging && player.hp > 0) {
              player.hp = Math.max(0, player.hp - damage);
              for (let i = 0; i < 8; i++) {
                newParticles.push(createParticle(player.pos, COLORS.blood, 5, 'blood'));
              }
              // Knockback
              const knockDir = normalize({ x: player.pos.x - bomb.pos.x, y: player.pos.y - bomb.pos.y });
              player.pos.x += knockDir.x * 60 * damageMultiplier;
              player.pos.y += knockDir.y * 60 * damageMultiplier;

              if (player.hp <= 0) {
                player.active = false;
                newShake += 10;
                for (let i = 0; i < 15; i++) {
                  newParticles.push(createParticle(player.pos, COLORS.blood, 8, 'blood'));
                }
              }
            }
          }
        });

        // Damage obstacles
        this.state.obstacles.forEach(obs => {
          if (obs.destroyed || obs.hp < 0) return;
          const d = dist(bomb.pos, obs.pos);
          if (d < BOMB_RADIUS + obs.radius) {
            obs.hp -= BOMB_DAMAGE;
            if (obs.hp <= 0) {
              obs.destroyed = true;
              // Destruction particles
              for (let i = 0; i < 10; i++) {
                newParticles.push(createParticle(obs.pos, obs.obstacleType === 'tree' ? '#22c55e' : '#78716c', 4));
              }
            }
          }
        });

        return false; // Remove bomb
      }
      return true;
    });

    // Spawn health pickups at center cluster (max 4)
    // Spawn one immediately if none exist
    if (this.state.healthPickups.length === 0) {
      const spawnPos = spawnAtCenter();
      console.log('[SERVER] Spawning health pickup at center:', spawnPos.x, spawnPos.y);
      this.state.healthPickups.push(createHealthPickup(spawnPos.x, spawnPos.y));
      this.state.lastHealthSpawnTime = 0;
    }

    this.state.lastHealthSpawnTime += DT;
    if (this.state.lastHealthSpawnTime >= HEALTH_SPAWN_INTERVAL && this.state.healthPickups.length < MAX_HEALTH_PICKUPS) {
      const spawnPos = spawnAtCenter();
      this.state.healthPickups.push(createHealthPickup(spawnPos.x, spawnPos.y));
      this.state.lastHealthSpawnTime = 0;
    }

    // Spawn gun pickup at center cluster (max 2)
    this.state.lastGunSpawnTime += DT;
    if (this.state.lastGunSpawnTime >= GUN_SPAWN_INTERVAL && this.state.gunPickups.length < MAX_GUN_PICKUPS) {
      const spawnPos = spawnAtCenter();
      console.log('[SERVER] Spawning gun pickup at:', spawnPos.x, spawnPos.y);
      this.state.gunPickups.push(createGunPickup(spawnPos.x, spawnPos.y));
      this.state.lastGunSpawnTime = 0;
    }

    // Spawn sword pickup at center cluster (max 2)
    this.state.lastSwordSpawnTime += DT;
    if (this.state.lastSwordSpawnTime >= SWORD_SPAWN_INTERVAL && this.state.swordPickups.length < MAX_SWORD_PICKUPS) {
      const spawnPos = spawnAtCenter();
      this.state.swordPickups.push(createSwordPickup(spawnPos.x, spawnPos.y));
      this.state.lastSwordSpawnTime = 0;
    }

    // Spawn bomb pickup at center cluster (max 3)
    this.state.lastBombSpawnTime += DT;
    if (this.state.lastBombSpawnTime >= BOMB_SPAWN_INTERVAL && this.state.bombPickups.length < MAX_BOMB_PICKUPS) {
      const spawnPos = spawnAtCenter();
      console.log('[SERVER] Spawning bomb pickup at:', spawnPos.x, spawnPos.y);
      this.state.bombPickups.push(createBombPickup(spawnPos.x, spawnPos.y));
      this.state.lastBombSpawnTime = 0;
    }

    // Update bullets
    let newBullets = this.state.bullets.filter(bullet => {
      if (!bullet.active) return false;
      
      // Move bullet
      bullet.pos.x += bullet.vel.x * DT;
      bullet.pos.y += bullet.vel.y * DT;
      
      // Check if out of bounds
      if (bullet.pos.x < 0 || bullet.pos.x > CANVAS_WIDTH || bullet.pos.y < 0 || bullet.pos.y > CANVAS_HEIGHT) {
        return false;
      }
      
      // Check collision with players
      for (const pid of playerIds) {
        if (pid === bullet.ownerId) continue; // Don't hit self
        const target = this.state.players[pid];
        if (!target.active) continue;
        
        const d = dist(bullet.pos, target.pos);
        if (d < target.radius + BULLET_RADIUS) {
          // HIT!
          if (!target.isDodging && target.hp > 0) {
            target.hp = Math.max(0, target.hp - BULLET_DAMAGE);
            newShake += 15;
            
            // Blood splash
            for (let i = 0; i < 25; i++) {
              newParticles.push(createParticle(target.pos, '#dc2626', 12, 'blood'));
            }
            
            // Knockback from bullet
            const knockDir = normalize(bullet.vel);
            target.knockbackVel.x = knockDir.x * 800;
            target.knockbackVel.y = knockDir.y * 800;
            
            if (target.hp <= 0) {
              target.active = false;
              newShake += 15;
              for (let i = 0; i < 30; i++) {
                newParticles.push(createParticle(target.pos, '#dc2626', 15, 'blood'));
              }
            }
          }
          return false; // Remove bullet
        }
      }
      
      // Trail particles
      if (Math.random() > 0.5) {
        newParticles.push(createParticle(bullet.pos, '#fbbf24', 2, 'trail'));
      }

      return true;
    });

    // Update thrown swords
    let newThrownSwords = this.state.thrownSwords.filter(sword => {
      if (!sword.active) return false;

      // Move sword
      sword.pos.x += sword.vel.x * DT;
      sword.pos.y += sword.vel.y * DT;

      // Check if out of bounds
      if (sword.pos.x < 0 || sword.pos.x > CANVAS_WIDTH || sword.pos.y < 0 || sword.pos.y > CANVAS_HEIGHT) {
        return false;
      }

      // Check collision with players
      for (const pid of playerIds) {
        if (pid === sword.ownerId) continue; // Don't hit self
        const target = this.state.players[pid];
        if (!target.active) continue;

        const d = dist(sword.pos, target.pos);
        if (d < target.radius + THROWN_SWORD_RADIUS) {
          // HIT!
          if (!target.isDodging && target.hp > 0) {
            target.hp = Math.max(0, target.hp - THROWN_SWORD_DAMAGE);
            newShake += 18;

            // Blood splash
            for (let i = 0; i < 30; i++) {
              newParticles.push(createParticle(target.pos, '#dc2626', 14, 'blood'));
            }

            // Knockback from thrown sword
            const knockDir = normalize(sword.vel);
            target.knockbackVel.x = knockDir.x * 1200;
            target.knockbackVel.y = knockDir.y * 1200;

            if (target.hp <= 0) {
              target.active = false;
              newShake += 15;
              for (let i = 0; i < 35; i++) {
                newParticles.push(createParticle(target.pos, '#dc2626', 15, 'blood'));
              }
            }
          }
          return false; // Remove sword
        }
      }

      // Sword trail particles (white/silver)
      if (Math.random() > 0.4) {
        newParticles.push(createParticle(sword.pos, '#e5e7eb', 3, 'trail'));
      }

      return true;
    });

    // Update health pickups
    let newHealthPickups = this.state.healthPickups.filter(hp => hp.active);

    // Update gun pickups
    let newGunPickups = this.state.gunPickups.filter(gp => gp.active);

    // Update sword pickups
    let newSwordPickups = this.state.swordPickups.filter(sp => sp.active);

    // Update bomb pickups
    let newBombPickups = this.state.bombPickups.filter(bp => bp.active);

    playerIds.forEach(pid => {
      const player = this.state.players[pid];
      if (!player.active) return;
      activeCount++;
      lastSurvivor = pid;

      const input = this.inputs[pid] || { keys: [], mouse: player.pos, mouseDown: false, mouseRightDown: false, throwBomb: false };
      const keySet = new Set(input.keys);

      // Cooldowns
      player.attackCooldown = Math.max(0, player.attackCooldown - DT);
      player.cooldown = Math.max(0, player.cooldown - DT);
      player.attackTimer = Math.max(0, player.attackTimer - DT);
      player.bombCooldown = Math.max(0, player.bombCooldown - DT);

      // Aiming
      const dx = input.mouse.x - player.pos.x;
      const dy = input.mouse.y - player.pos.y;
      player.angle = Math.atan2(dy, dx);

      // Sword throwing (right-click) - throw sword if player has one
      player.isBlocking = false; // Shield removed - no more blocking
      if (input.mouseRightDown && player.hasSword && player.attackCooldown <= 0 && !player.isDodging && !player.isAttacking) {
        // Throw the sword
        const thrownSword = createThrownSword(player.pos, player.angle || 0, pid);
        newThrownSwords.push(thrownSword);
        player.hasSword = false; // Player loses sword after throwing
        player.attackCooldown = 0.3; // Short cooldown
        newShake += 3;
        // Throw particles
        for (let i = 0; i < 6; i++) {
          newParticles.push(createParticle(player.pos, '#e5e7eb', 4, 'spark'));
        }
      }

      // Bomb throwing (E key) - requires bomb pickup
      if (input.throwBomb && player.hasBomb && !player.isDodging) {
        // Calculate angle directly from mouse position to ensure accurate direction
        const bombDx = input.mouse.x - player.pos.x;
        const bombDy = input.mouse.y - player.pos.y;
        const bombAngle = Math.atan2(bombDy, bombDx);
        const bomb = createBomb(player.pos, pid, bombAngle);
        // Check if bomb lands on valid terrain
        if (this.state.tileMap) {
          const tile = getTileAt(this.state.tileMap, bomb.pos.x, bomb.pos.y);
          if (tile !== TILE_WALL && tile !== TILE_WALL_TOP && tile !== TILE_STONE) {
            newBombs.push(bomb);
            player.hasBomb = false; // Consume bomb after throwing
          }
        } else {
          newBombs.push(bomb);
          player.hasBomb = false; // Consume bomb after throwing
        }
        // Orange throw particles
        for (let i = 0; i < 6; i++) {
          newParticles.push(createParticle(player.pos, '#f97316', 4, 'spark'));
        }
      }

      // Attack - if has gun, shoot; if has sword, melee attack
      if (input.mouseDown && player.attackCooldown <= 0 && !player.isDodging) {
        if (player.hasGun) {
          // SHOOT GUN - creates bullet and removes gun
          const bullet = createBullet(player.pos, player.angle || 0, pid);
          newBullets.push(bullet);
          player.hasGun = false; // Gun disappears after one shot
          player.attackCooldown = 0.3; // Short cooldown
          newShake += 5;
          // Muzzle flash particles
          for (let i = 0; i < 8; i++) {
            newParticles.push(createParticle(player.pos, '#fbbf24', 6, 'spark'));
          }
        } else if (player.hasSword) {
          // Sword melee attack (only if player has sword)
          player.isAttacking = true;
          player.attackTimer = SWORD_ATTACK_DURATION;
          player.attackCooldown = SWORD_COOLDOWN;

          // Sword trail particles
          for (let i = 0; i < 3; i++) {
            const trailAngle = (player.angle || 0) + (Math.random() - 0.5) * 0.5;
            const trailDist = 40 + Math.random() * 20;
            newParticles.push(createParticle(
              { x: player.pos.x + Math.cos(trailAngle) * trailDist, y: player.pos.y + Math.sin(trailAngle) * trailDist },
              '#ffffff',
              2,
              'trail'
            ));
          }

          playerIds.forEach(targetId => {
            if (targetId === pid) return;
            const target = this.state.players[targetId];
            if (!target.active) return;

            const d = dist(player.pos, target.pos);
            if (d < SWORD_RANGE) {
              const angleToTarget = Math.atan2(target.pos.y - player.pos.y, target.pos.x - player.pos.x);
              const aDiff = angleDiff(player.angle || 0, angleToTarget);

              if (aDiff < SWORD_ARC / 2) {
                // No more shield blocking - direct hit
                if (!target.isDodging && target.hp > 0) {
                  target.hp = Math.max(0, target.hp - SWORD_DAMAGE);
                  newShake += 20;

                  // MASSIVE blood splash effect - many particles flying in all directions
                  for (let i = 0; i < 35; i++) {
                    newParticles.push(createParticle(target.pos, '#dc2626', 15, 'blood')); // Dark red
                  }
                  for (let i = 0; i < 25; i++) {
                    newParticles.push(createParticle(target.pos, '#ef4444', 12, 'blood')); // Bright red
                  }
                  for (let i = 0; i < 15; i++) {
                    newParticles.push(createParticle(target.pos, '#b91c1c', 10, 'blood')); // Even darker red
                  }

                  // STRONG knockback - use separate knockbackVel that overrides movement
                  const knockDir = normalize({ x: target.pos.x - player.pos.x, y: target.pos.y - player.pos.y });
                  target.knockbackVel.x = knockDir.x * SWORD_KNOCKBACK_SPEED;
                  target.knockbackVel.y = knockDir.y * SWORD_KNOCKBACK_SPEED;

                  if (target.hp <= 0) {
                    target.active = false;
                    newShake += 15;
                    for (let i = 0; i < 25; i++) newParticles.push(createParticle(target.pos, '#dc2626', 12, 'blood'));
                  }
                }
              }
            }
          });
        }
      }

      if (player.attackTimer <= 0) player.isAttacking = false;

      // Dodge - only in movement direction (WASD), not mouse direction
      if (keySet.has(' ') && !player.isDodging && player.cooldown <= 0) {
        let dashDir = { x: 0, y: 0 };
        if (keySet.has('w')) dashDir.y -= 1;
        if (keySet.has('s')) dashDir.y += 1;
        if (keySet.has('a')) dashDir.x -= 1;
        if (keySet.has('d')) dashDir.x += 1;

        // Only dodge if player is moving (has movement keys pressed)
        if (dashDir.x !== 0 || dashDir.y !== 0) {
          dashDir = normalize(dashDir);
          player.isDodging = true;
          player.dodgeTimer = PLAYER_DODGE_DURATION;
          player.cooldown = PLAYER_DODGE_COOLDOWN;
          player.vel = { x: dashDir.x * PLAYER_DODGE_SPEED, y: dashDir.y * PLAYER_DODGE_SPEED };

          for (let i = 0; i < 5; i++) newParticles.push(createParticle(player.pos, COLORS.playerDodge, 3, 'trail'));
        }
      }

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

        // Apply terrain speed modifier
        if (this.state.tileMap) {
          speed *= getTerrainSpeedModifier(this.state.tileMap, player.pos);
        }

        player.vel = { x: moveDir.x * speed, y: moveDir.y * speed };
      }

      // Apply knockback friction (separate from movement)
      player.knockbackVel.x *= KNOCKBACK_FRICTION;
      player.knockbackVel.y *= KNOCKBACK_FRICTION;
      // Stop very small knockback velocities
      if (Math.abs(player.knockbackVel.x) < 5) player.knockbackVel.x = 0;
      if (Math.abs(player.knockbackVel.y) < 5) player.knockbackVel.y = 0;

      const oldX = player.pos.x;
      const oldY = player.pos.y;

      // Apply both movement and knockback
      player.pos.x += (player.vel.x + player.knockbackVel.x) * DT;
      player.pos.y += (player.vel.y + player.knockbackVel.y) * DT;

      // Wall collision
      if (this.state.tileMap && checkWallCollision(player, this.state.tileMap)) {
        player.pos.x = oldX;
        player.pos.y = oldY;
      }

      // Obstacle collision
      const collidedObstacle = checkObstacleCollision(player.pos, player.radius, this.state.obstacles);
      if (collidedObstacle) {
        player.pos.x = oldX;
        player.pos.y = oldY;
      }

      player.pos.x = clamp(player.pos.x, player.radius, CANVAS_WIDTH - player.radius);
      player.pos.y = clamp(player.pos.y, player.radius, CANVAS_HEIGHT - player.radius);

      // Health pickup collision
      newHealthPickups.forEach(hp => {
        if (!hp.active) return;
        const d = dist(player.pos, hp.pos);
        if (d < player.radius + HEALTH_PICKUP_RADIUS) {
          // Heal player
          player.hp = Math.min(player.maxHp || PLAYER_HP, player.hp + hp.healAmount);
          hp.active = false;
          // Green healing particles
          for (let i = 0; i < 15; i++) {
            newParticles.push(createParticle(player.pos, '#22c55e', 5, 'spark'));
          }
        }
      });

      // Gun pickup collision - one item at a time
      newGunPickups.forEach(gp => {
        if (!gp.active) return;
        if (player.hasGun) return; // Already has gun
        const d = dist(player.pos, gp.pos);
        if (d < player.radius + GUN_PICKUP_RADIUS) {
          // Pick up gun - drop any other item
          player.hasGun = true;
          player.hasSword = false;
          player.hasBomb = false;
          gp.active = false;
          // Yellow pickup particles
          for (let i = 0; i < 12; i++) {
            newParticles.push(createParticle(player.pos, '#fbbf24', 5, 'spark'));
          }
        }
      });

      // Sword pickup collision - one item at a time
      newSwordPickups.forEach(sp => {
        if (!sp.active) return;
        if (player.hasSword) return; // Already has sword
        const d = dist(player.pos, sp.pos);
        if (d < player.radius + SWORD_PICKUP_RADIUS) {
          // Pick up sword - drop any other item
          player.hasSword = true;
          player.hasGun = false;
          player.hasBomb = false;
          sp.active = false;
          // Silver/white pickup particles
          for (let i = 0; i < 12; i++) {
            newParticles.push(createParticle(player.pos, '#e5e7eb', 5, 'spark'));
          }
        }
      });

      // Bomb pickup collision - one item at a time
      newBombPickups.forEach(bp => {
        if (!bp.active) return;
        if (player.hasBomb) return; // Already has bomb
        const d = dist(player.pos, bp.pos);
        if (d < player.radius + BOMB_PICKUP_RADIUS) {
          // Pick up bomb - drop any other item
          player.hasBomb = true;
          player.hasGun = false;
          player.hasSword = false;
          bp.active = false;
          // Orange pickup particles
          for (let i = 0; i < 12; i++) {
            newParticles.push(createParticle(player.pos, '#f97316', 5, 'spark'));
          }
        }
      });

      // Water splash particles
      if (this.state.tileMap) {
        const tile = getTileAt(this.state.tileMap, player.pos.x, player.pos.y);
        if (tile === TILE_WATER && Math.random() > 0.9 && (player.vel.x !== 0 || player.vel.y !== 0)) {
          newParticles.push(createParticle(player.pos, '#60a5fa', 1, 'water'));
        }
      }
    });

    // Filter collected health pickups
    newHealthPickups = newHealthPickups.filter(hp => hp.active);

    // Update particles
    newParticles.forEach(p => {
      p.pos.x += p.vel.x * DT;
      p.pos.y += p.vel.y * DT;
      p.life -= DT * p.decay;
    });
    newParticles = newParticles.filter(p => p.life > 0);

    // Victory check
    if (activeCount === 1 && playerIds.length > 1) {
      this.state.status = 'VICTORY';
      this.state.winnerId = lastSurvivor;
      this.stopGameLoop();
    }

    this.state.particles = newParticles;
    this.state.bombs = newBombs;
    this.state.healthPickups = newHealthPickups;
    this.state.gunPickups = newGunPickups.filter(gp => gp.active);
    this.state.swordPickups = newSwordPickups.filter(sp => sp.active);
    this.state.bombPickups = newBombPickups.filter(bp => bp.active);
    this.state.bullets = newBullets;
    this.state.thrownSwords = newThrownSwords;
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
