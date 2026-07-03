import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import type { Plugin } from 'vite';

const here = dirname(fileURLToPath(import.meta.url));

/**
 * Dev-only equivalent of the server-side `injectRuntimeConfig` (html-config.ts):
 * in dev, Vite serves index.html instead of the Mastra server, so this plugin
 * injects `window.__MASTRACODE_CONFIG__` from the same WORKOS env vars the
 * server reads (`isWebAuthEnabled()` in auth.ts). `web:dev` only passes
 * `src/web/.env` to tsx, so the plugin loads that file itself via `loadEnv`.
 * Production builds are untouched (`apply: 'serve'`) — the server injects the
 * flag at runtime there.
 */
function runtimeConfigPlugin(mode: string): Plugin {
  return {
    name: 'mastracode-runtime-config',
    apply: 'serve',
    transformIndexHtml() {
      const env = { ...loadEnv(mode, here, ''), ...process.env };
      const authEnabled = Boolean(env.WORKOS_API_KEY && env.WORKOS_CLIENT_ID);
      return [
        {
          tag: 'script',
          children: `window.__MASTRACODE_CONFIG__ = ${JSON.stringify({ authEnabled })};`,
          injectTo: 'head-prepend',
        },
      ];
    },
  };
}

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
export default defineConfig(({ mode }) => ({
  root: resolve(here, 'ui'),
  plugins: [react(), tailwindcss(), runtimeConfigPlugin(mode)],
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
      '/auth': {
        target: 'http://localhost:4111',
        changeOrigin: true,
      },
    },
  },
}));
