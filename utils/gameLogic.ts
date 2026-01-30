
import { GameState, Player, EntityType, Vector2, PlayerInput, Particle, Wall, Bomb, Obstacle } from '../types';
import {
  CANVAS_WIDTH, CANVAS_HEIGHT, TILE_SIZE, DT, COLORS, PLAYER_HP,
  PLAYER_SPEED, PLAYER_DODGE_SPEED, PLAYER_DODGE_DURATION, PLAYER_DODGE_COOLDOWN,
  PLAYER_BLOCK_SPEED_MOD, SWORD_RANGE, SWORD_COOLDOWN,
  SWORD_ATTACK_DURATION, SHIELD_BLOCK_ANGLE, SWORD_ARC, SWORD_DAMAGE,
  BOMB_DAMAGE, BOMB_RADIUS, BOMB_FUSE_TIME, BOMB_COOLDOWN, BOMB_THROW_DISTANCE,
  WATER_SPEED_MOD, BUSH_SPEED_MOD,
  TILE_FLOOR, TILE_WALL, TILE_WALL_TOP, TILE_GRASS, TILE_WATER, TILE_BUSH, TILE_STONE
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

// Seeded random for consistent arena generation
const seededRandom = (seed: number) => {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
};

// --- Arena Generation ---
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
        tileMap[y][x] = TILE_WALL_TOP;
        if (y < rows - 1 && Math.hypot(x - centerX, (y + 1) - centerY) <= arenaRadius) {
          tileMap[y][x] = TILE_WALL;
        }
      } else if (d > arenaRadius - 1) {
        tileMap[y][x] = TILE_FLOOR;
      } else {
        seed++;
        const rand = seededRandom(seed);
        const rand2 = seededRandom(seed + 1000);

        // Default to floor or grass (50% each)
        if (rand < 0.5) {
          tileMap[y][x] = TILE_GRASS;
        } else {
          tileMap[y][x] = TILE_FLOOR;
        }

        // Water pools (8% chance, clusters)
        if (rand > 0.92 && d < arenaRadius - 3) {
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const ny = y + dy;
              const nx = x + dx;
              if (ny >= 0 && ny < rows && nx >= 0 && nx < cols) {
                const nd = Math.hypot(nx - centerX, ny - centerY);
                if (nd < arenaRadius - 2) {
                  tileMap[ny][nx] = TILE_WATER;
                }
              }
            }
          }
        }

        // Bush tile patches (10% chance)
        if (rand > 0.82 && rand <= 0.92 && d < arenaRadius - 2) {
          tileMap[y][x] = TILE_BUSH;
        }

        // Stone tile obstacles (non-walkable)
        if (rand > 0.97 && d < arenaRadius - 4 && d > 3) {
          tileMap[y][x] = TILE_STONE;
        }

        // Tree obstacles (3% chance)
        if (rand2 > 0.97 && d < arenaRadius - 4 && d > 3) {
          obstacles.push({
            id: `tree-${x}-${y}`,
            pos: { x: x * TILE_SIZE + TILE_SIZE / 2, y: y * TILE_SIZE + TILE_SIZE / 2 },
            obstacleType: 'tree',
            hp: 50,
            radius: 24,
            destroyed: false
          });
        }

        // Rock obstacles (2% chance)
        if (rand2 > 0.95 && rand2 <= 0.97 && d < arenaRadius - 4 && d > 3) {
          obstacles.push({
            id: `rock-${x}-${y}`,
            pos: { x: x * TILE_SIZE + TILE_SIZE / 2, y: y * TILE_SIZE + TILE_SIZE / 2 },
            obstacleType: 'rock',
            hp: -1,
            radius: 28,
            destroyed: false
          });
        }

        // Bush obstacles (2% chance)
        if (rand2 > 0.93 && rand2 <= 0.95 && d < arenaRadius - 3 && d > 2) {
          obstacles.push({
            id: `bush-${x}-${y}`,
            pos: { x: x * TILE_SIZE + TILE_SIZE / 2, y: y * TILE_SIZE + TILE_SIZE / 2 },
            obstacleType: 'bush',
            hp: 20,
            radius: 20,
            destroyed: false
          });
        }
      }
    }
  }

  return { walls, tileMap, obstacles };
};

// --- Collision Detection ---
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

// --- Initialization ---
export const createInitialState = (): GameState => {
  const { walls, tileMap, obstacles } = generateArena();
  return {
    status: 'MENU',
    shake: 0,
    players: {},
    particles: [],
    walls: walls,
    bombs: [],
    obstacles: obstacles,
    tileMap: tileMap
  };
};

export const createPlayer = (id: string, index: number): Player => ({
  id: `p-${id}`,
  playerId: id,
  type: EntityType.PLAYER,
  pos: {
    x: CANVAS_WIDTH / 2 + (index === 0 ? -600 : 600),
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
  bombCooldown: 0,
  score: 0
});

// --- Update Loop ---
export const updateGame = (
  state: GameState,
  inputs: Record<string, PlayerInput>
): GameState => {
  if (state.status !== 'PLAYING') return state;

  let newParticles = [...state.particles];
  let newBombs = [...(state.bombs || [])];
  let newShake = Math.max(0, state.shake - 1);
  const playerIds = Object.keys(state.players);
  let activeCount = 0;
  let lastSurvivor = '';

  // Update bombs
  newBombs = newBombs.filter(bomb => {
    bomb.fuseTimer -= DT;

    if (Math.random() > 0.7) {
      newParticles.push(createParticle({ x: bomb.pos.x, y: bomb.pos.y - 20 }, '#fbbf24', 2));
    }

    if (bomb.fuseTimer <= 0) {
      newShake += 20;

      for (let i = 0; i < 30; i++) {
        newParticles.push(createParticle(bomb.pos, COLORS.explosion || '#fbbf24', 8));
      }
      for (let i = 0; i < 15; i++) {
        newParticles.push(createParticle(bomb.pos, COLORS.explosionInner || '#ef4444', 6));
      }

      playerIds.forEach(pid => {
        const player = state.players[pid];
        if (!player.active) return;
        const d = dist(bomb.pos, player.pos);
        if (d < BOMB_RADIUS) {
          const damageMultiplier = 1 - (d / BOMB_RADIUS);
          const damage = Math.floor(BOMB_DAMAGE * damageMultiplier);
          if (!player.isDodging && player.hp > 0) {
            player.hp = Math.max(0, player.hp - damage);
            for (let i = 0; i < 8; i++) {
              newParticles.push(createParticle(player.pos, COLORS.blood, 5));
            }
            const knockDir = normalize({ x: player.pos.x - bomb.pos.x, y: player.pos.y - bomb.pos.y });
            player.pos.x += knockDir.x * 60 * damageMultiplier;
            player.pos.y += knockDir.y * 60 * damageMultiplier;

            if (player.hp <= 0) {
              player.active = false;
              newShake += 10;
              for (let i = 0; i < 15; i++) {
                newParticles.push(createParticle(player.pos, COLORS.blood, 8));
              }
            }
          }
        }
      });

      // Damage obstacles
      if (state.obstacles) {
        state.obstacles.forEach(obs => {
          if (obs.destroyed || obs.hp < 0) return;
          const d = dist(bomb.pos, obs.pos);
          if (d < BOMB_RADIUS + obs.radius) {
            obs.hp -= BOMB_DAMAGE;
            if (obs.hp <= 0) {
              obs.destroyed = true;
              for (let i = 0; i < 10; i++) {
                newParticles.push(createParticle(obs.pos, obs.obstacleType === 'tree' ? '#22c55e' : '#78716c', 4));
              }
            }
          }
        });
      }

      return false;
    }
    return true;
  });

  playerIds.forEach(pid => {
    const player = state.players[pid];
    if (!player.active) return;
    activeCount++;
    lastSurvivor = pid;

    const input = inputs[pid] || { keys: [], mouse: player.pos, mouseDown: false, mouseRightDown: false, throwBomb: false };
    const keySet = new Set(input.keys);

    // Cooldowns
    player.attackCooldown = Math.max(0, player.attackCooldown - DT);
    player.cooldown = Math.max(0, player.cooldown - DT);
    player.attackTimer = Math.max(0, player.attackTimer - DT);
    if (player.bombCooldown !== undefined) {
      player.bombCooldown = Math.max(0, player.bombCooldown - DT);
    }

    // Aiming
    const dx = input.mouse.x - player.pos.x;
    const dy = input.mouse.y - player.pos.y;
    player.angle = Math.atan2(dy, dx);

    // Blocking
    player.isBlocking = input.mouseRightDown && !player.isAttacking && !player.isDodging;

    // Bomb throwing
    if (input.throwBomb && (player.bombCooldown || 0) <= 0 && !player.isDodging) {
      const throwX = player.pos.x + Math.cos(player.angle || 0) * BOMB_THROW_DISTANCE;
      const throwY = player.pos.y + Math.sin(player.angle || 0) * BOMB_THROW_DISTANCE;

      if (state.tileMap) {
        const tile = getTileAt(state.tileMap, throwX, throwY);
        if (tile !== TILE_WALL && tile !== TILE_WALL_TOP && tile !== TILE_STONE) {
          const bomb: Bomb = {
            id: `bomb-${Math.random()}`,
            type: EntityType.BOMB,
            pos: { x: throwX, y: throwY },
            vel: { x: 0, y: 0 },
            radius: 16,
            color: COLORS.bomb || '#f97316',
            active: true,
            fuseTimer: BOMB_FUSE_TIME,
            ownerId: pid
          };
          newBombs.push(bomb);
          player.bombCooldown = BOMB_COOLDOWN;
        }
      }
    }

    // Attack
    if (input.mouseDown && player.attackCooldown <= 0 && !player.isDodging && !player.isBlocking) {
      player.isAttacking = true;
      player.attackTimer = SWORD_ATTACK_DURATION;
      player.attackCooldown = SWORD_COOLDOWN;

      // Sword trail
      for (let i = 0; i < 3; i++) {
        const trailAngle = (player.angle || 0) + (Math.random() - 0.5) * 0.5;
        const trailDist = 40 + Math.random() * 20;
        newParticles.push(createParticle(
          { x: player.pos.x + Math.cos(trailAngle) * trailDist, y: player.pos.y + Math.sin(trailAngle) * trailDist },
          '#ffffff',
          2
        ));
      }

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
              for (let i = 0; i < 5; i++) newParticles.push(createParticle(target.pos, COLORS.shield, 4));
              const pushDir = normalize({ x: target.pos.x - player.pos.x, y: target.pos.y - player.pos.y });
              target.pos.x += pushDir.x * 40;
              target.pos.y += pushDir.y * 40;
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

      for (let i = 0; i < 5; i++) newParticles.push(createParticle(player.pos, COLORS.playerDodge, 3));
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

      // Terrain speed modifier
      if (state.tileMap) {
        speed *= getTerrainSpeedModifier(state.tileMap, player.pos);
      }

      player.vel = { x: moveDir.x * speed, y: moveDir.y * speed };
    }

    const oldX = player.pos.x;
    const oldY = player.pos.y;

    player.pos.x += player.vel.x * DT;
    player.pos.y += player.vel.y * DT;

    // Wall collision
    if (state.tileMap && checkWallCollision(player, state.tileMap)) {
      player.pos.x = oldX;
      player.pos.y = oldY;
    }

    // Obstacle collision
    if (state.obstacles) {
      const collidedObstacle = checkObstacleCollision(player.pos, player.radius, state.obstacles);
      if (collidedObstacle) {
        player.pos.x = oldX;
        player.pos.y = oldY;
      }
    }

    player.pos.x = clamp(player.pos.x, player.radius, CANVAS_WIDTH - player.radius);
    player.pos.y = clamp(player.pos.y, player.radius, CANVAS_HEIGHT - player.radius);

    // Water splash
    if (state.tileMap) {
      const tile = getTileAt(state.tileMap, player.pos.x, player.pos.y);
      if (tile === TILE_WATER && Math.random() > 0.9 && (player.vel.x !== 0 || player.vel.y !== 0)) {
        newParticles.push(createParticle(player.pos, '#60a5fa', 1));
      }
    }
  });

  // Update particles
  newParticles.forEach(p => {
    p.pos.x += p.vel.x * DT;
    p.pos.y += p.vel.y * DT;
    p.life -= DT * p.decay;
  });
  newParticles = newParticles.filter(p => p.life > 0);

  // Victory check
  if (activeCount === 1 && playerIds.length > 1) {
    return { ...state, status: 'VICTORY', winnerId: lastSurvivor, particles: newParticles, bombs: newBombs, shake: newShake };
  }

  return {
    ...state,
    particles: newParticles,
    bombs: newBombs,
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
