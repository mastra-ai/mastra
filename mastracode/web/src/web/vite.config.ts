import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import type { Plugin } from 'vite';

const here = dirname(fileURLToPath(import.meta.url));

/**
 * Dev-only injection of `window.__MASTRACODE_CONFIG__` into index.html, from
 * the same WORKOS env vars the server reads (`isWebAuthEnabled()` in auth.ts).
 * `web:dev` only passes `src/web/.env` to the API server, so the plugin loads
 * that file itself via `loadEnv`. Production builds are untouched
 * (`apply: 'serve'`) — the statically hosted SPA has no flag and falls back to
 * probing `/auth/me` (see ui/runtime-config.ts).
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
 * In dev, `pnpm web:dev` runs `mastra dev` (the API server from
 * `src/mastra/index.ts` on :4111) and Vite (:5173) side by side; API paths are
 * proxied to that server so the browser uses same-origin requests in dev.
 *
 * The production build outputs the static SPA to `dist/web/ui`. It is hosted
 * separately (static host / CDN) and talks to the deployed API cross-origin —
 * the Mastra server no longer serves the SPA itself.
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
      // Web surface routes (fs/config/github) live under `/web/*` on the API
      // server after the `/api/web` → `/web` path migration. Proxy them so the
      // dev UI (:5173) can reach them on :4111.
      '/web': {
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
}));
