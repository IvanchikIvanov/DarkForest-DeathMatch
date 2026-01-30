
export const CANVAS_WIDTH = 2400;
export const CANVAS_HEIGHT = 1800;
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
  bomb: '#f97316', // orange-500
  explosion: '#fbbf24', // amber-400
  explosionInner: '#ef4444', // red-500
};

// Gameplay Balance
export const PLAYER_HP = 100;
export const SWORD_DAMAGE = 25;
export const PLAYER_SPEED = 300; // Doubled from 150
export const PLAYER_BLOCK_SPEED_MOD = 0.4; // Slower when blocking
export const PLAYER_DODGE_SPEED = 1000; // Doubled from 500
export const PLAYER_DODGE_DURATION = 0.3;
export const PLAYER_DODGE_COOLDOWN = 1.0;

// Combat
export const SWORD_RANGE = 140;
export const SWORD_ARC = Math.PI * 2; // Very wide swing (full circle)
export const SWORD_COOLDOWN = 0.6;
export const SWORD_ATTACK_DURATION = 0.2; // Visual swing time
export const SHIELD_BLOCK_ANGLE = Math.PI / 1.2; // Frontal protection arc

// Bomb System
export const BOMB_DAMAGE = 25;
export const BOMB_RADIUS = 120; // Explosion radius
export const BOMB_FUSE_TIME = 2.0; // Seconds before explosion
export const BOMB_COOLDOWN = 3.0; // Seconds between throws
export const BOMB_THROW_DISTANCE = 200; // How far bomb is thrown

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

// Obstacle Types
export const OBSTACLE_TREE = 'tree';
export const OBSTACLE_ROCK = 'rock';
export const OBSTACLE_BUSH = 'bush';

