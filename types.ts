
export interface Vector2 {
  x: number;
  y: number;
}

export enum EntityType {
  PLAYER,
  WALL,
  PARTICLE,
  SWORD_HITBOX,
  BOMB,
  OBSTACLE
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
  knockbackVel: Vector2; // Separate knockback velocity

  // Combat
  isBlocking: boolean;
  isAttacking: boolean;
  attackTimer: number; // For visual swing animation
  attackCooldown: number;

  // Bomb
  bombCooldown: number;

  // Stats
  score: number;
}

export interface HealthPickup {
  id: string;
  pos: Vector2;
  active: boolean;
  healAmount: number;
}

export interface Particle extends Entity {
  life: number; // 0 to 1
  decay: number;
  particleType?: 'blood' | 'spark' | 'explosion' | 'trail' | 'water';
}

export interface Wall extends Entity {
  type: EntityType.WALL;
  width: number;
  height: number;
}

export interface Bomb extends Entity {
  type: EntityType.BOMB;
  fuseTimer: number; // Time until explosion
  ownerId: string; // Player who threw it
}

export interface Obstacle {
  id: string;
  pos: Vector2;
  obstacleType: 'tree' | 'rock' | 'bush';
  hp: number; // -1 for indestructible
  radius: number;
  destroyed: boolean;
}

export interface GameState {
  players: Record<string, Player>;
  particles: Particle[];
  walls: Wall[];
  bombs: Bomb[];
  obstacles: Obstacle[];
  healthPickups: HealthPickup[];
  tileMap?: number[][]; // Grid of tile indices
  shake: number;
  status: 'MENU' | 'LOBBY' | 'PLAYING' | 'VICTORY';
  winnerId?: string;
  lastHealthSpawnTime?: number;
}

export interface GameAssets {
  player: HTMLImageElement;
  playerEnemy: HTMLImageElement;
  sword: HTMLImageElement;
  shield: HTMLImageElement;
  floor: HTMLCanvasElement;
  tiles: HTMLCanvasElement[]; // Array of tile images (floor, wall, wallTop, grass, water, bush, stone)
  bomb: HTMLImageElement;
  tree: HTMLImageElement;
  rock: HTMLImageElement;
  bush: HTMLImageElement;
}


export interface PlayerInput {
  keys: string[]; // Serializable array of pressed keys
  mouse: Vector2;
  mouseDown: boolean; // Attack
  mouseRightDown: boolean; // Shield
  throwBomb: boolean; // E key for bomb
}

export interface Web3RoomInfo {
  roomId: number;
  betAmount: string;
  creator: string;
  challenger: string | null;
  gameFinished: boolean;
  winner: string | null;
}
