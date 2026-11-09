import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import {defineConfig, type Plugin} from 'vite';
import {databaseApi} from './server/database';

const localDatabaseApi = (): Plugin => ({
  name: 'fnd-local-sqlite-api',
  configureServer(server) {
    server.middlewares.use('/api', databaseApi);
  },
});

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), localDatabaseApi()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      host: '127.0.0.1',
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
