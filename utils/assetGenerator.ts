
import { COLORS } from '../constants';

export interface GameAssets {
  player: HTMLImageElement;
  playerEnemy: HTMLImageElement;
  sword: HTMLImageElement;
  shield: HTMLImageElement;
  floor: HTMLCanvasElement;
  tiles: HTMLCanvasElement[];
  bomb: HTMLImageElement;
  tree: HTMLImageElement;
  rock: HTMLImageElement;
  bush: HTMLImageElement;
}

// Enhanced color palettes
const PALETTE = {
  playerBlue: {
    1: '#3b82f6', // Primary blue
    2: '#1d4ed8', // Dark blue
    3: '#60a5fa', // Light blue highlight
    4: '#1e293b', // Visor dark
    5: '#93c5fd', // Very light blue
    6: '#0f172a', // Shadow
    7: '#ffffff', // White highlight
  },
  playerRed: {
    1: '#ef4444', // Primary red
    2: '#b91c1c', // Dark red
    3: '#f87171', // Light red highlight
    4: '#1e293b', // Visor dark
    5: '#fca5a5', // Very light red
    6: '#0f172a', // Shadow
    7: '#ffffff', // White highlight
  },
  sword: {
    1: '#e4e4e7', // Steel primary
    2: '#a1a1aa', // Steel shadow
    3: '#ffffff', // Steel highlight
    4: '#52525b', // Hilt dark
    5: '#fbbf24', // Gold guard
    6: '#92400e', // Gold shadow
  },
  shield: {
    1: '#d97706', // Gold primary
    2: '#92400e', // Gold shadow
    3: '#fbbf24', // Gold highlight
    4: '#451a03', // Dark brown
    5: '#78716c', // Metal accent
  },
  bomb: {
    1: '#27272a', // Body dark
    2: '#3f3f46', // Body medium
    3: '#52525b', // Body light
    4: '#f97316', // Fuse orange
    5: '#fbbf24', // Spark yellow
    6: '#ef4444', // Spark red
  },
  tree: {
    1: '#15803d', // Leaves dark
    2: '#22c55e', // Leaves medium
    3: '#4ade80', // Leaves light
    4: '#92400e', // Trunk dark
    5: '#a16207', // Trunk medium
  },
  rock: {
    1: '#57534e', // Dark gray
    2: '#78716c', // Medium gray
    3: '#a8a29e', // Light gray
    4: '#44403c', // Shadow
  },
  bushObstacle: {
    1: '#14532d', // Dark green
    2: '#15803d', // Medium green
    3: '#22c55e', // Light green
    4: '#166534', // Accent
  },
  tiles: {
    floor: { 1: '#27272a', 2: '#18181b', 3: '#3f3f46' },
    wall: { 1: '#52525b', 2: '#3f3f46', 3: '#71717a', 4: '#18181b' },
    wallTop: { 1: '#71717a', 2: '#52525b', 3: '#a1a1aa' },
    grass: { 1: '#15803d', 2: '#166534', 3: '#22c55e', 4: '#14532d' },
    water: { 1: '#1d4ed8', 2: '#1e40af', 3: '#3b82f6', 4: '#60a5fa' },
    bush: { 1: '#14532d', 2: '#15803d', 3: '#22c55e', 4: '#166534' },
    stone: { 1: '#57534e', 2: '#44403c', 3: '#78716c', 4: '#292524' },
  }
};

// Enhanced 16x16 Pixel Grids for better detail
const SPRITES = {
  player: [
    [0,0,0,0,0,1,1,1,1,1,1,0,0,0,0,0], // Helmet top
    [0,0,0,0,1,1,3,3,3,3,1,1,0,0,0,0],
    [0,0,0,1,1,3,1,1,1,1,3,1,1,0,0,0],
    [0,0,0,1,3,1,1,1,1,1,1,3,1,0,0,0],
    [0,0,1,1,4,4,4,4,4,4,4,4,1,1,0,0], // Visor
    [0,0,1,4,6,4,4,4,4,4,4,6,4,1,0,0],
    [0,0,1,4,4,4,4,4,4,4,4,4,4,1,0,0],
    [0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,0],
    [0,0,0,2,2,2,1,1,1,1,2,2,2,0,0,0], // Neck guard
    [0,0,2,2,1,1,1,1,1,1,1,1,2,2,0,0], // Shoulders
    [0,2,2,1,1,1,3,3,3,3,1,1,1,2,2,0],
    [0,2,1,1,1,1,1,1,1,1,1,1,1,1,2,0],
    [0,2,1,1,1,1,1,1,1,1,1,1,1,1,2,0],
    [0,0,2,1,1,1,1,1,1,1,1,1,1,2,0,0],
    [0,0,0,2,2,2,0,0,0,0,2,2,2,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  ],
  sword: [
    [0,0,0,0,0,0,0,0,0,0,0,0,3,1,1,2],
    [0,0,0,0,0,0,0,0,0,0,0,3,1,1,2,0],
    [0,0,0,0,0,0,0,0,0,0,3,1,1,2,0,0],
    [0,0,0,0,0,0,0,0,0,3,1,1,2,0,0,0],
    [0,0,0,0,0,0,0,0,3,1,1,2,0,0,0,0],
    [0,0,0,0,0,0,0,3,1,1,2,0,0,0,0,0],
    [0,0,0,0,0,0,3,1,1,2,0,0,0,0,0,0],
    [0,0,0,0,0,3,1,1,2,0,0,0,0,0,0,0],
    [0,0,0,0,3,1,1,2,0,0,0,0,0,0,0,0],
    [0,0,0,3,1,1,2,0,0,0,0,0,0,0,0,0],
    [0,0,5,5,1,2,0,0,0,0,0,0,0,0,0,0], // Guard
    [0,5,6,5,5,5,0,0,0,0,0,0,0,0,0,0],
    [0,0,4,4,4,0,0,0,0,0,0,0,0,0,0,0], // Hilt
    [0,0,4,4,4,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,4,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,4,0,0,0,0,0,0,0,0,0,0,0,0],
  ],
  shield: [
    [0,0,0,0,0,1,1,1,1,1,1,0,0,0,0,0],
    [0,0,0,1,1,1,3,3,3,3,1,1,1,0,0,0],
    [0,0,1,1,3,3,3,3,3,3,3,3,1,1,0,0],
    [0,1,1,3,3,1,1,1,1,1,1,3,3,1,1,0],
    [0,1,3,3,1,1,5,5,5,5,1,1,3,3,1,0],
    [1,1,3,1,1,5,2,2,2,2,5,1,1,3,1,1],
    [1,3,3,1,5,2,4,4,4,4,2,5,1,3,3,1],
    [1,3,3,1,5,2,4,3,3,4,2,5,1,3,3,1],
    [1,3,3,1,5,2,4,3,3,4,2,5,1,3,3,1],
    [1,3,3,1,5,2,4,4,4,4,2,5,1,3,3,1],
    [1,1,3,1,1,5,2,2,2,2,5,1,1,3,1,1],
    [0,1,3,3,1,1,5,5,5,5,1,1,3,3,1,0],
    [0,1,1,3,3,1,1,1,1,1,1,3,3,1,1,0],
    [0,0,1,1,3,3,3,3,3,3,3,3,1,1,0,0],
    [0,0,0,1,1,1,3,3,3,3,1,1,1,0,0,0],
    [0,0,0,0,0,1,1,1,1,1,1,0,0,0,0,0],
  ],
  bomb: [
    [0,0,0,0,0,0,5,6,5,0,0,0,0,0,0,0], // Spark
    [0,0,0,0,0,0,4,5,4,0,0,0,0,0,0,0], // Fuse top
    [0,0,0,0,0,0,4,4,4,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,2,4,2,0,0,0,0,0,0,0],
    [0,0,0,0,0,1,1,2,1,1,0,0,0,0,0,0],
    [0,0,0,0,1,1,2,2,2,1,1,0,0,0,0,0],
    [0,0,0,1,1,2,2,3,2,2,1,1,0,0,0,0],
    [0,0,1,1,2,2,3,3,3,2,2,1,1,0,0,0],
    [0,0,1,2,2,3,3,3,3,3,2,2,1,0,0,0],
    [0,1,1,2,2,3,3,3,3,3,2,2,1,1,0,0],
    [0,1,2,2,2,3,3,3,3,3,2,2,2,1,0,0],
    [0,1,1,2,2,2,3,3,3,2,2,2,1,1,0,0],
    [0,0,1,1,2,2,2,2,2,2,2,1,1,0,0,0],
    [0,0,0,1,1,1,2,2,2,1,1,1,0,0,0,0],
    [0,0,0,0,0,1,1,1,1,1,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  ],
  tree: [
    [0,0,0,0,0,0,2,3,3,2,0,0,0,0,0,0],
    [0,0,0,0,0,2,2,3,3,2,2,0,0,0,0,0],
    [0,0,0,0,1,2,2,3,3,2,2,1,0,0,0,0],
    [0,0,0,1,1,2,2,3,3,2,2,1,1,0,0,0],
    [0,0,1,1,1,2,2,3,3,2,2,1,1,1,0,0],
    [0,1,1,1,1,2,2,3,3,2,2,1,1,1,1,0],
    [1,1,1,1,1,2,2,2,2,2,2,1,1,1,1,1],
    [0,1,1,1,1,1,2,2,2,2,1,1,1,1,1,0],
    [0,0,1,1,1,1,1,2,2,1,1,1,1,1,0,0],
    [0,0,0,1,1,1,1,2,2,1,1,1,1,0,0,0],
    [0,0,0,0,0,0,4,4,4,4,0,0,0,0,0,0], // Trunk
    [0,0,0,0,0,0,4,5,5,4,0,0,0,0,0,0],
    [0,0,0,0,0,0,4,5,5,4,0,0,0,0,0,0],
    [0,0,0,0,0,0,4,5,5,4,0,0,0,0,0,0],
    [0,0,0,0,0,4,4,5,5,4,4,0,0,0,0,0],
    [0,0,0,0,4,4,4,4,4,4,4,4,0,0,0,0],
  ],
  rock: [
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,3,3,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,3,3,3,3,0,0,0,0,0,0],
    [0,0,0,0,0,3,3,2,2,3,3,0,0,0,0,0],
    [0,0,0,0,3,3,2,2,2,2,3,3,0,0,0,0],
    [0,0,0,3,3,2,2,2,2,2,2,3,3,0,0,0],
    [0,0,2,3,2,2,2,1,1,2,2,2,3,2,0,0],
    [0,2,2,2,2,2,1,1,1,1,2,2,2,2,2,0],
    [0,2,2,2,2,1,1,1,1,1,1,2,2,2,2,0],
    [2,2,2,2,1,1,1,4,4,1,1,1,2,2,2,2],
    [2,2,2,1,1,1,4,4,4,4,1,1,1,2,2,2],
    [0,2,1,1,1,4,4,4,4,4,4,1,1,1,2,0],
    [0,0,1,1,4,4,4,4,4,4,4,4,1,1,0,0],
    [0,0,0,4,4,4,4,4,4,4,4,4,4,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  ],
  bushObstacle: [
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,3,3,3,3,0,0,0,0,0,0],
    [0,0,0,0,0,3,3,3,3,3,3,0,0,0,0,0],
    [0,0,0,0,3,2,3,3,3,3,2,3,0,0,0,0],
    [0,0,0,3,2,2,2,3,3,2,2,2,3,0,0,0],
    [0,0,3,2,2,1,2,2,2,2,1,2,2,3,0,0],
    [0,3,2,2,1,1,1,2,2,1,1,1,2,2,3,0],
    [0,3,2,1,1,1,1,1,1,1,1,1,1,2,3,0],
    [3,2,2,1,1,4,1,1,1,1,4,1,1,2,2,3],
    [3,2,1,1,1,1,1,1,1,1,1,1,1,1,2,3],
    [0,2,2,1,1,1,1,1,1,1,1,1,1,2,2,0],
    [0,0,2,2,1,1,1,1,1,1,1,1,2,2,0,0],
    [0,0,0,2,2,2,1,1,1,1,2,2,2,0,0,0],
    [0,0,0,0,2,2,2,2,2,2,2,2,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  ]
};

const createValuesMap = (palette: any) => (val: number) => palette[val] || null;

const renderToImage = (grid: number[][], palette: any, scale: number = 4): Promise<HTMLImageElement> => {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const size = grid.length;
    canvas.width = size * scale;
    canvas.height = size * scale;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      ctx.imageSmoothingEnabled = false;
      const getColor = createValuesMap(palette);
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const color = getColor(grid[y][x]);
          if (color) {
            ctx.fillStyle = color;
            ctx.fillRect(x * scale, y * scale, scale, scale);
          }
        }
      }
    }
    const img = new Image();
    img.src = canvas.toDataURL();
    img.onload = () => resolve(img);
  });
};

const createFloorPattern = (): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.fillStyle = '#27272a';
  ctx.fillRect(0, 0, 64, 64);

  ctx.strokeStyle = '#18181b';
  ctx.lineWidth = 3;
  ctx.strokeRect(0, 0, 32, 32);
  ctx.strokeRect(32, 0, 32, 32);
  ctx.strokeRect(0, 32, 32, 32);
  ctx.strokeRect(32, 32, 32, 32);

  ctx.fillStyle = '#000';
  for (let i = 0; i < 10; i++) {
    ctx.globalAlpha = 0.1;
    ctx.fillRect(Math.random() * 64, Math.random() * 64, 4, 4);
  }
  ctx.globalAlpha = 1;

  return canvas;
};

const createTile = (type: 'floor' | 'wall' | 'wallTop' | 'grass' | 'water' | 'bush' | 'stone'): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const p = (PALETTE.tiles as any)[type];

  if (type === 'floor') {
    ctx.fillStyle = p[1];
    ctx.fillRect(0, 0, 64, 64);
    ctx.strokeStyle = p[2];
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, 62, 62);
    ctx.fillStyle = p[3];
    for (let i = 0; i < 8; i++) {
      ctx.fillRect(Math.random() * 60, Math.random() * 60, 2, 2);
    }
  } else if (type === 'wall') {
    ctx.fillStyle = p[2];
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = p[1];
    ctx.fillRect(4, 4, 56, 24);
    ctx.fillRect(4, 34, 26, 24);
    ctx.fillRect(34, 34, 26, 24);
    ctx.fillStyle = p[3];
    ctx.fillRect(4, 4, 56, 2);
    ctx.fillRect(4, 34, 26, 2);
    ctx.fillRect(34, 34, 26, 2);
    ctx.fillStyle = p[4];
    ctx.fillRect(4, 26, 56, 2);
  } else if (type === 'wallTop') {
    ctx.fillStyle = p[2];
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = p[1];
    ctx.fillRect(4, 4, 56, 56);
    ctx.strokeStyle = p[3];
    ctx.lineWidth = 4;
    ctx.strokeRect(8, 8, 48, 48);
  } else if (type === 'grass') {
    // Base grass color
    ctx.fillStyle = p[1];
    ctx.fillRect(0, 0, 64, 64);
    // Grass texture - scattered blades
    ctx.fillStyle = p[3];
    for (let i = 0; i < 30; i++) {
      const x = Math.random() * 64;
      const y = Math.random() * 64;
      ctx.fillRect(x, y, 2, 4);
    }
    ctx.fillStyle = p[2];
    for (let i = 0; i < 15; i++) {
      const x = Math.random() * 64;
      const y = Math.random() * 64;
      ctx.fillRect(x, y, 3, 5);
    }
    // Dark spots
    ctx.fillStyle = p[4];
    for (let i = 0; i < 5; i++) {
      ctx.fillRect(Math.random() * 60, Math.random() * 60, 4, 4);
    }
  } else if (type === 'water') {
    // Base water
    ctx.fillStyle = p[1];
    ctx.fillRect(0, 0, 64, 64);
    // Wave patterns
    ctx.fillStyle = p[3];
    for (let i = 0; i < 6; i++) {
      const y = 8 + i * 10;
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x < 64; x += 8) {
        ctx.quadraticCurveTo(x + 4, y - 3, x + 8, y);
      }
      ctx.lineTo(64, y + 2);
      ctx.lineTo(0, y + 2);
      ctx.fill();
    }
    // Highlights
    ctx.fillStyle = p[4];
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < 8; i++) {
      ctx.fillRect(Math.random() * 60, Math.random() * 60, 6, 2);
    }
    ctx.globalAlpha = 1;
  } else if (type === 'bush') {
    // Base with grass underneath
    ctx.fillStyle = '#15803d';
    ctx.fillRect(0, 0, 64, 64);
    // Bush clusters
    ctx.fillStyle = p[2];
    for (let i = 0; i < 12; i++) {
      const x = Math.random() * 56 + 4;
      const y = Math.random() * 56 + 4;
      ctx.beginPath();
      ctx.arc(x, y, 8 + Math.random() * 6, 0, Math.PI * 2);
      ctx.fill();
    }
    // Highlights
    ctx.fillStyle = p[3];
    for (let i = 0; i < 20; i++) {
      const x = Math.random() * 60;
      const y = Math.random() * 60;
      ctx.fillRect(x, y, 3, 3);
    }
    // Dark spots
    ctx.fillStyle = p[1];
    for (let i = 0; i < 8; i++) {
      ctx.fillRect(Math.random() * 60, Math.random() * 60, 4, 4);
    }
  } else if (type === 'stone') {
    // Stone/rock base
    ctx.fillStyle = p[2];
    ctx.fillRect(0, 0, 64, 64);
    // Large stone pattern
    ctx.fillStyle = p[1];
    ctx.beginPath();
    ctx.moveTo(0, 32);
    ctx.lineTo(20, 0);
    ctx.lineTo(64, 0);
    ctx.lineTo(64, 32);
    ctx.lineTo(44, 64);
    ctx.lineTo(0, 64);
    ctx.fill();
    // Highlights
    ctx.fillStyle = p[3];
    ctx.fillRect(10, 10, 20, 8);
    ctx.fillRect(40, 35, 15, 6);
    // Cracks
    ctx.strokeStyle = p[4];
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(30, 0);
    ctx.lineTo(35, 30);
    ctx.lineTo(25, 64);
    ctx.stroke();
  }

  return canvas;
};

export const generateAssets = async (): Promise<GameAssets> => {
  const [player, playerEnemy, sword, shield, bomb, tree, rock, bush] = await Promise.all([
    renderToImage(SPRITES.player, PALETTE.playerBlue, 4),
    renderToImage(SPRITES.player, PALETTE.playerRed, 4),
    renderToImage(SPRITES.sword, PALETTE.sword, 4),
    renderToImage(SPRITES.shield, PALETTE.shield, 4),
    renderToImage(SPRITES.bomb, PALETTE.bomb, 4),
    renderToImage(SPRITES.tree, PALETTE.tree, 4),
    renderToImage(SPRITES.rock, PALETTE.rock, 4),
    renderToImage(SPRITES.bushObstacle, PALETTE.bushObstacle, 4)
  ]);

  return {
    player,
    playerEnemy,
    sword,
    shield,
    floor: createFloorPattern(),
    tiles: [
      createTile('floor'),    // 0
      createTile('wall'),     // 1
      createTile('wallTop'),  // 2
      createTile('grass'),    // 3
      createTile('water'),    // 4
      createTile('bush'),     // 5
      createTile('stone')     // 6
    ],
    bomb,
    tree,
    rock,
    bush
  };
};
