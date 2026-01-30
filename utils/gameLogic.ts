
import { GameState, Player, EntityType, Vector2, PlayerInput, Particle, Wall } from '../types';
import { 
  CANVAS_WIDTH, CANVAS_HEIGHT, TILE_SIZE, DT, COLORS, PLAYER_HP, 
  PLAYER_SPEED, PLAYER_DODGE_SPEED, PLAYER_DODGE_DURATION, PLAYER_DODGE_COOLDOWN,
  PLAYER_BLOCK_SPEED_MOD, SWORD_RANGE, SWORD_COOLDOWN, 
  SWORD_ATTACK_DURATION, SHIELD_BLOCK_ANGLE, SWORD_ARC, SWORD_DAMAGE
} from '../constants';

// --- Helpers ---
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

// --- Arena Generation ---
const generateArena = (): { walls: Wall[], tileMap: number[][] } => {
  const walls: Wall[] = [];
  const cols = Math.ceil(CANVAS_WIDTH / TILE_SIZE);
  const rows = Math.ceil(CANVAS_HEIGHT / TILE_SIZE);
  const tileMap: number[][] = Array(rows).fill(0).map(() => Array(cols).fill(0));
  
  const centerX = cols / 2;
  const centerY = rows / 2;
  const arenaRadius = Math.min(cols, rows) / 2 - 2;

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const d = Math.hypot(x - centerX, y - centerY);
      
      if (d > arenaRadius) {
        // Outside arena - Solid wall
        tileMap[y][x] = 2; // Wall top
        if (y < rows - 1 && Math.hypot(x - centerX, (y + 1) - centerY) <= arenaRadius) {
            tileMap[y][x] = 1; // Wall side (facing arena)
        }
      } else if (d > arenaRadius - 1) {
          // Arena edge
          tileMap[y][x] = 0; // Floor for now
      } else {
          // Inside arena
          tileMap[y][x] = 0; // Floor
          
          // Add some random pillars
          if (Math.random() > 0.98 && d < arenaRadius - 5) {
              tileMap[y][x] = 2;
              if (y < rows - 1) tileMap[y+1][x] = 1;
          }
      }
    }
  }

  // Convert tilemap to Wall entities for physics (optional, can just use tilemap)
  // But keeping Walls for compatibility with current physics engine if we don't want to rewrite it fully
  // Actually, let's rewrite checkWallCollision to use tileMap.

  return { walls, tileMap };
};

// --- Collision Detection ---
const checkWallCollision = (player: Player, tileMap: number[][]): boolean => {
    if (!tileMap) return false;

    const checkPoint = (px: number, py: number) => {
        const tx = Math.floor(px / TILE_SIZE);
        const ty = Math.floor(py / TILE_SIZE);
        if (ty < 0 || ty >= tileMap.length || tx < 0 || tx >= tileMap[0].length) return true;
        return tileMap[ty][tx] !== 0; // 0 is floor
    };

    // Check 8 points around the player circle
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

// --- Initialization ---
export const createInitialState = (): GameState => {
    const { walls, tileMap } = generateArena();
    return {
        status: 'MENU',
        shake: 0,
        players: {}, 
        particles: [],
        walls: walls,
        tileMap: tileMap
    };
};

export const createPlayer = (id: string, index: number): Player => ({
  id: `p-${id}`,
  playerId: id,
  type: EntityType.PLAYER,
  pos: { 
      x: CANVAS_WIDTH / 2 + (index === 0 ? -200 : 200), 
      y: CANVAS_HEIGHT / 2 
  },
  vel: { x: 0, y: 0 },
  radius: 20,
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

// --- Update Loop ---
export const updateGame = (
  state: GameState, 
  inputs: Record<string, PlayerInput>
): GameState => {
  if (state.status !== 'PLAYING') return state;

  let newParticles = [...state.particles];
  let newShake = Math.max(0, state.shake - 1);
  const playerIds = Object.keys(state.players);
  let activeCount = 0;
  let lastSurvivor = '';

  playerIds.forEach(pid => {
    const player = state.players[pid];
    if (!player.active) return;
    activeCount++;
    lastSurvivor = pid;

    const input = inputs[pid] || { keys: [], mouse: player.pos, mouseDown: false, mouseRightDown: false };
    const keySet = new Set(input.keys);

    // --- Cooldowns ---
    player.attackCooldown = Math.max(0, player.attackCooldown - DT);
    player.cooldown = Math.max(0, player.cooldown - DT);
    player.attackTimer = Math.max(0, player.attackTimer - DT);

    // --- Aiming ---
    const dx = input.mouse.x - player.pos.x;
    const dy = input.mouse.y - player.pos.y;
    player.angle = Math.atan2(dy, dx);

    // --- Actions ---
    player.isBlocking = input.mouseRightDown && !player.isAttacking && !player.isDodging;

    if (input.mouseDown && player.attackCooldown <= 0 && !player.isDodging && !player.isBlocking) {
        player.isAttacking = true;
        player.attackTimer = SWORD_ATTACK_DURATION;
        player.attackCooldown = SWORD_COOLDOWN;
        
        playerIds.forEach(targetId => {
            if (targetId === pid) return;
            const target = state.players[targetId];
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
                        for(let i=0; i<5; i++) newParticles.push(createParticle(target.pos, COLORS.shield, 4));
                        const pushDir = normalize({ x: target.pos.x - player.pos.x, y: target.pos.y - player.pos.y });
                        target.pos.x += pushDir.x * 40;
                        target.pos.y += pushDir.y * 40;
                    } else if (!target.isDodging && target.hp > 0) {
                        target.hp = Math.max(0, target.hp - SWORD_DAMAGE);
                        newShake += 10;
                        for(let i=0; i<10; i++) newParticles.push(createParticle(target.pos, COLORS.blood, 6));
                        
                        if (target.hp <= 0) {
                            target.active = false;
                            newShake += 10;
                            for(let i=0; i<15; i++) newParticles.push(createParticle(target.pos, COLORS.blood, 8));
                        }
                    }
                }
            }
        });
    }
    
    if (player.attackTimer <= 0) player.isAttacking = false;

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
            dashDir = { x: Math.cos(player.angle||0), y: Math.sin(player.angle||0) };
        } else {
            dashDir = normalize(dashDir);
        }
        player.vel = { x: dashDir.x * PLAYER_DODGE_SPEED, y: dashDir.y * PLAYER_DODGE_SPEED };
        
        for(let i=0; i<3; i++) newParticles.push(createParticle(player.pos, COLORS.playerDodge, 2));
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

        player.vel = { x: moveDir.x * speed, y: moveDir.y * speed };
    }

    const oldX = player.pos.x;
    const oldY = player.pos.y;
    
    player.pos.x += player.vel.x * DT;
    player.pos.y += player.vel.y * DT;
    
    if (state.tileMap && checkWallCollision(player, state.tileMap)) {
      player.pos.x = oldX;
      player.pos.y = oldY;
    }
    
    player.pos.x = clamp(player.pos.x, player.radius, CANVAS_WIDTH - player.radius);
    player.pos.y = clamp(player.pos.y, player.radius, CANVAS_HEIGHT - player.radius);
  });

  newParticles.forEach(p => {
    p.pos.x += p.vel.x * DT;
    p.pos.y += p.vel.y * DT;
    p.life -= DT * p.decay;
  });
  newParticles = newParticles.filter(p => p.life > 0);

  if (activeCount === 1 && playerIds.length > 1) {
      return { ...state, status: 'VICTORY', winnerId: lastSurvivor, particles: newParticles, shake: newShake };
  }

  return {
    ...state,
    particles: newParticles,
    shake: newShake
  };
};

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
