
import { GameState, Player, EntityType, Vector2, PlayerInput, Particle, Wall, Bomb, Obstacle } from '../types';
import {
  CANVAS_WIDTH, CANVAS_HEIGHT, TILE_SIZE, DT, COLORS, PLAYER_HP,
  PLAYER_SPEED, PLAYER_DODGE_SPEED, PLAYER_DODGE_DURATION, PLAYER_DODGE_COOLDOWN,
  PLAYER_BLOCK_SPEED_MOD, SWORD_RANGE, SWORD_COOLDOWN,
  SWORD_ATTACK_DURATION, SHIELD_BLOCK_ANGLE, SWORD_ARC, SWORD_DAMAGE, SWORD_KNOCKBACK, SWORD_KNOCKBACK_SPEED, KNOCKBACK_FRICTION,
  BOMB_DAMAGE, BOMB_RADIUS, BOMB_FUSE_TIME, BOMB_COOLDOWN, BOMB_THROW_DISTANCE,
  WATER_SPEED_MOD, BUSH_SPEED_MOD,
  TILE_FLOOR, TILE_WALL, TILE_WALL_TOP, TILE_GRASS, TILE_WATER, TILE_BUSH, TILE_STONE,
  TILE_STREET, TILE_SIDEWALK, TILE_INDOOR_FLOOR, TILE_ROOF, TILE_STAIRS
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

// --- Collision Detection ---
const getTileAt = (tileMap: number[][], x: number, y: number): number => {
  const tx = Math.floor(x / TILE_SIZE);
  const ty = Math.floor(y / TILE_SIZE);
  if (ty < 0 || ty >= tileMap.length || tx < 0 || tx >= tileMap[0].length) return TILE_WALL;
  return tileMap[ty][tx];
};

const checkWallCollision = (player: Player, tileMap: number[][]): boolean => {
  if (!tileMap) return false;

  const r = player.radius * 0.8;
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
    healthPickups: [],
    gunPickups: [],
    bullets: [],
    tileMap: tileMap,
    lastHealthSpawnTime: 0,
    lastGunSpawnTime: 0
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
  elevation: 0, // Starts on the ground
  isDodging: false,
  dodgeTimer: 0,
  cooldown: 0,
  knockbackVel: { x: 0, y: 0 },
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

    // Bomb throwing - throw in direction of cursor
    if (input.throwBomb && (player.bombCooldown || 0) <= 0 && !player.isDodging) {
      // Calculate angle directly from mouse position to ensure accurate direction
      const bombDx = input.mouse.x - player.pos.x;
      const bombDy = input.mouse.y - player.pos.y;
      const bombAngle = Math.atan2(bombDy, bombDx);
      const throwX = player.pos.x + Math.cos(bombAngle) * BOMB_THROW_DISTANCE;
      const throwY = player.pos.y + Math.sin(bombAngle) * BOMB_THROW_DISTANCE;

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

        // Elevation check: Melee attacks only hit players on the same level
        if (target.elevation !== player.elevation) return;

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

              // Knockback - apply velocity for smooth knockback
              const knockDir = normalize({ x: target.pos.x - player.pos.x, y: target.pos.y - player.pos.y });
              target.vel.x += knockDir.x * SWORD_KNOCKBACK_SPEED;
              target.vel.y += knockDir.y * SWORD_KNOCKBACK_SPEED;

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

    // Dodge - only in movement direction (WASD), not mouse direction
    if (keySet.has(' ') && !player.isDodging && player.cooldown <= 0 && !player.isBlocking) {
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

        for (let i = 0; i < 5; i++) newParticles.push(createParticle(player.pos, COLORS.playerDodge, 3));
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

      // Terrain speed modifier
      if (state.tileMap) {
        speed *= getTerrainSpeedModifier(state.tileMap, player.pos);
      }

      player.vel = { x: moveDir.x * speed, y: moveDir.y * speed };
    }

    // Apply friction to knockback (smooth deceleration)
    if (!player.isDodging && !player.isBlocking) {
      player.vel.x *= KNOCKBACK_FRICTION;
      player.vel.y *= KNOCKBACK_FRICTION;
      // Stop very small velocities
      if (Math.abs(player.vel.x) < 10) player.vel.x = 0;
      if (Math.abs(player.vel.y) < 10) player.vel.y = 0;
    }

    const oldX = player.pos.x;
    const oldY = player.pos.y;

    player.pos.x += player.vel.x * DT;
    player.pos.y += player.vel.y * DT;

    // Elevation checking (Stairs logic)
    // Run this BEFORE wall collision so that if we change elevation, we use the new elevation's collision rules.
    if (state.tileMap) {
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
        const tile = getTileAt(state.tileMap, p.x, p.y);
        if (tile === TILE_STAIRS) {
          onStairs = true;
          break;
        }
      }

      if (onStairs) {
        if (player.vel.y < 0 && player.elevation === 0) {
          player.elevation = 1; // Moving UP (into house)
        } else if (player.vel.y > 0 && player.elevation === 1) {
          player.elevation = 0; // Moving DOWN (towards street)
        }
      }
    }

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
