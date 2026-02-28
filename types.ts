
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
  heroType?: 'kenny' | 'cartman' | 'kyle' | 'stanNinja' | 'snoopDogg' | 'superhero';
  elevation: number; // 0 = ground, 1 = roof

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

  // Special Weapons
  hasFlamethrower?: boolean;
  flamethrowerCooldown?: number;

  // Stats
  score: number;

  // CTF
  teamId?: 0 | 1;
}

export interface HealthPickup {
  id: string;
  pos: Vector2;
  active: boolean;
  healAmount: number;
}

export interface GunPickup {
  id: string;
  pos: Vector2;
  active: boolean;
}

export interface MinigunPickup {
  id: string;
  pos: Vector2;
  active: boolean;
}

export interface Bullet {
  id: string;
  pos: Vector2;
  vel: Vector2;
  ownerId: string;
  active: boolean;
}

export interface Unicorn {
  id: string;
  pos: Vector2;
  vel: Vector2;
  angle: number;
  active: boolean;
}

export interface Satan {
  id: string;
  pos: Vector2;
  createdAt: number;
  lastStrikeAt: number;
  lightningTarget: Vector2 | null;
  riftOpen: number;
  visibleY: number;
  riftState: 'shaking' | 'opening' | 'rising' | 'active';
}

export interface ShurikenPickup {
  id: string;
  pos: Vector2;
  active: boolean;
}

export interface ShurikenProjectile {
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

export interface BurningGrenadePickup {
  id: string;
  pos: Vector2;
  active: boolean;
}

export interface BurningGrenade {
  id: string;
  startPos: Vector2;
  targetPos: Vector2;
  progress: number;
  arcHeight: number;
  ownerId: string;
  active: boolean;
}

export interface FireZone {
  id: string;
  pos: Vector2;
  radius: number;
  maxRadius: number;
  duration: number;
  createdAt: number;
  active: boolean;
}

export interface FlamethrowerPickup {
  id: string;
  pos: Vector2;
  active: boolean;
}

export interface Flame {
  id: string;
  pos: Vector2;
  vel: Vector2;
  ownerId: string;
  active: boolean;
  life: number;
  maxLife: number;
  size?: number;
}

export interface ElectricPanel {
  pos: Vector2;
  radius: number;
}

export interface Flag {
  id: string;
  teamId: 0 | 1;
  pos: Vector2;
  carriedBy: string | null;
  basePos: Vector2;
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
  gunPickups: GunPickup[];
  minigunPickups?: MinigunPickup[];
  bullets: Bullet[];
  unicorns?: Unicorn[];
  satan?: Satan | null;
  shurikenPickups?: ShurikenPickup[];
  shurikenProjectiles?: ShurikenProjectile[];
  burningGrenadePickups?: BurningGrenadePickup[];
  burningGrenades?: BurningGrenade[];
  fireZones?: FireZone[];
  electricPanel?: ElectricPanel;
  electricChargerId?: string | null;
  flamethrowerPickups?: FlamethrowerPickup[];
  flames?: Flame[];
  tileMap?: number[][]; // Grid of tile indices
  shake: number;
  status: 'MENU' | 'LOBBY' | 'PLAYING' | 'VICTORY';
  winnerId?: string;
  gameMode?: 'deathmatch' | 'ctf';
  flags?: Flag[];
  winnerTeamId?: 0 | 1;
  maxPlayers?: number;
  lastHealthSpawnTime?: number;
  lastGunSpawnTime?: number;
  lastFlamethrowerSpawnTime?: number;
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
