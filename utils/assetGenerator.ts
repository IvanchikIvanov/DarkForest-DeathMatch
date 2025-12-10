
import { COLORS } from '../constants';

export interface GameAssets {
  player: HTMLImageElement;
  sword: HTMLImageElement;
  shield: HTMLImageElement;
  floor: HTMLCanvasElement;
}

// 0: Transparent
const PALETTE = {
  player: { 1: '#3b82f6', 2: '#1d4ed8', 3: '#60a5fa', 4: '#1e293b' }, // Blue Knight
  sword: { 1: '#e4e4e7', 2: '#a1a1aa', 3: '#ffffff', 4: '#52525b' }, // Steel
  shield: { 1: '#d97706', 2: '#92400e', 3: '#fbbf24', 4: '#451a03' }  // Wood/Gold
};

// 12x12 Pixel Grids
const SPRITES = {
  player: [
    [0,0,0,0,1,1,1,1,0,0,0,0], // Helmet Top
    [0,0,0,1,1,1,1,1,1,0,0,0],
    [0,0,1,1,1,3,3,1,1,1,0,0],
    [0,0,1,4,4,4,4,4,4,1,0,0], // Visor
    [0,0,1,4,4,4,4,4,4,1,0,0],
    [0,0,1,1,1,1,1,1,1,1,0,0],
    [0,0,0,2,2,2,2,2,2,0,0,0], // Neck
    [0,0,2,2,1,1,1,1,2,2,0,0], // Shoulders
    [0,0,2,1,1,1,1,1,1,2,0,0],
    [0,0,2,1,1,1,1,1,1,2,0,0],
    [0,0,0,2,2,0,0,2,2,0,0,0],
    [0,0,0,0,0,0,0,0,0,0,0,0],
  ],
  sword: [
    [0,0,0,0,0,0,0,0,0,3,1,2], // Curved tip (right side)
    [0,0,0,0,0,0,0,0,3,1,2,0],
    [0,0,0,0,0,0,0,3,1,2,0,0],
    [0,0,0,0,0,0,3,1,2,0,0,0], // Curved blade
    [0,0,0,0,0,3,1,2,0,0,0,0],
    [0,0,0,0,3,1,2,0,0,0,0,0],
    [0,0,0,3,1,2,0,0,0,0,0,0],
    [0,0,1,2,0,0,0,0,0,0,0,0], // Curved section
    [0,4,4,4,0,0,0,0,0,0,0,0], // Guard
    [4,1,1,1,4,0,0,0,0,0,0,0],
    [0,0,4,0,0,0,0,0,0,0,0,0], // Hilt
    [0,0,4,0,0,0,0,0,0,0,0,0],
  ],
  shield: [
    [0,0,0,0,1,1,1,1,0,0,0,0],
    [0,0,1,1,1,1,1,1,1,1,0,0],
    [0,1,1,1,3,3,3,3,1,1,1,0],
    [0,1,1,3,1,1,1,1,3,1,1,0],
    [1,1,3,1,1,4,4,1,1,3,1,1],
    [1,1,3,1,4,2,2,4,1,3,1,1],
    [1,1,3,1,4,2,2,4,1,3,1,1],
    [1,1,3,1,1,4,4,1,1,3,1,1],
    [0,1,1,3,1,1,1,1,3,1,1,0],
    [0,0,1,1,3,3,3,3,1,1,0,0],
    [0,0,0,1,1,1,1,1,1,0,0,0],
    [0,0,0,0,1,1,1,1,0,0,0,0],
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

    // Stone Tiles
    ctx.fillStyle = '#27272a'; 
    ctx.fillRect(0,0,64,64);
    
    ctx.strokeStyle = '#18181b';
    ctx.lineWidth = 3;
    ctx.strokeRect(0,0,32,32);
    ctx.strokeRect(32,0,32,32);
    ctx.strokeRect(0,32,32,32);
    ctx.strokeRect(32,32,32,32);

    // Texture
    ctx.fillStyle = '#000';
    for(let i=0; i<10; i++) {
        ctx.globalAlpha = 0.1;
        ctx.fillRect(Math.random()*64, Math.random()*64, 4, 4);
    }
    ctx.globalAlpha = 1;

    return canvas;
};

export const generateAssets = async (): Promise<GameAssets> => {
    const [player, sword, shield] = await Promise.all([
        renderToImage(SPRITES.player, PALETTE.player, 4),
        renderToImage(SPRITES.sword, PALETTE.sword, 4), // Scale 4 = 48x48
        renderToImage(SPRITES.shield, PALETTE.shield, 4)
    ]);
    
    return {
        player,
        sword,
        shield,
        floor: createFloorPattern()
    };
};
