
import { GameState, Player, EntityType, Vector2, PlayerInput, Particle, Wall } from '../types';
import { 
  CANVAS_WIDTH, CANVAS_HEIGHT, DT, COLORS, PLAYER_HP, 
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

// --- Maze Generation ---
const generateMaze = (): Wall[] => {
  const walls: Wall[] = [];
  const wallThickness = 40;
  const cellSize = 200;
  const cols = Math.floor(CANVAS_WIDTH / cellSize);
  const rows = Math.floor(CANVAS_HEIGHT / cellSize);
  
  // Outer walls
  walls.push({
    id: 'wall-top',
    type: EntityType.WALL,
    pos: { x: CANVAS_WIDTH / 2, y: wallThickness / 2 },
    vel: { x: 0, y: 0 },
    radius: 0,
    color: COLORS.wall,
    active: true,
    width: CANVAS_WIDTH,
    height: wallThickness
  });
  walls.push({
    id: 'wall-bottom',
    type: EntityType.WALL,
    pos: { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT - wallThickness / 2 },
    vel: { x: 0, y: 0 },
    radius: 0,
    color: COLORS.wall,
    active: true,
    width: CANVAS_WIDTH,
    height: wallThickness
  });
  walls.push({
    id: 'wall-left',
    type: EntityType.WALL,
    pos: { x: wallThickness / 2, y: CANVAS_HEIGHT / 2 },
    vel: { x: 0, y: 0 },
    radius: 0,
    color: COLORS.wall,
    active: true,
    width: wallThickness,
    height: CANVAS_HEIGHT
  });
  walls.push({
    id: 'wall-right',
    type: EntityType.WALL,
    pos: { x: CANVAS_WIDTH - wallThickness / 2, y: CANVAS_HEIGHT / 2 },
    vel: { x: 0, y: 0 },
    radius: 0,
    color: COLORS.wall,
    active: true,
    width: wallThickness,
    height: CANVAS_HEIGHT
  });
  
  // Inner maze walls - create a grid pattern with gaps
  for (let row = 1; row < rows - 1; row++) {
    for (let col = 1; col < cols - 1; col++) {
      // Skip some cells to create passages
      if (Math.random() > 0.3) continue;
      
      // Randomly create horizontal or vertical walls
      if (Math.random() > 0.5) {
        // Horizontal wall
        walls.push({
          id: `wall-h-${row}-${col}`,
          type: EntityType.WALL,
          pos: { x: col * cellSize, y: row * cellSize },
          vel: { x: 0, y: 0 },
          radius: 0,
          color: COLORS.wall,
          active: true,
          width: cellSize * 0.8,
          height: wallThickness
        });
      } else {
        // Vertical wall
        walls.push({
          id: `wall-v-${row}-${col}`,
          type: EntityType.WALL,
          pos: { x: col * cellSize, y: row * cellSize },
          vel: { x: 0, y: 0 },
          radius: 0,
          color: COLORS.wall,
          active: true,
          width: wallThickness,
          height: cellSize * 0.8
        });
      }
    }
  }
  
  return walls;
};

// --- Collision Detection ---
const checkWallCollision = (player: Player, walls: Wall[]): boolean => {
  for (const wall of walls) {
    if (!wall.active) continue;
    
    const wallLeft = wall.pos.x - wall.width / 2;
    const wallRight = wall.pos.x + wall.width / 2;
    const wallTop = wall.pos.y - wall.height / 2;
    const wallBottom = wall.pos.y + wall.height / 2;
    
    const playerLeft = player.pos.x - player.radius;
    const playerRight = player.pos.x + player.radius;
    const playerTop = player.pos.y - player.radius;
    const playerBottom = player.pos.y + player.radius;
    
    if (playerRight > wallLeft && playerLeft < wallRight &&
        playerBottom > wallTop && playerTop < wallBottom) {
      return true;
    }
  }
  return false;
};

// --- Initialization ---
export const createInitialState = (): GameState => ({
  status: 'MENU',
  shake: 0,
  players: {}, 
  particles: [],
  walls: generateMaze(),
});

export const createPlayer = (id: string, index: number): Player => ({
  id: `p-${id}`,
  playerId: id,
  type: EntityType.PLAYER,
  pos: { 
      x: CANVAS_WIDTH / 2 + (index === 0 ? -150 : 150), 
      y: CANVAS_HEIGHT / 2 
  },
  vel: { x: 0, y: 0 },
  radius: 16,
  color: index === 0 ? COLORS.player : COLORS.enemy,
  active: true,
  hp: PLAYER_HP,
  maxHp: PLAYER_HP,
  isDodging: false,
  dodgeTimer: 0,
  cooldown: 0, // Dodge CD
  angle: index === 0 ? 0 : Math.PI, // Face each other
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
    const targetAngle = Math.atan2(dy, dx);
    player.angle = targetAngle; // Instant turn

    // --- Actions ---
    // Shield (Right Mouse Button)
    player.isBlocking = input.mouseRightDown && !player.isAttacking && !player.isDodging;

    // Attack (Left Click)
    if (input.mouseDown && player.attackCooldown <= 0 && !player.isDodging && !player.isBlocking) {
        player.isAttacking = true;
        player.attackTimer = SWORD_ATTACK_DURATION;
        player.attackCooldown = SWORD_COOLDOWN;
        
        // Attack Logic: Check Hits
        playerIds.forEach(targetId => {
            if (targetId === pid) return;
            const target = state.players[targetId];
            if (!target.active) return;

            const d = dist(player.pos, target.pos);
            if (d < SWORD_RANGE) {
                const angleToTarget = Math.atan2(target.pos.y - player.pos.y, target.pos.x - player.pos.x);
                const aDiff = angleDiff(player.angle || 0, angleToTarget);
                
                // Check Arc
                if (aDiff < SWORD_ARC / 2) {
                    // HIT! Check block
                    let blocked = false;
                    if (target.isBlocking) {
                        // To block, target must face attacker (angle difference approx PI)
                        const angleToAttacker = Math.atan2(player.pos.y - target.pos.y, player.pos.x - target.pos.x);
                        const blockDiff = angleDiff(target.angle || 0, angleToAttacker);
                        if (blockDiff < SHIELD_BLOCK_ANGLE / 2) {
                            blocked = true;
                        }
                    }

                    if (blocked) {
                        // Block Effect
                        newShake += 5;
                        for(let i=0; i<5; i++) newParticles.push(createParticle(target.pos, COLORS.shield, 4));
                        // Pushback
                        const pushDir = normalize({ x: target.pos.x - player.pos.x, y: target.pos.y - player.pos.y });
                        target.pos.x += pushDir.x * 20;
                        target.pos.y += pushDir.y * 20;
                    } else if (!target.isDodging && target.hp > 0) {
                        // Deal damage
                        target.hp = Math.max(0, target.hp - SWORD_DAMAGE);
                        newShake += 10;
                        for(let i=0; i<10; i++) newParticles.push(createParticle(target.pos, COLORS.blood, 6));
                        
                        // Check if dead
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

    // Dodge (Spacebar)
    if (keySet.has(' ') && !player.isDodging && player.cooldown <= 0 && !player.isBlocking) {
        player.isDodging = true;
        player.dodgeTimer = PLAYER_DODGE_DURATION;
        player.cooldown = PLAYER_DODGE_COOLDOWN;
        
        // Dash in movement dir, or cursor dir if standing still
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
        
        // Particle Trail
        for(let i=0; i<3; i++) newParticles.push(createParticle(player.pos, COLORS.playerDodge, 2));
    }

    // Movement
    if (player.isDodging) {
        player.dodgeTimer -= DT;
        if (player.dodgeTimer <= 0) {
            player.isDodging = false;
            player.vel = { x: 0, y: 0 };
        }
    } else {
        // Normal Move
        let moveDir = { x: 0, y: 0 };
        if (keySet.has('w')) moveDir.y -= 1;
        if (keySet.has('s')) moveDir.y += 1;
        if (keySet.has('a')) moveDir.x -= 1;
        if (keySet.has('d')) moveDir.x += 1;
        moveDir = normalize(moveDir);

        let speed = PLAYER_SPEED;
        if (player.isBlocking) speed *= PLAYER_BLOCK_SPEED_MOD;
        if (player.isAttacking) speed *= 0.2; // Slow when swinging

        player.vel = { x: moveDir.x * speed, y: moveDir.y * speed };
    }

    // Apply Position with wall collision
    const oldX = player.pos.x;
    const oldY = player.pos.y;
    
    player.pos.x += player.vel.x * DT;
    player.pos.y += player.vel.y * DT;
    
    // Check wall collision
    if (checkWallCollision(player, state.walls)) {
      player.pos.x = oldX;
      player.pos.y = oldY;
    }
    
    // Keep within bounds
    player.pos.x = clamp(player.pos.x, player.radius, CANVAS_WIDTH - player.radius);
    player.pos.y = clamp(player.pos.y, player.radius, CANVAS_HEIGHT - player.radius);
  });

  // --- Particles ---
  newParticles.forEach(p => {
    p.pos.x += p.vel.x * DT;
    p.pos.y += p.vel.y * DT;
    p.life -= DT * p.decay;
  });
  newParticles = newParticles.filter(p => p.life > 0);

  // --- Win Condition ---
  // If > 1 player started, and only 1 remains
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
