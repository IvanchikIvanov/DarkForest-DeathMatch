import type * as Party from "partykit/server";
import { OpenGameClient } from "@playdotfun/server-sdk";

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
  heroType?: 'kenny' | 'cartman' | 'kyle' | 'stanNinja' | 'snoopDogg' | 'superhero';
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
  hasChainsaw: boolean; // Has picked up chainsaw (melee like sword)
  hasBomb: boolean;
  hasShurikens: boolean;
  hasBurningGrenade: boolean;
  hasMinigun: boolean;
  hasFlamethrower: boolean;
  flamethrowerCooldown?: number;
  isFlamethrowerFiring?: boolean;
  score: number;
  speedMod: number;      // Movement speed multiplier (1 = base)
  gunCooldown: number;   // Cooldown after shooting (lower = faster fire)
  canThrowSword: boolean;
  teamId?: 0 | 1;
  elevation?: number;
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

interface MinigunPickup {
  id: string;
  pos: Vector2;
  active: boolean;
}

interface SwordPickup {
  id: string;
  pos: Vector2;
  active: boolean;
}

interface ChainsawPickup {
  id: string;
  pos: Vector2;
  active: boolean;
}

interface BombPickup {
  id: string;
  pos: Vector2;
  active: boolean;
}

interface ShurikenPickup {
  id: string;
  pos: Vector2;
  active: boolean;
}

interface ShurikenProjectile {
  id: string;
  pos: Vector2;
  vel: Vector2;
  rot: number;
  ownerId: string;
  returning: boolean;
  life: number;
  hitPlayerIds: string[];
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

interface Unicorn {
  id: string;
  pos: Vector2;
  vel: Vector2;
  angle: number;
  active: boolean;
}

interface Satan {
  id: string;
  pos: Vector2;
  createdAt: number;
  lastStrikeAt: number;
  lightningTarget: Vector2 | null;
  riftOpen: number; // 0 to 150, ground splits
  visibleY: number; // animates from pos.y+250 to pos.y (rising)
  riftState: 'shaking' | 'opening' | 'rising' | 'active';
}

interface BurningGrenadePickup {
  id: string;
  pos: Vector2;
  active: boolean;
}

interface BurningGrenade {
  id: string;
  startPos: Vector2;
  targetPos: Vector2;
  progress: number;
  arcHeight: number;
  ownerId: string;
  active: boolean;
}

interface FlamethrowerPickup {
  id: string;
  pos: Vector2;
  active: boolean;
}

interface Flame {
  id: string;
  pos: Vector2;
  vel: Vector2;
  ownerId: string;
  active: boolean;
  life: number;
  maxLife: number;
  size?: number;
}

interface FireZone {
  id: string;
  pos: Vector2;
  radius: number;
  maxRadius: number;
  duration: number;
  createdAt: number;
  active: boolean;
}

interface Flag {
  id: string;
  teamId: 0 | 1;
  pos: Vector2;
  carriedBy: string | null;
  basePos: Vector2;
}

interface GameState {
  players: Record<string, Player>;
  particles: Particle[];
  walls: Wall[];
  bombs: Bomb[];
  obstacles: Obstacle[];
  healthPickups: HealthPickup[];
  gunPickups: GunPickup[];
  minigunPickups: MinigunPickup[];
  swordPickups: SwordPickup[];
  chainsawPickups: ChainsawPickup[];
  bombPickups: BombPickup[];
  shurikenPickups: ShurikenPickup[];
  burningGrenadePickups: BurningGrenadePickup[];
  burningGrenades: BurningGrenade[];
  fireZones: FireZone[];
  electricPanel: { pos: Vector2; radius: number };
  electricChargerId: string | null; // Player currently healing at panel
  gameMode: 'deathmatch' | 'ctf';
  flags: Flag[];
  winnerTeamId: 0 | 1 | null;
  bullets: Bullet[];
  thrownSwords: ThrownSword[];
  shurikenProjectiles: ShurikenProjectile[];
  unicorns: Unicorn[];
  satan: Satan | null;
  satanSpawnAt: number; // gameTime when to spawn (0 = not set)
  flamethrowerPickups: FlamethrowerPickup[];
  flames: Flame[];
  tileMap?: number[][];
  shake: number;
  status: 'MENU' | 'LOBBY' | 'PLAYING' | 'VICTORY';
  winnerId?: string;
  lastHealthSpawnTime: number;
  lastGunSpawnTime: number;
  lastSwordSpawnTime: number;
  lastChainsawSpawnTime: number;
  lastBombSpawnTime: number;
  lastShurikenSpawnTime: number;
  lastBurningGrenadeSpawnTime: number;
  lastMinigunSpawnTime: number;
  lastFlamethrowerSpawnTime: number;
  unicornSpawnAt: number; // seconds from game start when to spawn herd (0 = not set)
  gameTime: number; // seconds elapsed since PLAYING started
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
const MINIGUN_COOLDOWN = 0.05; // Rapid fire
const MINIGUN_BULLET_SPREAD = 0.1; // Radians
const MINIGUN_SPAWN_INTERVAL = 25;
const MAX_MINIGUN_PICKUPS = 1;
const BULLET_SPEED = 1200;
const BULLET_DAMAGE = 40;
const BULLET_RADIUS = 8;

// Sword pickup constants
const SWORD_SPAWN_INTERVAL = 15; // Seconds between sword spawns
const MAX_SWORD_PICKUPS = 2; // Allow up to 2 swords at a time
const SWORD_PICKUP_RADIUS = 25;

// Chainsaw pickup constants (same as sword)
const CHAINSAW_SPAWN_INTERVAL = 15;
const MAX_CHAINSAW_PICKUPS = 2;
const CHAINSAW_PICKUP_RADIUS = 25;
const THROWN_SWORD_SPEED = 900;
const THROWN_SWORD_DAMAGE = 35;
const THROWN_SWORD_LENGTH = 250; // Full blade length for hit detection
const THROWN_SWORD_WIDTH = 80;  // Blade width for hitbox (generous for reliable hits)

// Unicorn herd constants
const UNICORN_SPAWN_DELAY_MIN = 8; // seconds
const UNICORN_SPAWN_DELAY_MAX = 25;
const UNICORN_SPEED = 550;
const UNICORN_HIT_RADIUS = 55;
const UNICORN_HERD_SIZE_MIN = 3;
const UNICORN_HERD_SIZE_MAX = 5;

// Satan constants (spawns rarer than unicorns, strikes players with lightning)
const SATAN_SPAWN_DELAY_MIN = 45; // seconds — much rarer than unicorns (8-25)
const SATAN_SPAWN_DELAY_MAX = 90;
const SATAN_DURATION = 18; // seconds on arena
const SATAN_LIGHTNING_INTERVAL = 1.2; // seconds between strikes
const SATAN_LIGHTNING_DAMAGE = 40;
const SATAN_LIGHTNING_VISUAL_FRAMES = 15;
const SATAN_RIFT_OPEN_MAX = 150;
const SATAN_RIFT_OPEN_SPEED = 2.5;
const SATAN_RISE_SPEED = 5;
const SATAN_RISE_OFFSET = 280;

// Shuriken constants
const SHURIKEN_SPEED = 650;
const SHURIKEN_FRICTION = 0.96;
const SHURIKEN_OUTBOUND_LIFE = 60;
const SHURIKEN_RETURN_ACCEL = 1200;
const SHURIKEN_RETURN_MAX_SPEED = 550;
const SHURIKEN_SPREAD = 0.35;
const SHURIKEN_DAMAGE = 28;
const SHURIKEN_HIT_RADIUS = 28;
const SHURIKEN_CATCH_RADIUS = 35;
const SHURIKEN_SPAWN_INTERVAL = 18;
const MAX_SHURIKEN_PICKUPS = 2;

// Burning grenade constants
const BURNING_GRENADE_THROW_DIST = 350;
const BURNING_GRENADE_ARC_HEIGHT = 80;
const BURNING_GRENADE_FLY_SPEED = 0.04; // progress per frame
const FIRE_ZONE_INIT_RADIUS = 95;
const FIRE_ZONE_MAX_RADIUS = 200;
const FIRE_ZONE_GROW_TIME = 3;
const FIRE_ZONE_DURATION = 7;
const FIRE_ZONE_DAMAGE_PER_TICK = 2.5;
const CTF_MATCH_DURATION = 180; // 3 min
const CTF_FLAG_PICKUP_RADIUS = 50;
const CTF_BASE_RADIUS = 150;
const ELECTRIC_PANEL_RADIUS = 120;
const ELECTRIC_PANEL_HEAL_PER_TICK = 0.8; // Fast heal when charging
const ELECTRIC_PANEL_DAMAGE_PER_TICK = 2.5; // Shock damage for non-chargers in zone
const BURNING_GRENADE_SPAWN_INTERVAL = 22;
const MAX_BURNING_GRENADE_PICKUPS = 2;

// Flamethrower constants
const FLAMETHROWER_SPAWN_INTERVAL = 30; // Seconds between spawns
const MAX_FLAMETHROWER_PICKUPS = 2; // Allow up to 2
const FLAMETHROWER_PICKUP_RADIUS = 25;
const FLAMETHROWER_DAMAGE_PER_TICK = 3;
const FLAMETHROWER_RANGE = 400; // Flame travel distance
const FLAMETHROWER_SPREAD = 0.5; // Cone angle
const FLAMETHROWER_COOLDOWN = 0.05; // Rapid fire
const FLAME_LIFESPAN = 0.75; // How long flames exist — longer jet
const FLAME_SPEED = 700; // Faster = longer visible range
const FLAME_SPAWN_OFFSET = 55; // Spawn in front of player, not at center
const FLAME_HIT_RADIUS = 20;

// Bomb pickup constants
const BOMB_SPAWN_INTERVAL = 10; // Seconds between bomb spawns
const MAX_BOMB_PICKUPS = 3; // Allow up to 3 bombs at a time
const BOMB_PICKUP_RADIUS = 25;

// Random spawn across arena (radius in pixels, inside playable circle)
const ARENA_SPAWN_RADIUS_PX =
  (Math.min(
    Math.ceil(CANVAS_WIDTH / TILE_SIZE),
    Math.ceil(CANVAS_HEIGHT / TILE_SIZE)
  ) / 2 -
    4) *
  TILE_SIZE;

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
const TILE_STREET = 7;
const TILE_SIDEWALK = 8;
const TILE_INDOOR_FLOOR = 9;
const TILE_ROOF = 10;
const TILE_STAIRS = 11;

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

interface SetRoomInfoMessage {
  type: 'SET_ROOM_INFO';
  creatorName: string;
  maxPlayers?: number;
  gameMode?: 'deathmatch' | 'ctf';
}

interface AuthSessionMessage {
  type: 'AUTH_SESSION';
  sessionToken: string;
}

type GameMessage = InputMessage | JoinMessage | StartMessage | ResetMessage | SetRoomInfoMessage | AuthSessionMessage;

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

const isFriendlyFire = (state: GameState, attackerId: string, targetId: string): boolean => {
  if (state.gameMode !== 'ctf') return false;
  const a = state.players[attackerId];
  const t = state.players[targetId];
  if (a?.teamId === undefined || t?.teamId === undefined) return false;
  return a.teamId === t.teamId;
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
  const tileMap: number[][] = Array(rows).fill(0).map(() => Array(cols).fill(TILE_GRASS));

  // 1. Draw Streets (Cross pattern)
  const streetWidth = 10;
  const hStreetStart = Math.floor(rows / 2) - Math.floor(streetWidth / 2);
  const vStreetStart = Math.floor(cols / 2) - Math.floor(streetWidth / 2);

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const isHStreet = y >= hStreetStart && y < hStreetStart + streetWidth;
      const isVStreet = x >= vStreetStart && x < vStreetStart + streetWidth;

      if (isHStreet || isVStreet) {
        tileMap[y][x] = TILE_STREET;
      }
      // Sidewalks at the edge of streets
      else if (
        y === hStreetStart - 1 || y === hStreetStart + streetWidth ||
        x === vStreetStart - 1 || x === vStreetStart + streetWidth
      ) {
        tileMap[y][x] = TILE_SIDEWALK;
      }
    }
  }

  // 2. Generate Houses
  // Split into 4 quadrants
  const quadrants = [
    { startX: 2, endX: vStreetStart - 3, startY: 2, endY: hStreetStart - 3 },
    { startX: vStreetStart + streetWidth + 2, endX: cols - 3, startY: 2, endY: hStreetStart - 3 },
    { startX: 2, endX: vStreetStart - 3, startY: hStreetStart + streetWidth + 2, endY: rows - 3 },
    { startX: vStreetStart + streetWidth + 2, endX: cols - 3, startY: hStreetStart + streetWidth + 2, endY: rows - 3 }
  ];

  let objId = 0;

  quadrants.forEach((q, qIndex) => {
    // Generate 1-2 houses per quadrant
    const numHouses = 2;
    for (let h = 0; h < numHouses; h++) {
      const houseWidth = 10 + Math.floor(Math.random() * 6);
      const houseHeight = 8 + Math.floor(Math.random() * 5);

      const px = q.startX + Math.floor(Math.random() * (q.endX - q.startX - houseWidth));
      const py = q.startY + Math.floor(Math.random() * (q.endY - q.startY - houseHeight));

      if (px < 0 || py < 0 || px + houseWidth >= cols || py + houseHeight >= rows) continue;

      // 50% chance to be an open interior house, 50% chance to be a solid climbable roof
      const isOpenHouse = Math.random() > 0.5;

      for (let hy = 0; hy < houseHeight; hy++) {
        for (let hx = 0; hx < houseWidth; hx++) {
          const isEdge = hx === 0 || hy === 0 || hx === houseWidth - 1 || hy === houseHeight - 1;
          const mapY = py + hy;
          const mapX = px + hx;

          if (isOpenHouse) {
            // Check if this edge should be a door (middle of a wall)
            const isDoor = (hy === houseHeight - 1 && hx >= houseWidth / 2 - 1 && hx <= houseWidth / 2 + 1) ||
              (hx === houseWidth - 1 && hy >= houseHeight / 2 - 1 && hy <= houseHeight / 2 + 1 && qIndex % 2 === 0);

            if (isEdge && !isDoor) {
              tileMap[mapY][mapX] = TILE_WALL;
            } else if (isEdge && isDoor) {
              tileMap[mapY][mapX] = TILE_INDOOR_FLOOR;
            } else {
              tileMap[mapY][mapX] = TILE_INDOOR_FLOOR;
            }
          } else {
            // Climbable Roof Block
            tileMap[mapY][mapX] = TILE_ROOF;
          }
        }
      }

      // If it's a climbable house, add stairs outside
      if (!isOpenHouse) {
        let stairPlaced = false;
        // Try to place stairs on the bottom edge
        for (let sx = px + 2; sx < px + houseWidth - 2; sx++) {
          if (!stairPlaced && tileMap[py + houseHeight][sx] === TILE_GRASS) {
            tileMap[py + houseHeight][sx] = TILE_STAIRS;
            stairPlaced = true;
          }
        }
      }
    }

    // Decorate quadrant with trees and bushes
    for (let i = 0; i < 8; i++) {
      const tx = q.startX + Math.floor(Math.random() * (q.endX - q.startX));
      const ty = q.startY + Math.floor(Math.random() * (q.endY - q.startY));
      if (tileMap[ty][tx] === TILE_GRASS) {
        obstacles.push({
          id: `tree-${objId++}`,
          pos: { x: tx * TILE_SIZE + TILE_SIZE / 2, y: ty * TILE_SIZE + TILE_SIZE / 2 },
          obstacleType: Math.random() > 0.5 ? 'tree' : 'bush',
          hp: 50,
          radius: 20,
          destroyed: false
        });
      }
    }
  });

  // Level boundaries (solid walls)
  for (let x = 0; x < cols; x++) {
    tileMap[0][x] = TILE_WALL;
    tileMap[rows - 1][x] = TILE_WALL;
  }
  for (let y = 0; y < rows; y++) {
    tileMap[y][0] = TILE_WALL;
    tileMap[y][cols - 1] = TILE_WALL;
  }

  return { walls, tileMap, obstacles };
};

type HeroType = 'kenny' | 'cartman' | 'kyle' | 'stanNinja' | 'snoopDogg' | 'superhero';
const HERO_STATS: Record<HeroType, { hp: number; speedMod: number; gunCooldown: number; canThrowSword: boolean }> = {
  kenny: { hp: 85, speedMod: 1.15, gunCooldown: 0.35, canThrowSword: false },
  cartman: { hp: 120, speedMod: 0.85, gunCooldown: 0.25, canThrowSword: true },
  kyle: { hp: 95, speedMod: 1.05, gunCooldown: 0.3, canThrowSword: true },
  stanNinja: { hp: 90, speedMod: 1.2, gunCooldown: 0.28, canThrowSword: true },
  snoopDogg: { hp: 100, speedMod: 0.95, gunCooldown: 0.4, canThrowSword: true },
  superhero: { hp: 105, speedMod: 1.1, gunCooldown: 0.28, canThrowSword: true },
};
const createPlayer = (id: string, index: number, heroType: HeroType = 'kenny', maxPlayers: number = 2, teamId?: 0 | 1): Player => {
  const centerX = CANVAS_WIDTH / 2;
  const centerY = CANVAS_HEIGHT / 2;
  const spawnRadius = 1500;
  const n = Math.max(2, maxPlayers);
  const spawnAngle = index * (2 * Math.PI / n);
  const spawnX = centerX + Math.cos(spawnAngle) * spawnRadius;
  const spawnY = centerY + Math.sin(spawnAngle) * spawnRadius;

  const faceAngle = Math.atan2(centerY - spawnY, centerX - spawnX);
  const stats = HERO_STATS[heroType];

  return {
    id: `p-${id}`,
    playerId: id,
    type: EntityType.PLAYER,
    heroType,
    pos: { x: spawnX, y: spawnY },
    vel: { x: 0, y: 0 },
    radius: 20,
    color: index === 0 ? COLORS.player : COLORS.enemy,
    active: true,
    hp: stats.hp,
    maxHp: stats.hp,
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
    hasChainsaw: false,
    hasBomb: false,
    hasShurikens: false,
    hasBurningGrenade: false,
    hasMinigun: false,
    hasFlamethrower: false,
    flamethrowerCooldown: 0,
    score: 0,
    speedMod: stats.speedMod,
    gunCooldown: stats.gunCooldown,
    canThrowSword: stats.canThrowSword,
    teamId,
    elevation: 0,
  };
};

const createGunPickup = (x: number, y: number): GunPickup => ({
  id: `gun-${Math.random()}`,
  pos: { x, y },
  active: true
});

const createMinigunPickup = (x: number, y: number): MinigunPickup => ({
  id: `minigun-${Math.random()}`,
  pos: { x, y },
  active: true
});

const createSwordPickup = (x: number, y: number): SwordPickup => ({
  id: `sword-${Math.random()}`,
  pos: { x, y },
  active: true
});

const createChainsawPickup = (x: number, y: number): ChainsawPickup => ({
  id: `chainsaw-${Math.random()}`,
  pos: { x, y },
  active: true
});

const createBombPickup = (x: number, y: number): BombPickup => ({
  id: `bomb-pickup-${Math.random()}`,
  pos: { x, y },
  active: true
});

const createShurikenPickup = (x: number, y: number): ShurikenPickup => ({
  id: `shuriken-${Math.random()}`,
  pos: { x, y },
  active: true
});

const createBurningGrenadePickup = (x: number, y: number): BurningGrenadePickup => ({
  id: `burning-grenade-${Math.random()}`,
  pos: { x, y },
  active: true
});

const createBurningGrenade = (startPos: Vector2, angle: number, ownerId: string): BurningGrenade => {
  const targetDist = BURNING_GRENADE_THROW_DIST;
  const targetPos = {
    x: startPos.x + Math.cos(angle) * targetDist,
    y: startPos.y + Math.sin(angle) * targetDist
  };
  return {
    id: `burning-grenade-proj-${Math.random()}`,
    startPos: { x: startPos.x, y: startPos.y },
    targetPos,
    progress: 0,
    arcHeight: BURNING_GRENADE_ARC_HEIGHT,
    ownerId,
    active: true
  };
};

const CTF_BASE_LEFT = { x: 900, y: CANVAS_HEIGHT / 2 };
const CTF_BASE_RIGHT = { x: CANVAS_WIDTH - 900, y: CANVAS_HEIGHT / 2 };

const createFlag = (teamId: 0 | 1): Flag => {
  const basePos = teamId === 0 ? CTF_BASE_LEFT : CTF_BASE_RIGHT;
  return {
    id: `flag-${teamId}-${Math.random()}`,
    teamId,
    pos: { x: basePos.x, y: basePos.y },
    carriedBy: null,
    basePos: { x: basePos.x, y: basePos.y },
  };
};

const createFireZone = (pos: Vector2, gameTime: number): FireZone => ({
  id: `fire-${Math.random()}`,
  pos: { x: pos.x, y: pos.y },
  radius: FIRE_ZONE_INIT_RADIUS,
  maxRadius: FIRE_ZONE_MAX_RADIUS,
  duration: FIRE_ZONE_DURATION,
  createdAt: gameTime,
  active: true
});

const createShurikenProjectile = (pos: Vector2, angle: number, ownerId: string): ShurikenProjectile => ({
  id: `shuriken-proj-${Math.random()}`,
  pos: { x: pos.x, y: pos.y },
  vel: { x: Math.cos(angle) * SHURIKEN_SPEED, y: Math.sin(angle) * SHURIKEN_SPEED },
  rot: 0,
  ownerId,
  returning: false,
  life: SHURIKEN_OUTBOUND_LIFE,
  hitPlayerIds: [],
  active: true
});

// Helper function to spawn items at center cluster
const spawnAtCenter = (): Vector2 => {
  const angle = Math.random() * Math.PI * 2;
  const radius = Math.random() * ARENA_SPAWN_RADIUS_PX;
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

const createFlame = (pos: Vector2, angle: number, ownerId: string): Flame => ({
  id: `flame-${Math.random()}`,
  pos: {
    x: pos.x + Math.cos(angle) * FLAME_SPAWN_OFFSET,
    y: pos.y + Math.sin(angle) * FLAME_SPAWN_OFFSET
  },
  vel: { x: Math.cos(angle) * FLAME_SPEED, y: Math.sin(angle) * FLAME_SPEED },
  ownerId,
  active: true,
  life: FLAME_LIFESPAN,
  maxLife: FLAME_LIFESPAN,
  size: 18 + Math.random() * 12
});

// Spawn herd of big unicorns from random arena edge, running across
const spawnUnicornHerd = (): Unicorn[] => {
  const edge = Math.floor(Math.random() * 4); // 0=top, 1=right, 2=bottom, 3=left
  const count = UNICORN_HERD_SIZE_MIN + Math.floor(Math.random() * (UNICORN_HERD_SIZE_MAX - UNICORN_HERD_SIZE_MIN + 1));
  const unicorns: Unicorn[] = [];
  const spread = 120; // spacing between unicorns

  let baseX: number, baseY: number, velX: number, velY: number, angle: number;
  if (edge === 0) {
    baseX = Math.random() * (CANVAS_WIDTH - 200) + 100;
    baseY = -50;
    velX = (Math.random() - 0.5) * 100;
    velY = UNICORN_SPEED;
    angle = Math.PI / 2;
  } else if (edge === 1) {
    baseX = CANVAS_WIDTH + 50;
    baseY = Math.random() * (CANVAS_HEIGHT - 200) + 100;
    velX = -UNICORN_SPEED;
    velY = (Math.random() - 0.5) * 100;
    angle = Math.PI;
  } else if (edge === 2) {
    baseX = Math.random() * (CANVAS_WIDTH - 200) + 100;
    baseY = CANVAS_HEIGHT + 50;
    velX = (Math.random() - 0.5) * 100;
    velY = -UNICORN_SPEED;
    angle = -Math.PI / 2;
  } else {
    baseX = -50;
    baseY = Math.random() * (CANVAS_HEIGHT - 200) + 100;
    velX = UNICORN_SPEED;
    velY = (Math.random() - 0.5) * 100;
    angle = 0;
  }

  const offset = ((count - 1) * spread) / 2;
  for (let i = 0; i < count; i++) {
    let x = baseX, y = baseY;
    if (edge === 0 || edge === 2) x += -offset + i * spread + (Math.random() - 0.5) * 40;
    else y += -offset + i * spread + (Math.random() - 0.5) * 40;
    unicorns.push({
      id: `unicorn-${Math.random()}`,
      pos: { x, y },
      vel: { x: velX, y: velY },
      angle,
      active: true
    });
  }
  return unicorns;
};

const spawnSatan = (): Satan => {
  const cx = CANVAS_WIDTH / 2;
  const cy = CANVAS_HEIGHT / 2;
  return {
    id: `satan-${Math.random()}`,
    pos: { x: cx, y: cy },
    createdAt: 0,
    lastStrikeAt: 0,
    lightningTarget: null,
    riftOpen: 0,
    visibleY: cy + SATAN_RISE_OFFSET,
    riftState: 'shaking'
  };
};

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

const createFlamethrowerPickup = (x: number, y: number): FlamethrowerPickup => ({
  id: `flamethrower-${Math.random()}`,
  pos: { x, y },
  active: true
});

const getTileAt = (tileMap: number[][], x: number, y: number): number => {
  const tx = Math.floor(x / TILE_SIZE);
  const ty = Math.floor(y / TILE_SIZE);
  if (ty < 0 || ty >= tileMap.length || tx < 0 || tx >= tileMap[0].length) return TILE_WALL;
  return tileMap[ty][tx];
};

// This function is now a method of the Player class/interface
// checkWallCollision logic is replaced to support elevation levels.
// The Player interface should have `elevation?: number`, `radius`, `pos`, `vel`, `prevPos`.
// The `state` object is assumed to be accessible in the context where this method is called.
// For example, if this is a method of a Player class:
// Player.prototype.checkWallCollision = function(state: GameState) { ... }
// Or if it's called within a game loop where `this` refers to a player:
// updatePlayer(player: Player, state: GameState) { player.checkWallCollision(state); }
// Given the instruction, the user wants to replace the *logic* of the existing `checkWallCollision` function.
// However, the provided replacement uses `this.radius`, `this.elevation`, etc., which implies it should be a method.
// I will replace the content of the `checkWallCollision` function with the new logic,
// assuming `player` is `this` in the context of the new logic, and `tileMap` is `state.tileMap`.
const checkWallCollision = (player: Player, tileMap: number[][]): boolean => {
  if (!tileMap) return false;

  const r = player.radius * 0.8; // slightly smaller hitbox so we don't snag on stair edges easily
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

  let onStairs = false;
  for (const p of points) {
    const tx = Math.floor(p.x / TILE_SIZE);
    const ty = Math.floor(p.y / TILE_SIZE);
    if (ty >= 0 && ty < tileMap.length && tx >= 0 && tx < tileMap[0].length) {
      if (tileMap[ty][tx] === TILE_STAIRS) {
        onStairs = true;
        break;
      }
    }
  }

  const checkPoint = (px: number, py: number) => {
    const tx = Math.floor(px / TILE_SIZE);
    const ty = Math.floor(py / TILE_SIZE);
    if (ty < 0 || ty >= tileMap.length || tx < 0 || tx >= tileMap[0].length) return true; // Map bounds
    const tile = tileMap[ty][tx];

    if (tile === TILE_STAIRS) return false;

    // Hard walls always block
    if (tile === TILE_WALL || tile === TILE_WALL_TOP || tile === TILE_STONE) return true;

    if (onStairs) {
      // While traversing stairs, player can overlap both ground and roof tiles safely
      return false;
    }

    if (player.elevation === 1) {
      // On roof: cannot walk on ground
      return tile !== TILE_ROOF;
    } else {
      // On ground: cannot walk on roof
      return tile === TILE_ROOF;
    }
  };

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

// Play Fun points formula
const POINTS_KILL = 50;
const POINTS_VICTORY = 200;
const POINTS_PARTICIPATION = 25;
const POINTS_CTF_CAPTURE = 30;
const POINTS_CTF_VICTORY = 150;

export default class GameRoom implements Party.Server {
  state: GameState;
  inputs: Record<string, PlayerInput> = {};
  hostId: string | null = null;
  gameLoop: ReturnType<typeof setInterval> | null = null;

  // Lobby info
  creatorName: string = 'Anonymous';
  maxPlayers: number = 2;
  roomRegistered: boolean = false;
  lobbyBaseUrl: string | null = null;

  // Play Fun: playerId (connection.id) -> ogpId for savePoints
  playerOgpIds: Map<string, string> = new Map();

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
      minigunPickups: [],
      swordPickups: [],
      chainsawPickups: [],
      bombPickups: [],
      shurikenPickups: [],
      burningGrenadePickups: [],
      burningGrenades: [],
      fireZones: [],
      electricPanel: { pos: { x: 800, y: 500 }, radius: ELECTRIC_PANEL_RADIUS },
      electricChargerId: null,
      gameMode: 'deathmatch',
      flags: [],
      winnerTeamId: null,
      bullets: [],
      thrownSwords: [],
      shurikenProjectiles: [],
      unicorns: [],
      tileMap: tileMap,
      lastHealthSpawnTime: 0,
      lastGunSpawnTime: 0,
      lastSwordSpawnTime: 0,
      lastChainsawSpawnTime: 0,
      lastBombSpawnTime: 0,
      lastShurikenSpawnTime: 0,
      lastBurningGrenadeSpawnTime: 0,
      lastMinigunSpawnTime: 0,
      lastFlamethrowerSpawnTime: 0,
      flamethrowerPickups: [],
      flames: [],
      unicornSpawnAt: 0,
      satan: null,
      satanSpawnAt: 0,
      gameTime: 0
    };
  }

  onConnect(conn: Party.Connection, ctx?: Party.ConnectionContext) {
    const playerId = conn.id;
    if (!this.hostId) {
      this.hostId = playerId;
    }
    // Derive lobby base URL from request (for notifyLobby fetch fallback)
    if (!this.lobbyBaseUrl && ctx?.request?.url) {
      try {
        const url = new URL(ctx.request.url);
        this.lobbyBaseUrl = url.origin;
      } catch (_) { }
    }

    let heroType: HeroType = 'kenny';
    if (ctx?.request?.url) {
      try {
        const heroParam = new URL(ctx.request.url).searchParams.get('heroType');
        if (['cartman', 'kyle', 'stanNinja', 'snoopDogg', 'superhero'].includes(heroParam || '')) heroType = heroParam as HeroType;
      } catch (e) {
        console.error('[GAME] Error parsing heroType from URL', e);
      }
    }

    const playerIndex = Object.keys(this.state.players).length;
    this.state.players[playerId] = createPlayer(playerId, playerIndex, heroType, this.maxPlayers);
    conn.send(JSON.stringify({
      type: 'STATE',
      payload: { ...this.state, maxPlayers: this.maxPlayers },
      yourId: playerId,
      isHost: playerId === this.hostId,
    }));
    this.broadcast();

    const playerCount = Object.keys(this.state.players).length;
    if (this.roomRegistered) {
      this.notifyLobby({ type: 'UPDATE_PLAYER_COUNT', roomId: this.room.id, playerCount });
    }
    // Auto-start when enough players have joined
    if (playerCount >= this.maxPlayers && this.state.status === 'LOBBY') {
      setTimeout(() => {
        if (Object.keys(this.state.players).length >= this.maxPlayers && this.state.status === 'LOBBY') {
          this.state.status = 'PLAYING';
          this.spawnInitialPickups();
          this.startGameLoop();
          this.broadcast();
          this.notifyLobby({ type: 'ROOM_FULL', roomId: this.room.id });
        }
      }, 1500);
    }
  }

  async onMessage(message: string, sender: Party.Connection) {
    try {
      const data: GameMessage = JSON.parse(message);
      switch (data.type) {
        case 'INPUT':
          this.inputs[data.playerId] = data.payload;
          break;
        case 'START':
          if (sender.id === this.hostId && Object.keys(this.state.players).length >= this.maxPlayers) {
            this.state.status = 'PLAYING';
            // Spawn initial pickups immediately so arena isn't empty
            this.spawnInitialPickups();
            this.startGameLoop();
            this.broadcast();
          }
          break;
        case 'AUTH_SESSION': {
          const token = (data as AuthSessionMessage).sessionToken;
          if (!token || typeof token !== 'string') break;
          const gameId = this.room.env.PLAYFUN_GAME_ID as string | undefined;
          const apiKey = this.room.env.OGP_API_KEY as string | undefined;
          const secretKey = this.room.env.OGP_API_SECRET_KEY as string | undefined;
          if (!gameId || !apiKey || !secretKey) {
            console.log('[GAME] AUTH_SESSION: missing env (PLAYFUN_GAME_ID, OGP_API_KEY, OGP_API_SECRET_KEY)');
            break;
          }
          try {
            const client = new OpenGameClient({ apiKey, secretKey });
            const result = await client.play.validateSessionToken(token);
            if (result?.valid && result.ogpId) {
              this.playerOgpIds.set(sender.id, result.ogpId);
              console.log('[GAME] AUTH_SESSION: validated for', sender.id);
            }
          } catch (e) {
            console.error('[GAME] AUTH_SESSION error:', e);
          }
          break;
        }
        case 'SET_ROOM_INFO':
          if (sender.id === this.hostId) {
            this.creatorName = data.creatorName || 'Anonymous';
            this.maxPlayers = data.maxPlayers ?? 2;
            this.state.gameMode = data.gameMode === 'ctf' ? 'ctf' : 'deathmatch';
            if (!this.roomRegistered) {
              this.roomRegistered = true;
              const pc = Object.keys(this.state.players).length;
              this.notifyLobby({
                type: 'REGISTER_ROOM',
                roomId: this.room.id,
                creatorName: this.creatorName,
                maxPlayers: this.maxPlayers,
                playerCount: pc,
                gameMode: this.state.gameMode,
              });
            }
          } else {
            console.log('[GAME] SET_ROOM_INFO ignored: sender', sender.id, '!= hostId', this.hostId);
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
              minigunPickups: [],
              swordPickups: [],
              chainsawPickups: [],
              bombPickups: [],
              shurikenPickups: [],
              burningGrenadePickups: [],
              burningGrenades: [],
              fireZones: [],
              electricPanel: { pos: { x: 800, y: 500 }, radius: ELECTRIC_PANEL_RADIUS },
              electricChargerId: null,
              gameMode: this.state.gameMode,
              flags: [],
              winnerTeamId: null,
              bullets: [],
              thrownSwords: [],
              shurikenProjectiles: [],
              unicorns: [],
              satan: null,
              satanSpawnAt: 0,
              tileMap: tileMap,
              lastHealthSpawnTime: 0,
              lastGunSpawnTime: 0,
              lastSwordSpawnTime: 0,
              lastChainsawSpawnTime: 0,
              lastBombSpawnTime: 0,
              lastShurikenSpawnTime: 0,
              lastBurningGrenadeSpawnTime: 0,
              lastMinigunSpawnTime: 0,
              lastFlamethrowerSpawnTime: 0,
              flamethrowerPickups: [],
              flames: [],
              unicornSpawnAt: 0,
              gameTime: 0
            };
            playerIds.forEach((pid, idx) => {
              const existingPlayer = this.state.players[pid];
              const heroType = existingPlayer?.heroType || 'kenny';
              this.state.players[pid] = createPlayer(pid, idx, heroType, this.maxPlayers);
            });
            this.spawnInitialPickups();
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
    const playerCount = Object.keys(this.state.players).length;
    if (this.roomRegistered && playerCount > 0) {
      this.notifyLobby({ type: 'UPDATE_PLAYER_COUNT', roomId: this.room.id, playerCount });
    }
    if (playerCount === 0) {
      this.stopGameLoop();
      this.state.status = 'LOBBY';
      // Notify lobby that room is closed
      if (this.roomRegistered) {
        this.notifyLobby({ type: 'ROOM_CLOSED', roomId: this.room.id });
        this.roomRegistered = false;
      }
    }
    this.broadcast();
  }

  // Send notification to lobby party
  async notifyLobby(data: Record<string, any>) {
    const body = JSON.stringify(data);
    const roomId = data.roomId || this.room.id;
    console.log('[GAME] notifyLobby', data.type, 'roomId=', roomId, 'lobbyBaseUrl=', this.lobbyBaseUrl || '(none)');
    // 1. Try PartyKit internal API (context.parties)
    try {
      const lobbyParty = this.room.context?.parties?.lobby;
      if (lobbyParty) {
        const lobbyRoom = lobbyParty.get("lobby");
        const res = await lobbyRoom.fetch({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
        });
        if (res.ok) {
          console.log('[GAME] notifyLobby OK via context.parties');
          return;
        }
        console.log('[GAME] context.parties fetch res.status=', res.status);
      } else {
        console.log('[GAME] context.parties.lobby not available');
      }
    } catch (e) {
      console.error('[GAME] context.parties notify failed:', e);
    }
    // 2. Fallback: HTTP fetch (lobbyBaseUrl from request, or PARTYKIT_HOST env)
    const baseUrl = this.lobbyBaseUrl || (this.room.env.PARTYKIT_HOST as string | undefined);
    if (baseUrl && typeof baseUrl === 'string') {
      const url = `${baseUrl.startsWith('http') ? baseUrl : `https://${baseUrl}`}/parties/lobby/lobby`;
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
        });
        if (res.ok) {
          console.log('[GAME] notifyLobby OK via fetch', url);
        } else {
          console.error('[GAME] lobby fetch failed:', res.status, url);
        }
      } catch (e) {
        console.error('[GAME] lobby fetch error:', e);
      }
    } else {
      console.error('[GAME] notifyLobby: no lobbyBaseUrl or PARTYKIT_HOST, roomId=', roomId);
    }
  }

  spawnInitialPickups() {
    if (this.state.gameMode === 'ctf') {
      const pids = Object.keys(this.state.players);
      pids.forEach((pid, idx) => {
        this.state.players[pid].teamId = (idx % 2) as 0 | 1;
      });
      this.state.flags = [createFlag(0), createFlag(1)];
    }

    // Spawn one of each pickup type at center so the arena starts with items
    const healthPos = spawnAtCenter();
    this.state.healthPickups.push(createHealthPickup(healthPos.x, healthPos.y));

    const gunPos = spawnAtCenter();
    this.state.gunPickups.push(createGunPickup(gunPos.x, gunPos.y));

    const minigunPos = spawnAtCenter();
    this.state.minigunPickups.push(createMinigunPickup(minigunPos.x, minigunPos.y));

    const swordPos1 = spawnAtCenter();
    this.state.swordPickups.push(createSwordPickup(swordPos1.x, swordPos1.y));

    const swordPos2 = spawnAtCenter();
    this.state.swordPickups.push(createSwordPickup(swordPos2.x, swordPos2.y));

    const chainsawPos = spawnAtCenter();
    this.state.chainsawPickups.push(createChainsawPickup(chainsawPos.x, chainsawPos.y));

    const bombPos = spawnAtCenter();
    this.state.bombPickups.push(createBombPickup(bombPos.x, bombPos.y));

    const shurikenPos = spawnAtCenter();
    this.state.shurikenPickups.push(createShurikenPickup(shurikenPos.x, shurikenPos.y));

    const burningGrenadePos = spawnAtCenter();
    this.state.burningGrenadePickups.push(createBurningGrenadePickup(burningGrenadePos.x, burningGrenadePos.y));

    const flamethrowerPos = spawnAtCenter();
    this.state.flamethrowerPickups.push(createFlamethrowerPickup(flamethrowerPos.x, flamethrowerPos.y));

    // Reset spawn timers so next spawns happen after normal intervals
    this.state.lastHealthSpawnTime = 0;
    this.state.lastGunSpawnTime = 0;
    this.state.lastSwordSpawnTime = 0;
    this.state.lastChainsawSpawnTime = 0;
    this.state.lastBombSpawnTime = 0;
    this.state.lastShurikenSpawnTime = 0;
    this.state.lastBurningGrenadeSpawnTime = 0;
    this.state.lastMinigunSpawnTime = 0;
  }

  private broadcastFrame = 0;

  startGameLoop() {
    if (this.gameLoop) return;
    this.gameLoop = setInterval(() => {
      this.updateGame();
      this.broadcastFrame++;
      // Broadcast at 15fps to reduce network load (physics 60fps)
      if (this.broadcastFrame % 4 === 0) {
        this.broadcast();
      }
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

    this.state.gameTime += DT;

    let newParticles = [...this.state.particles];
    let newBombs = [...this.state.bombs];
    let newUnicorns = [...this.state.unicorns];
    let newShurikenProjectiles = [...this.state.shurikenProjectiles];
    let newBurningGrenades = [...this.state.burningGrenades];
    let newFireZones = [...this.state.fireZones];
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
          if (isFriendlyFire(this.state, bomb.ownerId, pid)) return;
          const player = this.state.players[pid];
          const owner = this.state.players[bomb.ownerId];
          if (!player.active || !owner) return;

          // Elevation check: Bombs only hit players on the same level
          if (player.elevation !== owner.elevation) return;

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
                const owner = this.state.players[bomb.ownerId];
                if (owner) owner.score = (owner.score ?? 0) + 1;
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

    // Spawn chainsaw pickup at center cluster (max 2)
    this.state.lastChainsawSpawnTime += DT;
    if (this.state.lastChainsawSpawnTime >= CHAINSAW_SPAWN_INTERVAL && this.state.chainsawPickups.length < MAX_CHAINSAW_PICKUPS) {
      const spawnPos = spawnAtCenter();
      this.state.chainsawPickups.push(createChainsawPickup(spawnPos.x, spawnPos.y));
      this.state.lastChainsawSpawnTime = 0;
    }

    // Spawn bomb pickup at center cluster (max 3)
    this.state.lastBombSpawnTime += DT;
    if (this.state.lastBombSpawnTime >= BOMB_SPAWN_INTERVAL && this.state.bombPickups.length < MAX_BOMB_PICKUPS) {
      const spawnPos = spawnAtCenter();
      this.state.bombPickups.push(createBombPickup(spawnPos.x, spawnPos.y));
      this.state.lastBombSpawnTime = 0;
    }

    // Spawn shuriken pickup (max 2)
    this.state.lastShurikenSpawnTime += DT;
    if (this.state.lastShurikenSpawnTime >= SHURIKEN_SPAWN_INTERVAL && this.state.shurikenPickups.length < MAX_SHURIKEN_PICKUPS) {
      const spawnPos = spawnAtCenter();
      this.state.shurikenPickups.push(createShurikenPickup(spawnPos.x, spawnPos.y));
      this.state.lastShurikenSpawnTime = 0;
    }

    // Spawn burning grenade pickup (max 2)
    this.state.lastBurningGrenadeSpawnTime += DT;
    if (this.state.lastBurningGrenadeSpawnTime >= BURNING_GRENADE_SPAWN_INTERVAL && this.state.burningGrenadePickups.length < MAX_BURNING_GRENADE_PICKUPS) {
      const spawnPos = spawnAtCenter();
      this.state.burningGrenadePickups.push(createBurningGrenadePickup(spawnPos.x, spawnPos.y));
      this.state.lastBurningGrenadeSpawnTime = 0;
    }

    // Spawn minigun pickup (max 1)
    this.state.lastMinigunSpawnTime += DT;
    if (this.state.lastMinigunSpawnTime >= MINIGUN_SPAWN_INTERVAL && this.state.minigunPickups.length < MAX_MINIGUN_PICKUPS) {
      const spawnPos = spawnAtCenter();
      this.state.minigunPickups.push(createMinigunPickup(spawnPos.x, spawnPos.y));
      this.state.lastMinigunSpawnTime = 0;
    }

    // Spawn flamethrower pickup
    this.state.lastFlamethrowerSpawnTime += DT;
    if (this.state.lastFlamethrowerSpawnTime >= FLAMETHROWER_SPAWN_INTERVAL && this.state.flamethrowerPickups.length < MAX_FLAMETHROWER_PICKUPS) {
      const spawnPos = spawnAtCenter();
      this.state.flamethrowerPickups.push(createFlamethrowerPickup(spawnPos.x, spawnPos.y));
      this.state.lastFlamethrowerSpawnTime = 0;
    }

    // Unicorn herd: spawn at random time, random direction
    if (this.state.unicornSpawnAt === 0) {
      this.state.unicornSpawnAt = this.state.gameTime + UNICORN_SPAWN_DELAY_MIN + Math.random() * (UNICORN_SPAWN_DELAY_MAX - UNICORN_SPAWN_DELAY_MIN);
    }
    if (this.state.gameTime >= this.state.unicornSpawnAt && newUnicorns.length === 0) {
      newUnicorns = spawnUnicornHerd();
    }

    // Update unicorns: move, collide with players (instant kill)
    newUnicorns = newUnicorns.filter(u => {
      if (!u.active) return false;
      u.pos.x += u.vel.x * DT;
      u.pos.y += u.vel.y * DT;
      if (u.pos.x < -200 || u.pos.x > CANVAS_WIDTH + 200 || u.pos.y < -200 || u.pos.y > CANVAS_HEIGHT + 200) return false;
      playerIds.forEach(pid => {
        const player = this.state.players[pid];
        if (!player.active || player.hp <= 0) return;

        // Elevation check: Unicorns only run over people on the ground
        if (player.elevation === 1) return;

        const d = dist(u.pos, player.pos);
        if (d < UNICORN_HIT_RADIUS + player.radius) {
          player.hp = 0;
          player.active = false;
          newShake += 15;
          for (let i = 0; i < 25; i++) {
            newParticles.push(createParticle(player.pos, COLORS.blood, 10, 'blood'));
          }
        }
      });
      return true;
    });

    // Satan: spawn rarer than unicorns, stays and strikes players with lightning
    let newSatan = this.state.satan;
    if (this.state.satanSpawnAt === 0) {
      this.state.satanSpawnAt = this.state.gameTime + SATAN_SPAWN_DELAY_MIN + Math.random() * (SATAN_SPAWN_DELAY_MAX - SATAN_SPAWN_DELAY_MIN);
    }
    if (this.state.gameTime >= this.state.satanSpawnAt && !newSatan) {
      const s = spawnSatan();
      s.createdAt = this.state.gameTime;
      s.lastStrikeAt = this.state.gameTime;
      newSatan = s;
    }
    if (newSatan) {
      const elapsed = this.state.gameTime - newSatan.createdAt;
      if (elapsed >= SATAN_DURATION) {
        newSatan = null;
      } else {
        // Rift animation: shaking -> opening -> rising -> active
        if (newSatan.riftState === 'shaking') {
          newShake += 3;
          if (elapsed > 0.5) newSatan.riftState = 'opening';
        } else if (newSatan.riftState === 'opening') {
          newShake += 2;
          newSatan.riftOpen = Math.min(SATAN_RIFT_OPEN_MAX, newSatan.riftOpen + SATAN_RIFT_OPEN_SPEED * DT * 60);
          if (newSatan.riftOpen >= 80) newSatan.riftState = 'rising';
        } else if (newSatan.riftState === 'rising') {
          newShake += 1;
          newSatan.visibleY = Math.max(newSatan.pos.y, newSatan.visibleY - SATAN_RISE_SPEED * DT * 60);
          newSatan.riftOpen = Math.min(SATAN_RIFT_OPEN_MAX, newSatan.riftOpen + SATAN_RIFT_OPEN_SPEED * DT * 30);
          if (newSatan.visibleY <= newSatan.pos.y) newSatan.riftState = 'active';
        }

        // Clear lightning target after a few frames
        if (newSatan.lightningTarget && this.state.gameTime - newSatan.lastStrikeAt > SATAN_LIGHTNING_VISUAL_FRAMES / 60) {
          newSatan.lightningTarget = null;
        }
        // Strike only when fully risen
        if (newSatan.riftState === 'active' && this.state.gameTime - newSatan.lastStrikeAt >= SATAN_LIGHTNING_INTERVAL) {
          const alivePlayers = playerIds.filter(pid => {
            const p = this.state.players[pid];
            return p?.active && p.hp > 0;
          });
          if (alivePlayers.length > 0) {
            const targetId = alivePlayers[Math.floor(Math.random() * alivePlayers.length)];
            const target = this.state.players[targetId];
            if (target?.active && target.pos) {
              newSatan.lastStrikeAt = this.state.gameTime;
              newSatan.lightningTarget = { ...target.pos };
              if (!target.isDodging) {
                target.hp = Math.max(0, target.hp - SATAN_LIGHTNING_DAMAGE);
                newShake += 12;
                for (let i = 0; i < 15; i++) {
                  newParticles.push(createParticle(target.pos, '#fbbf24', 5, 'spark'));
                }
                if (target.hp <= 0) {
                  target.active = false;
                  // Satan kill - no player score (environment)
                  for (let i = 0; i < 20; i++) {
                    newParticles.push(createParticle(target.pos, COLORS.blood, 10, 'blood'));
                  }
                }
              }
            }
          }
        }
      }
    }

    // Update burning grenades (arc flight, create fire zone on land)
    newBurningGrenades = newBurningGrenades.filter(g => {
      if (!g.active) return false;
      g.progress += BURNING_GRENADE_FLY_SPEED;
      if (g.progress >= 1) {
        const landPos = g.targetPos;
        newFireZones.push(createFireZone(landPos, this.state.gameTime));
        for (let i = 0; i < 25; i++) {
          newParticles.push(createParticle(landPos, '#f97316', 6, 'explosion'));
        }
        for (let i = 0; i < 15; i++) {
          newParticles.push(createParticle(landPos, '#ef4444', 4, 'spark'));
        }
        newShake += 8;
        return false;
      }
      return true;
    });

    // Update fire zones: grow radius, damage players, expire
    newFireZones = newFireZones.filter(fz => {
      if (!fz.active) return false;
      const elapsed = this.state.gameTime - fz.createdAt;
      if (elapsed >= fz.duration) return false;
      const growProgress = Math.min(1, elapsed / FIRE_ZONE_GROW_TIME);
      fz.radius = FIRE_ZONE_INIT_RADIUS + (FIRE_ZONE_MAX_RADIUS - FIRE_ZONE_INIT_RADIUS) * growProgress;
      playerIds.forEach(pid => {
        const player = this.state.players[pid];
        if (!player.active || player.hp <= 0) return;
        const d = dist(fz.pos, player.pos);
        if (d < fz.radius + player.radius) {
          if (!player.isDodging) {
            player.hp = Math.max(0, player.hp - FIRE_ZONE_DAMAGE_PER_TICK);
            if (Math.random() > 0.7) {
              newParticles.push(createParticle(player.pos, '#f97316', 3, 'spark'));
            }
            if (player.hp <= 0) {
              player.active = false;
              newShake += 10;
              for (let i = 0; i < 20; i++) {
                newParticles.push(createParticle(player.pos, COLORS.blood, 10, 'blood'));
              }
            }
          }
        }
      });
      return true;
    });

    // Electric panel: heal charger (first in zone), damage others in zone
    const ep = this.state.electricPanel;
    if (ep) {
      this.state.electricChargerId = null;
      const playersInZone = playerIds.filter(pid => {
        const p = this.state.players[pid];
        if (!p.active || p.hp <= 0) return false;
        return dist(p.pos, ep.pos) < ep.radius + p.radius;
      });
      const chargerId = playersInZone[0] ?? null;
      this.state.electricChargerId = chargerId;
      playersInZone.forEach(pid => {
        const player = this.state.players[pid];
        if (!player.active || player.hp <= 0) return;
        if (pid === chargerId) {
          player.hp = Math.min(player.maxHp ?? PLAYER_HP, player.hp + ELECTRIC_PANEL_HEAL_PER_TICK);
          if (Math.random() > 0.9) {
            newParticles.push(createParticle(player.pos, '#60a5fa', 3, 'spark'));
          }
        } else {
          if (!player.isDodging) {
            player.hp = Math.max(0, player.hp - ELECTRIC_PANEL_DAMAGE_PER_TICK);
            if (Math.random() > 0.7) {
              newParticles.push(createParticle(player.pos, '#93c5fd', 4, 'spark'));
            }
            if (player.hp <= 0) {
              player.active = false;
              newShake += 10;
              for (let i = 0; i < 20; i++) {
                newParticles.push(createParticle(player.pos, COLORS.blood, 10, 'blood'));
              }
            }
          }
        }
      });
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
        if (isFriendlyFire(this.state, bullet.ownerId, pid)) continue;
        const target = this.state.players[pid];
        const owner = this.state.players[bullet.ownerId];
        if (!target.active || !owner) continue;

        // Elevation check: Bullets only hit players on the same level (roof vs ground)
        if (target.elevation !== owner.elevation) continue;

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
              const owner = this.state.players[bullet.ownerId];
              if (owner) owner.score = (owner.score ?? 0) + 1;
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

    // Update flames
    let newFlames = this.state.flames.filter(flame => {
      if (!flame.active) return false;

      // Move flame
      flame.pos.x += flame.vel.x * DT;
      flame.pos.y += flame.vel.y * DT;
      flame.life -= DT;
      if (flame.size) flame.size *= 0.99;

      if (flame.life <= 0) return false;

      // Decrease speed and grow size visually could be just client side, but here let's just do collisions
      let hit = false;
      const owner = this.state.players[flame.ownerId];

      playerIds.forEach(targetId => {
        if (hit || targetId === flame.ownerId) return;
        if (isFriendlyFire(this.state, flame.ownerId, targetId)) return;
        const target = this.state.players[targetId];
        if (!target.active || target.hp <= 0) return;

        // Elevation check
        if (owner && target.elevation !== owner.elevation) return;

        const d = dist(flame.pos, target.pos);
        if (d < FLAME_HIT_RADIUS + target.radius) {
          if (!target.isDodging) {
            target.hp = Math.max(0, target.hp - FLAMETHROWER_DAMAGE_PER_TICK);
            if (Math.random() > 0.6) {
              newParticles.push(createParticle(target.pos, '#f97316', 3, 'spark'));
            }
            if (target.hp <= 0) {
              target.active = false;
              const owner = this.state.players[flame.ownerId];
              if (owner) owner.score = (owner.score ?? 0) + 1;
              newShake += 10;
              for (let i = 0; i < 15; i++) {
                newParticles.push(createParticle(target.pos, COLORS.blood, 8, 'blood'));
              }
            }
          }
          hit = true;
        }
      });

      // Simple wall collision check (no bounce)
      if (this.state.tileMap) {
        if (getTileAt(this.state.tileMap, flame.pos.x, flame.pos.y) === TILE_WALL ||
          getTileAt(this.state.tileMap, flame.pos.x, flame.pos.y) === TILE_WALL_TOP ||
          getTileAt(this.state.tileMap, flame.pos.x, flame.pos.y) === TILE_STONE) {
          hit = true;
        }
      }

      return !hit;
    });

    // Update thrown swords
    let newThrownSwords = this.state.thrownSwords.filter(sword => {
      if (!sword.active) return false;

      // Move sword
      sword.pos.x += sword.vel.x * DT;
      sword.pos.y += sword.vel.y * DT;

      // Bounce off arena walls (tileMap) so sword stays inside
      const tileMap = this.state.tileMap;
      if (tileMap) {
        const tileAt = (x: number, y: number) => {
          const tx = Math.floor(x / TILE_SIZE);
          const ty = Math.floor(y / TILE_SIZE);
          if (ty < 0 || ty >= tileMap.length || tx < 0 || tx >= tileMap[0].length) return TILE_WALL;
          const t = tileMap[ty][tx];
          // Thrown swords only bypass floor, grass, street, sidewalk, indoor floor
          const isObstacle = t === TILE_WALL || t === TILE_WALL_TOP || t === TILE_STONE || t === TILE_ROOF;
          return isObstacle ? TILE_WALL : t;
        };
        const inWall = (x: number, y: number) => tileAt(x, y) === TILE_WALL;
        if (inWall(sword.pos.x, sword.pos.y)) {
          // Rollback
          sword.pos.x -= sword.vel.x * DT;
          sword.pos.y -= sword.vel.y * DT;
          // Reflect: which axis crossed into wall
          if (inWall(sword.pos.x + sword.vel.x * DT, sword.pos.y)) sword.vel.x = -sword.vel.x;
          if (inWall(sword.pos.x, sword.pos.y + sword.vel.y * DT)) sword.vel.y = -sword.vel.y;
          // Step again with new velocity
          sword.pos.x += sword.vel.x * DT;
          sword.pos.y += sword.vel.y * DT;
        }
        // Clamp to canvas so we don't leave the map
        sword.pos.x = clamp(sword.pos.x, 0, CANVAS_WIDTH);
        sword.pos.y = clamp(sword.pos.y, 0, CANVAS_HEIGHT);
      }

      // Check collision with players — hit along full sword length (segment)
      const velNorm = normalize(sword.vel);
      const tip = { x: sword.pos.x + velNorm.x * THROWN_SWORD_LENGTH, y: sword.pos.y + velNorm.y * THROWN_SWORD_LENGTH };
      const distToSegment = (p: Vector2, a: Vector2, b: Vector2): number => {
        const vx = b.x - a.x, vy = b.y - a.y;
        const wx = p.x - a.x, wy = p.y - a.y;
        const c1 = wx * vx + wy * vy;
        const c2 = vx * vx + vy * vy;
        if (c1 <= 0) return dist(p, a);
        if (c2 <= c1) return dist(p, b);
        const t = c1 / c2;
        const proj = { x: a.x + t * vx, y: a.y + t * vy };
        return dist(p, proj);
      };
      for (const pid of playerIds) {
        if (isFriendlyFire(this.state, sword.ownerId, pid)) continue;
        const target = this.state.players[pid];
        const owner = this.state.players[sword.ownerId];
        if (!target.active || !owner) continue;

        // Elevation check: Thrown swords only hit players on the same level
        if (target.elevation !== owner.elevation) continue;

        const d = distToSegment(target.pos, sword.pos, tip);
        if (d < target.radius + THROWN_SWORD_WIDTH) {
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
              const owner = this.state.players[sword.ownerId];
              if (owner) owner.score = (owner.score ?? 0) + 1;
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

    // Update shuriken projectiles (boomerang: outbound -> return to owner)
    newShurikenProjectiles = newShurikenProjectiles.filter(s => {
      if (!s.active) return false;
      const owner = this.state.players[s.ownerId];

      if (!s.returning) {
        s.pos.x += s.vel.x * DT;
        s.pos.y += s.vel.y * DT;
        s.vel.x *= SHURIKEN_FRICTION;
        s.vel.y *= SHURIKEN_FRICTION;
        s.life--;
        s.rot += 0.4;
        if (s.life <= 0) s.returning = true;
      } else {
        if (!owner || !owner.active) return false;
        const dx = owner.pos.x - s.pos.x;
        const dy = owner.pos.y - s.pos.y;
        const distToOwner = Math.sqrt(dx * dx + dy * dy);
        if (distToOwner < SHURIKEN_CATCH_RADIUS + owner.radius) {
          owner.hasShurikens = true;
          for (let i = 0; i < 5; i++) {
            newParticles.push(createParticle(s.pos, '#94a3b8', 4, 'spark'));
          }
          return false;
        }
        const accel = SHURIKEN_RETURN_ACCEL * DT;
        s.vel.x += (dx / distToOwner) * accel;
        s.vel.y += (dy / distToOwner) * accel;
        const speed = Math.sqrt(s.vel.x * s.vel.x + s.vel.y * s.vel.y);
        if (speed > SHURIKEN_RETURN_MAX_SPEED) {
          s.vel.x = (s.vel.x / speed) * SHURIKEN_RETURN_MAX_SPEED;
          s.vel.y = (s.vel.y / speed) * SHURIKEN_RETURN_MAX_SPEED;
        }
        s.pos.x += s.vel.x * DT;
        s.pos.y += s.vel.y * DT;
        s.rot += 0.4;
      }

      if (s.pos.x < -100 || s.pos.x > CANVAS_WIDTH + 100 || s.pos.y < -100 || s.pos.y > CANVAS_HEIGHT + 100) {
        return false;
      }

      for (const pid of playerIds) {
        if (isFriendlyFire(this.state, s.ownerId, pid)) continue;
        const target = this.state.players[pid];
        const owner = this.state.players[s.ownerId];
        if (!target.active || target.hp <= 0 || !owner) continue;
        if (s.hitPlayerIds.includes(pid)) continue;

        // Elevation check: Shurikens only hit players on the same level
        if (target.elevation !== owner.elevation) continue;

        const d = dist(s.pos, target.pos);
        if (d < target.radius + SHURIKEN_HIT_RADIUS) {
          if (!target.isDodging) {
            target.hp = Math.max(0, target.hp - SHURIKEN_DAMAGE);
            s.hitPlayerIds.push(pid);
            newShake += 12;
            for (let i = 0; i < 20; i++) {
              newParticles.push(createParticle(target.pos, COLORS.blood, 10, 'blood'));
            }
            const knockDir = normalize(s.vel);
            target.knockbackVel.x = knockDir.x * 600;
            target.knockbackVel.y = knockDir.y * 600;
            if (target.hp <= 0) {
              target.active = false;
              const owner = this.state.players[s.ownerId];
              if (owner) owner.score = (owner.score ?? 0) + 1;
              for (let i = 0; i < 25; i++) {
                newParticles.push(createParticle(target.pos, COLORS.blood, 12, 'blood'));
              }
            }
          }
        }
      }

      if (Math.random() > 0.5) {
        newParticles.push(createParticle(s.pos, '#94a3b8', 2, 'trail'));
      }
      return true;
    });

    // Update health pickups
    let newHealthPickups = this.state.healthPickups.filter(hp => hp.active);

    // Update gun pickups
    let newGunPickups = this.state.gunPickups.filter(gp => gp.active);

    // Update minigun pickups
    let newMinigunPickups = this.state.minigunPickups.filter(mp => mp.active);

    // Update sword pickups
    let newSwordPickups = this.state.swordPickups.filter(sp => sp.active);

    // Update chainsaw pickups
    let newChainsawPickups = this.state.chainsawPickups.filter(cp => cp.active);

    // Update bomb pickups
    let newBombPickups = this.state.bombPickups.filter(bp => bp.active);

    // Update shuriken pickups
    let newShurikenPickups = this.state.shurikenPickups.filter(sp => sp.active);

    // Update burning grenade pickups
    let newBurningGrenadePickups = this.state.burningGrenadePickups.filter(bg => bg.active);

    // Update flamethrower pickups
    let newFlamethrowerPickups = this.state.flamethrowerPickups.filter(fp => fp.active);

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
      (player as any).isFlamethrowerFiring = input.mouseDown && player.hasFlamethrower;

      // Burning grenade throw (right-click) - creates fire zone on impact. Kenny throws 5 grenades.
      player.isBlocking = false;
      if (input.mouseRightDown && player.hasBurningGrenade && !player.isDodging) {
        const angle = player.angle || 0;
        const isKenny = player.heroType === 'kenny';
        const grenadeCount = isKenny ? 5 : 1;
        const spreadAngle = isKenny ? 0.4 : 0;

        for (let g = 0; g < grenadeCount; g++) {
          const gAngle = angle + (grenadeCount > 1 ? (g / (grenadeCount - 1) - 0.5) * spreadAngle : 0);
          let targetX = player.pos.x + Math.cos(gAngle) * BURNING_GRENADE_THROW_DIST;
          let targetY = player.pos.y + Math.sin(gAngle) * BURNING_GRENADE_THROW_DIST;
          targetX = Math.max(100, Math.min(CANVAS_WIDTH - 100, targetX));
          targetY = Math.max(100, Math.min(CANVAS_HEIGHT - 100, targetY));
          const canLand = !this.state.tileMap || (() => {
            const tile = getTileAt(this.state.tileMap!, targetX, targetY);
            return tile !== TILE_WALL && tile !== TILE_WALL_TOP && tile !== TILE_STONE;
          })();
          if (canLand) {
            const grenade = createBurningGrenade(player.pos, gAngle, pid);
            grenade.targetPos = { x: targetX, y: targetY };
            newBurningGrenades.push(grenade);
          }
        }
        player.hasBurningGrenade = false;
        for (let i = 0; i < 8; i++) {
          newParticles.push(createParticle(player.pos, '#f97316', 4, 'spark'));
        }
      }

      // Sword throwing (right-click) - throw sword if player has one (not chainsaw)
      if (input.mouseRightDown && player.hasSword && !player.hasChainsaw && (player as any).canThrowSword !== false && player.attackCooldown <= 0 && !player.isDodging && !player.isAttacking) {
        // Throw the sword — spawn ahead of player so it doesn't hit self immediately
        const angle = player.angle || 0;
        const spawnOffset = player.radius + THROWN_SWORD_WIDTH + 30;
        const spawnPos = { x: player.pos.x + Math.cos(angle) * spawnOffset, y: player.pos.y + Math.sin(angle) * spawnOffset };
        const thrownSword = createThrownSword(spawnPos, angle, pid);
        newThrownSwords.push(thrownSword);
        player.hasSword = false; // Player loses sword after throwing
        player.attackCooldown = 0.3; // Short cooldown
        newShake += 3;
        // Throw particles
        for (let i = 0; i < 6; i++) {
          newParticles.push(createParticle(player.pos, '#e5e7eb', 4, 'spark'));
        }
      }

      let didThrowBomb = false;
      let didThrowShurikens = false;
      // Bomb throwing (left click when has bomb). Kenny throws 5 bombs, 2x wider spread, shorter range.
      if ((input.throwBomb || input.mouseDown) && player.hasBomb && !player.isDodging) {
        const bombDx = input.mouse.x - player.pos.x;
        const bombDy = input.mouse.y - player.pos.y;
        const baseAngle = Math.atan2(bombDy, bombDx);
        const isKenny = player.heroType === 'kenny';
        const bombCount = isKenny ? 5 : 1;
        const bombSpread = isKenny ? SHURIKEN_SPREAD * 2 : 0;
        const bombSpeedMult = isKenny ? 0.5 : 1; // Kenny: shorter range
        let pushed = false;
        for (let i = 0; i < bombCount; i++) {
          const bombAngle = baseAngle + (bombCount > 1 ? (i - (bombCount - 1) / 2) * bombSpread : 0);
          const bomb = createBomb(player.pos, pid, bombAngle);
          if (bombSpeedMult !== 1) {
            bomb.vel.x *= bombSpeedMult;
            bomb.vel.y *= bombSpeedMult;
          }
          const canLand = !this.state.tileMap || (() => {
            const tile = getTileAt(this.state.tileMap!, bomb.pos.x, bomb.pos.y);
            return tile !== TILE_WALL && tile !== TILE_WALL_TOP && tile !== TILE_STONE;
          })();
          if (canLand) {
            newBombs.push(bomb);
            pushed = true;
          }
        }
        if (pushed) {
          player.hasBomb = false;
          didThrowBomb = true;
        }
        for (let i = 0; i < 6; i++) {
          newParticles.push(createParticle(player.pos, '#f97316', 4, 'spark'));
        }
      }

      // Shuriken throw (left click when has shurikens) - 3 boomerangs in spread
      if (input.mouseDown && !didThrowBomb && player.hasShurikens && !player.isDodging && player.attackCooldown <= 0) {
        const baseAngle = player.angle || 0;
        for (let i = -1; i <= 1; i++) {
          const angle = baseAngle + i * SHURIKEN_SPREAD;
          const spawnOffset = player.radius + 20;
          const spawnPos = { x: player.pos.x + Math.cos(angle) * spawnOffset, y: player.pos.y + Math.sin(angle) * spawnOffset };
          newShurikenProjectiles.push(createShurikenProjectile(spawnPos, angle, pid));
        }
        player.hasShurikens = false;
        didThrowShurikens = true;
        player.attackCooldown = 0.25;
        for (let i = 0; i < 5; i++) {
          newParticles.push(createParticle(player.pos, '#94a3b8', 4, 'spark'));
        }
      }

      // Attack - minigun (rapid), gun (single), sword/chainsaw melee (skip if just threw bomb/shurikens)
      if (input.mouseDown && !didThrowBomb && !didThrowShurikens && player.attackCooldown <= 0 && !player.isDodging) {
        if (player.hasMinigun) {
          const baseAngle = player.angle || 0;
          const spreadAngle = baseAngle + (Math.random() - 0.5) * 2 * MINIGUN_BULLET_SPREAD;
          const bullet = createBullet(player.pos, spreadAngle, pid);
          newBullets.push(bullet);
          player.attackCooldown = MINIGUN_COOLDOWN;
          newShake += 3;
          for (let i = 0; i < 4; i++) {
            newParticles.push(createParticle(player.pos, '#fde047', 5, 'spark'));
          }
        } else if (player.hasGun) {
          const bullet = createBullet(player.pos, player.angle || 0, pid);
          newBullets.push(bullet);
          player.hasGun = false;
          player.attackCooldown = (player as any).gunCooldown ?? 0.3;
          newShake += 5;
          // Muzzle flash particles
          for (let i = 0; i < 8; i++) {
            newParticles.push(createParticle(player.pos, '#fbbf24', 6, 'spark'));
          }
        } else if (player.hasFlamethrower) {
          const baseAngle = player.angle || 0;
          // Dense stream: 3 flames per tick with spread
          for (let i = 0; i < 3; i++) {
            const spreadAngle = baseAngle + (Math.random() - 0.5) * FLAMETHROWER_SPREAD;
            newFlames.push(createFlame(player.pos, spreadAngle, pid));
          }
          player.attackCooldown = FLAMETHROWER_COOLDOWN;

          // Little nozzle sparks
          if (Math.random() > 0.5) {
            newParticles.push(createParticle(player.pos, '#f97316', 2, 'spark'));
          }
        } else if (player.hasSword || player.hasChainsaw) {
          // Sword/chainsaw melee attack
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
            if (isFriendlyFire(this.state, pid, targetId)) return;
            const target = this.state.players[targetId];
            if (!target.active) return;

            // Elevation check: Melee attacks only hit players on the same level
            if (target.elevation !== player.elevation) return;

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
                    player.score = (player.score ?? 0) + 1;
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

        let speed = PLAYER_SPEED * ((player as any).speedMod ?? 1);
        if (player.isBlocking) speed *= PLAYER_BLOCK_SPEED_MOD;
        if (player.isAttacking) speed *= 0.2;

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
      if (this.state.tileMap) {
        // Toggle elevation when stepping on stairs
        // Check 8 points around the player to be more forgiving than just the center
        const r = player.radius * 0.8;
        const pts = [
          { x: player.pos.x + r, y: player.pos.y },
          { x: player.pos.x - r, y: player.pos.y },
          { x: player.pos.x, y: player.pos.y + r },
          { x: player.pos.x, y: player.pos.y - r },
          { x: player.pos.x + r * 0.7, y: player.pos.y + r * 0.7 },
          { x: player.pos.x - r * 0.7, y: player.pos.y + r * 0.7 },
          { x: player.pos.x + r * 0.7, y: player.pos.y - r * 0.7 },
          { x: player.pos.x - r * 0.7, y: player.pos.y - r * 0.7 },
        ];

        let onStairs = false;
        for (const p of pts) {
          const tx = Math.floor(p.x / TILE_SIZE);
          const ty = Math.floor(p.y / TILE_SIZE);
          if (ty >= 0 && ty < this.state.tileMap.length && tx >= 0 && tx < this.state.tileMap[0].length) {
            if (this.state.tileMap[ty][tx] === TILE_STAIRS) {
              onStairs = true;
              break;
            }
          }
        }

        if (onStairs) {
          // Add logging for debugging
          // console.log(`Player ${player.id} on stairs. vel.y: ${player.vel.y}, current elevation: ${player.elevation}`);
          if (player.vel.y < 0 && player.elevation === 0) {
            player.elevation = 1;
            // console.log(`Elevation changed to 1 (Roof)`);
          } else if (player.vel.y > 0 && player.elevation === 1) {
            player.elevation = 0;
            // console.log(`Elevation changed to 0 (Ground)`);
          }
        }

        if (checkWallCollision(player, this.state.tileMap)) {
          player.pos.x = oldX;
          player.pos.y = oldY;
        }
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
          player.hasGun = true;
          player.hasSword = false;
          player.hasChainsaw = false;
          player.hasBomb = false;
          player.hasMinigun = false;
          gp.active = false;
          for (let i = 0; i < 12; i++) {
            newParticles.push(createParticle(player.pos, '#fbbf24', 5, 'spark'));
          }
        }
      });

      // Minigun pickup collision
      newMinigunPickups.forEach(mp => {
        if (!mp.active) return;
        if (player.hasMinigun) return;
        const d = dist(player.pos, mp.pos);
        if (d < player.radius + 25) {
          player.hasMinigun = true;
          player.hasGun = false;
          player.hasSword = false;
          player.hasChainsaw = false;
          player.hasBomb = false;
          mp.active = false;
          for (let i = 0; i < 12; i++) {
            newParticles.push(createParticle(player.pos, '#64748b', 5, 'spark'));
          }
        }
      });

      // Sword pickup collision - one item at a time
      newSwordPickups.forEach(sp => {
        if (!sp.active) return;
        if (player.hasSword) return; // Already has sword
        const d = dist(player.pos, sp.pos);
        if (d < player.radius + SWORD_PICKUP_RADIUS) {
          player.hasSword = true;
          player.hasGun = false;
          player.hasChainsaw = false;
          player.hasBomb = false;
          player.hasMinigun = false;
          sp.active = false;
          // Silver/white pickup particles
          for (let i = 0; i < 12; i++) {
            newParticles.push(createParticle(player.pos, '#e5e7eb', 5, 'spark'));
          }
        }
      });

      // Chainsaw pickup collision - same as sword
      newChainsawPickups.forEach(cp => {
        if (!cp.active) return;
        if (player.hasChainsaw) return; // Already has chainsaw
        const d = dist(player.pos, cp.pos);
        if (d < player.radius + CHAINSAW_PICKUP_RADIUS) {
          player.hasChainsaw = true;
          player.hasGun = false;
          player.hasSword = false;
          player.hasBomb = false;
          player.hasMinigun = false;
          cp.active = false;
          for (let i = 0; i < 12; i++) {
            newParticles.push(createParticle(player.pos, '#ef4444', 5, 'spark'));
          }
        }
      });

      // Bomb pickup collision - one item at a time
      newBombPickups.forEach(bp => {
        if (!bp.active) return;
        if (player.hasBomb) return; // Already has bomb
        const d = dist(player.pos, bp.pos);
        if (d < player.radius + BOMB_PICKUP_RADIUS) {
          player.hasBomb = true;
          player.hasGun = false;
          player.hasSword = false;
          player.hasChainsaw = false;
          player.hasMinigun = false;
          bp.active = false;
          // Orange pickup particles
          for (let i = 0; i < 12; i++) {
            newParticles.push(createParticle(player.pos, '#f97316', 5, 'spark'));
          }
        }
      });

      // Shuriken pickup collision
      newShurikenPickups.forEach(sp => {
        if (!sp.active) return;
        if (player.hasShurikens) return;
        const d = dist(player.pos, sp.pos);
        if (d < player.radius + 25) {
          player.hasShurikens = true;
          player.hasMinigun = false;
          sp.active = false;
          for (let i = 0; i < 12; i++) {
            newParticles.push(createParticle(player.pos, '#94a3b8', 5, 'spark'));
          }
        }
      });

      // Burning grenade pickup collision
      newBurningGrenadePickups.forEach(bg => {
        if (!bg.active) return;
        if (player.hasBurningGrenade) return;
        const d = dist(player.pos, bg.pos);
        if (d < player.radius + 25) {
          player.hasBurningGrenade = true;
          player.hasMinigun = false;
          bg.active = false;
          for (let i = 0; i < 12; i++) {
            newParticles.push(createParticle(player.pos, '#f97316', 5, 'spark'));
          }
        }
      });

      // Flamethrower pickup collision
      newFlamethrowerPickups.forEach(fp => {
        if (!fp.active) return;
        if (player.hasFlamethrower) return;
        const d = dist(player.pos, fp.pos);
        if (d < player.radius + FLAMETHROWER_PICKUP_RADIUS) {
          player.hasFlamethrower = true;
          player.hasGun = false;
          player.hasSword = false;
          player.hasChainsaw = false;
          player.hasBomb = false;
          player.hasMinigun = false;
          fp.active = false;
          for (let i = 0; i < 15; i++) {
            newParticles.push(createParticle(player.pos, '#ea580c', 6, 'spark'));
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

    // CTF: flag logic
    if (this.state.gameMode === 'ctf' && this.state.flags.length >= 2) {
      const flags = this.state.flags;

      // Move flag with carrier
      flags.forEach(f => {
        if (f.carriedBy) {
          const carrier = this.state.players[f.carriedBy];
          if (carrier?.active) {
            f.pos.x = carrier.pos.x;
            f.pos.y = carrier.pos.y;
          } else {
            f.carriedBy = null;
            f.pos.x = f.basePos.x;
            f.pos.y = f.basePos.y;
          }
        }
      });

      // Pickup enemy flag
      playerIds.forEach(pid => {
        const player = this.state.players[pid];
        if (!player.active || player.teamId === undefined) return;
        const myTeam = player.teamId;
        const enemyFlag = flags.find(f => f.teamId !== myTeam);
        if (!enemyFlag || enemyFlag.carriedBy) return;
        const d = dist(player.pos, enemyFlag.pos);
        if (d < player.radius + CTF_FLAG_PICKUP_RADIUS) {
          enemyFlag.carriedBy = pid;
          for (let i = 0; i < 8; i++) {
            newParticles.push(createParticle(player.pos, myTeam === 0 ? '#3b82f6' : '#ef4444', 4, 'spark'));
          }
        }
      });

      // Capture: carrier brings enemy flag to own base — reset flag to enemy base
      flags.forEach(f => {
        if (!f.carriedBy) return;
        const carrier = this.state.players[f.carriedBy];
        if (!carrier?.active) return;
        const myTeam = carrier.teamId;
        if (myTeam === undefined || f.teamId === myTeam) return;
        const d = dist(carrier.pos, (myTeam === 0 ? CTF_BASE_LEFT : CTF_BASE_RIGHT));
        if (d < CTF_BASE_RADIUS) {
          f.carriedBy = null;
          f.pos.x = f.basePos.x;
          f.pos.y = f.basePos.y;
          for (let i = 0; i < 12; i++) {
            newParticles.push(createParticle(carrier.pos, myTeam === 0 ? '#3b82f6' : '#ef4444', 5, 'spark'));
          }
        }
      });

      // CTF victory: time's up
      if (this.state.gameTime >= CTF_MATCH_DURATION) {
        let winnerTeam: 0 | 1 | null = null;
        const team0Flag = flags.find(f => f.teamId === 0);
        const team1Flag = flags.find(f => f.teamId === 1);
        const team0AtBase = team0Flag && !team0Flag.carriedBy && dist(team0Flag.pos, team0Flag.basePos) < 30;
        const team1AtBase = team1Flag && !team1Flag.carriedBy && dist(team1Flag.pos, team1Flag.basePos) < 30;
        if (team0AtBase && !team1AtBase) winnerTeam = 0;
        else if (team1AtBase && !team0AtBase) winnerTeam = 1;
        else if (team0AtBase && team1AtBase) winnerTeam = 0;
        if (winnerTeam !== null) {
          this.state.status = 'VICTORY';
          this.state.winnerTeamId = winnerTeam;
          this.stopGameLoop();
          this.savePlayFunPoints('ctf', winnerTeam);
          if (this.roomRegistered) {
            this.notifyLobby({ type: 'ROOM_CLOSED', roomId: this.room.id });
            this.roomRegistered = false;
          }
        }
      }
    }

    // Update particles
    newParticles.forEach(p => {
      p.pos.x += p.vel.x * DT;
      p.pos.y += p.vel.y * DT;
      p.life -= DT * p.decay;
    });
    newParticles = newParticles.filter(p => p.life > 0);

    // Victory check (deathmatch only)
    if (this.state.gameMode !== 'ctf' && activeCount === 1 && playerIds.length > 1) {
      this.state.status = 'VICTORY';
      this.state.winnerId = lastSurvivor;
      this.stopGameLoop();
      this.savePlayFunPoints('deathmatch', undefined, lastSurvivor);
      // Notify lobby that room is done
      if (this.roomRegistered) {
        this.notifyLobby({ type: 'ROOM_CLOSED', roomId: this.room.id });
        this.roomRegistered = false;
      }
    }

    this.state.particles = newParticles;
    this.state.bombs = newBombs;
    this.state.unicorns = newUnicorns;
    this.state.satan = newSatan;
    this.state.healthPickups = newHealthPickups;
    this.state.gunPickups = newGunPickups.filter(gp => gp.active);
    this.state.swordPickups = newSwordPickups.filter(sp => sp.active);
    this.state.chainsawPickups = newChainsawPickups.filter(cp => cp.active);
    this.state.bombPickups = newBombPickups.filter(bp => bp.active);
    this.state.minigunPickups = newMinigunPickups.filter(mp => mp.active);
    this.state.shurikenPickups = newShurikenPickups.filter(sp => sp.active);
    this.state.burningGrenadePickups = newBurningGrenadePickups.filter(bg => bg.active);
    this.state.flamethrowerPickups = newFlamethrowerPickups.filter(fp => fp.active);
    this.state.burningGrenades = newBurningGrenades;
    this.state.fireZones = newFireZones;
    this.state.bullets = newBullets;
    this.state.flames = newFlames;
    this.state.thrownSwords = newThrownSwords;
    this.state.shurikenProjectiles = newShurikenProjectiles;
    this.state.shake = newShake;
  }

  async savePlayFunPoints(mode: 'deathmatch' | 'ctf', winnerTeamId?: 0 | 1, winnerId?: string) {
    const gameId = this.room.env.PLAYFUN_GAME_ID as string | undefined;
    const apiKey = this.room.env.OGP_API_KEY as string | undefined;
    const secretKey = this.room.env.OGP_API_SECRET_KEY as string | undefined;
    if (!gameId || !apiKey || !secretKey) return;

    const pointsRecord: Record<string, number> = {};
    const playerIds = Object.keys(this.state.players);

    if (mode === 'deathmatch') {
      for (const pid of playerIds) {
        const ogpId = this.playerOgpIds.get(pid);
        if (!ogpId) continue;
        const player = this.state.players[pid];
        let pts = (player?.score ?? 0) * POINTS_KILL + POINTS_PARTICIPATION;
        if (pid === winnerId) pts += POINTS_VICTORY;
        pointsRecord[ogpId] = pts;
      }
    } else {
      for (const pid of playerIds) {
        const ogpId = this.playerOgpIds.get(pid);
        if (!ogpId) continue;
        const player = this.state.players[pid];
        let pts = (player?.score ?? 0) * POINTS_CTF_CAPTURE + POINTS_PARTICIPATION;
        if (player?.teamId === winnerTeamId) pts += POINTS_CTF_VICTORY;
        pointsRecord[ogpId] = pts;
      }
    }

    if (Object.keys(pointsRecord).length === 0) return;
    try {
      const client = new OpenGameClient({ apiKey, secretKey });
      await client.play.batchSavePoints({ gameId, pointsRecord });
      console.log('[GAME] savePlayFunPoints OK:', Object.keys(pointsRecord).length, 'players');
    } catch (e) {
      console.error('[GAME] savePlayFunPoints error:', e);
    }
  }

  broadcast() {
    const { tileMap, particles, flames, ...rest } = this.state;
    const cappedParticles = particles.slice(-80);
    const cappedFlames = flames.slice(-100);
    const payload = { ...rest, particles: cappedParticles, flames: cappedFlames, maxPlayers: this.maxPlayers };
    const message = JSON.stringify({
      type: 'STATE',
      payload,
      hostId: this.hostId
    });
    for (const conn of this.room.getConnections()) {
      conn.send(message);
    }
  }
}
