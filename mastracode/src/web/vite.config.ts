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
 * The production build outputs to `dist/web/ui`, which `mastracode web` serves
 * as static files alongside the controller routes. It lives in its own `ui`
 * subdirectory so the Vite build (emptyOutDir) doesn't clobber the compiled
 * server entry that tsup emits at `dist/web/server.js`.
 */
export default defineConfig({
  root: resolve(here, 'ui'),
  plugins: [react()],
  build: {
    outDir: resolve(here, '../../dist/web/ui'),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:4111',
        changeOrigin: true,
      },
      // Optional WorkOS auth routes live on the API server too; proxy them so
      // the dev UI (:5173) can reach login/callback/logout/me on :4111.
      //
      // Match only the `/auth/<route>` paths — NOT a bare `/auth` prefix.
      // A plain `'/auth'` key prefix-matches Vite module requests like
      // `/auth.ts` (the client auth module) and wrongly proxies them to the
      // API server, which 401s / ECONNREFUSEs. The trailing-slash regex keeps
      // module imports on Vite while still forwarding real auth routes.
      '^/auth/': {
        target: 'http://localhost:4111',
        changeOrigin: true,
      },
    },
  },
});
