
export interface Vector2 {
  x: number;
  y: number;
}

export enum EntityType {
  PLAYER,
  WALL,
  PARTICLE,
  SWORD_HITBOX
}

export interface Entity {
  id: string;
  type: EntityType;
  pos: Vector2;
  vel: Vector2;
  radius: number;
  color: string;
  active: boolean;
  hp?: number;
  maxHp?: number;
  angle?: number; // For rotation/facing
}

export interface Player extends Entity {
  type: EntityType.PLAYER;
  playerId: string; // Network ID
  
  // Movement / Dodge
  isDodging: boolean;
  dodgeTimer: number; 
  cooldown: number; // Dodge cooldown
  
  // Combat
  isBlocking: boolean;
  isAttacking: boolean;
  attackTimer: number; // For visual swing animation
  attackCooldown: number;
  
  // Stats
  score: number;
}

export interface Particle extends Entity {
  life: number; // 0 to 1
  decay: number;
}

export interface Wall extends Entity {
  type: EntityType.WALL;
  width: number;
  height: number;
}

export interface GameState {
  players: Record<string, Player>;
  particles: Particle[];
  walls: Wall[];
  shake: number;
  status: 'MENU' | 'LOBBY' | 'PLAYING' | 'VICTORY';
  winnerId?: string;
}

export interface PlayerInput {
  keys: string[]; // Serializable array of pressed keys
  mouse: Vector2;
  mouseDown: boolean; // Attack
  mouseRightDown: boolean; // Shield
}

export interface GameAssets {
  player: HTMLImageElement;
  sword: HTMLImageElement;
  shield: HTMLImageElement;
  floor: HTMLCanvasElement;
}

export interface Web3RoomInfo {
  roomId: number;
  betAmount: string;
  creator: string;
  challenger: string | null;
  gameFinished: boolean;
  winner: string | null;
}
