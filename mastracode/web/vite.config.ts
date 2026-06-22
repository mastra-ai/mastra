import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const here = dirname(fileURLToPath(import.meta.url));

/**
 * Vite config for the MastraCode web UI.
 *
 * In dev, `pnpm web:dev` runs `mastracode web` (the API server on :4111) and
 * Vite (:5173) side by side; `/api` is proxied to the server so the browser
 * uses same-origin streaming requests without CORS.
 *
 * The production build outputs to `dist/web`, which `mastracode web` serves
 * as static files alongside the harness routes.
 */
export default defineConfig({
  root: resolve(here, 'ui'),
  plugins: [react()],
  build: {
    outDir: resolve(here, '../dist/web'),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:4111',
        changeOrigin: true,
      },
    },
  },
});
