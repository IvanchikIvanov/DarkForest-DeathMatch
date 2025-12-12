import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'import.meta.env.VITE_PARTYKIT_HOST': JSON.stringify(env.VITE_PARTYKIT_HOST || 'localhost:1999'),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        rollupOptions: {
          external: (id) => {
            // Игнорируем отсутствующий файл артефактов Hardhat
            if (id.includes('artifacts/contracts/DuelArena.sol/DuelArena.json')) {
              return false; // Не делаем external, но обработаем ошибку
            }
            return false;
          },
          onwarn(warning, warn) {
            // Игнорируем предупреждения о неразрешенных импортах для опциональных файлов
            if (warning.code === 'UNRESOLVED_IMPORT' && warning.id?.includes('DuelArena.json')) {
              return;
            }
            warn(warning);
          }
        }
      }
    };
});
