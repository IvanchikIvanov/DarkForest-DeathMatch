
export const CANVAS_WIDTH = 4800; // Doubled from 2400
export const CANVAS_HEIGHT = 3600; // Doubled from 1800
export const TILE_SIZE = 64;

export const FPS = 60;
export const DT = 1 / FPS;

// Colors
export const COLORS = {
  background: '#18181b', // zinc-900
  floor: '#27272a', // zinc-800
  player: '#3b82f6', // blue-500
  playerDodge: '#93c5fd', // blue-300
  enemy: '#ef4444', // red-500
  shield: '#fbbf24', // amber-400
  sword: '#e4e4e7', // zinc-200
  wall: '#52525b', // zinc-600
  text: '#ffffff',
  blood: '#dc2626',
  // New terrain colors
  grass: '#22c55e', // green-500
  water: '#3b82f6', // blue-500
  waterDeep: '#1d4ed8', // blue-700
  bush: '#15803d', // green-700
  stone: '#78716c', // stone-500
  street: '#3f3f46', // asphalt
  sidewalk: '#a1a1aa', // concrete
  indoorFloor: '#854d0e', // wood planks
  roof: '#991b1b', // red brick roof
  stairs: '#b45309', // wooden stairs
  bomb: '#ec4899', // pink-500
  explosion: '#fbbf24', // amber-400
  explosionInner: '#ef4444', // red-500
  flamethrower: '#ea580c', // orange-600
};

// Gameplay Balance
export const PLAYER_HP = 100;
export const SWORD_DAMAGE = 25;
export const PLAYER_SPEED = 500; // Increased for faster movement
export const PLAYER_BLOCK_SPEED_MOD = 0.4; // Slower when blocking
export const PLAYER_DODGE_SPEED = 1000; // Doubled from 500
export const PLAYER_DODGE_DURATION = 0.3;
export const PLAYER_DODGE_COOLDOWN = 1.0;

// Combat
export const SWORD_RANGE = 220; // Increased to match visual sword length
export const SWORD_ARC = Math.PI * 2; // Very wide swing (full circle)
export const SWORD_COOLDOWN = 0.6;
export const SWORD_ATTACK_DURATION = 0.2; // Visual swing time
export const SHIELD_BLOCK_ANGLE = Math.PI / 1.2; // Frontal protection arc
export const SWORD_KNOCKBACK = 500; // Knockback distance when hit by sword
export const SWORD_KNOCKBACK_SPEED = 2500; // Knockback velocity speed - VERY strong
export const KNOCKBACK_FRICTION = 0.94; // Friction for smooth knockback decay (higher = longer)

// Bomb System
export const BOMB_DAMAGE = 25;
export const BOMB_RADIUS = 120; // Explosion radius
export const BOMB_FUSE_TIME = 2.0; // Seconds before explosion
export const BOMB_COOLDOWN = 3.0; // Seconds between throws
export const BOMB_THROW_DISTANCE = 200; // How far bomb is thrown

// Flamethrower System
export const FLAMETHROWER_DAMAGE_PER_TICK = 3;
export const FLAMETHROWER_RANGE = 400; // Flame travel distance
export const FLAMETHROWER_SPREAD = 0.5; // Cone angle
export const FLAMETHROWER_COOLDOWN = 0.05; // Rapid fire
export const FLAME_LIFESPAN = 0.5; // How long flames exist
export const FLAME_SPEED = 500;
export const FLAME_HIT_RADIUS = 20;

// CTF
export const CTF_MATCH_DURATION = 180; // 3 min
export const CTF_BASE_RADIUS = 150;

// Terrain Effects
export const WATER_SPEED_MOD = 0.5; // 50% slower in water
export const BUSH_SPEED_MOD = 0.7; // 30% slower in bushes

// Tile Types
export const TILE_FLOOR = 0;
export const TILE_WALL = 1;
export const TILE_WALL_TOP = 2;
export const TILE_GRASS = 3;
export const TILE_WATER = 4;
export const TILE_BUSH = 5;
export const TILE_STONE = 6; // Non-walkable rock
export const TILE_STREET = 7;
export const TILE_SIDEWALK = 8;
export const TILE_INDOOR_FLOOR = 9;
export const TILE_ROOF = 10;
export const TILE_STAIRS = 11;

// Obstacle Types
export const OBSTACLE_TREE = 'tree';
export const OBSTACLE_ROCK = 'rock';
export const OBSTACLE_BUSH = 'bush';

