
export const CANVAS_WIDTH = 2400;
export const CANVAS_HEIGHT = 1800;

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
};

// Gameplay Balance
export const PLAYER_HP = 100;
export const SWORD_DAMAGE = 25;
export const PLAYER_SPEED = 150;
export const PLAYER_BLOCK_SPEED_MOD = 0.4; // Slower when blocking
export const PLAYER_DODGE_SPEED = 500;
export const PLAYER_DODGE_DURATION = 0.3; 
export const PLAYER_DODGE_COOLDOWN = 1.0;

// Combat
export const SWORD_RANGE = 140;
export const SWORD_ARC = Math.PI * 2; // Very wide swing (full circle)
export const SWORD_COOLDOWN = 0.6;
export const SWORD_ATTACK_DURATION = 0.2; // Visual swing time
export const SHIELD_BLOCK_ANGLE = Math.PI / 1.2; // Frontal protection arc

