import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { setupApi } from './server/setup-api';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'MC_');

  if (!env.MC_REPO_PATH) {
    console.error('[mission-control] MC_REPO_PATH is not set. Copy .env.example to .env.');
    process.exit(1);
  }

  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'mission-control-api',
        configureServer(server) {
          setupApi(server.middlewares, env);
        },
      },
    ],
    server: { port: 5173, strictPort: true },
  };
});
