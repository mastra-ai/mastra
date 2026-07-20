import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import type { Plugin, UserConfig } from 'vite';

const here = dirname(fileURLToPath(import.meta.url));

const DEFAULT_DEV_SERVER_PORT = 4120;
const DEFAULT_DEV_UI_PORT = 5173;

type DevEnvironment = Record<string, string | undefined>;
type DevPortVariable = 'MASTRACODE_DEV_SERVER_PORT' | 'MASTRACODE_DEV_UI_PORT';

function getDevPort(name: DevPortVariable, fallback: number, env: DevEnvironment): number {
  const configuredPort = env[name]?.trim();
  const port = Number(configuredPort || fallback);

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`${name} must be an integer between 1 and 65535`);
  }

  return port;
}

/**
 * Dev-only injection of `window.__MASTRACODE_CONFIG__` into index.html, from
 * the same WORKOS env vars the server reads (`isWebAuthEnabled()` in auth.ts).
 * `web:dev` only passes the package-root `.env` to the API server, so the
 * plugin loads that file itself via `loadEnv`. Production builds are untouched
 * (`apply: 'serve'`) — the statically hosted SPA has no flag and falls back to
 * probing `/auth/me` (see ui/runtime-config.ts).
 */
function runtimeConfigPlugin(mode: string): Plugin {
  return {
    name: 'mastracode-runtime-config',
    apply: 'serve',
    transformIndexHtml() {
      const env = { ...loadEnv(mode, resolve(here, '../..'), ''), ...process.env };
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
 * `src/mastra/index.ts` on :4120 by default) and Vite (:5173) side by side;
 * API paths are proxied to that server so the browser uses same-origin requests.
 *
 * The production build outputs the static SPA to `src/mastra/public/ui`.
 * `mastra build` copies the `public/` dir next to the Mastra entry into
 * `.mastra/output/` automatically, so the build output is self-contained and
 * the API server serves the SPA same-origin at `/` (see src/web/spa-static.ts).
 * Hosting the SPA separately (static host / CDN, cross-origin via
 * MASTRACODE_ALLOWED_ORIGINS) remains possible.
 */
export function createViteConfig(mode: string, env: DevEnvironment = process.env): UserConfig {
  const devServerPort = getDevPort('MASTRACODE_DEV_SERVER_PORT', DEFAULT_DEV_SERVER_PORT, env);
  const devUiPort = getDevPort('MASTRACODE_DEV_UI_PORT', DEFAULT_DEV_UI_PORT, env);
  const devServerTarget = `http://localhost:${devServerPort}`;
  return {
    root: resolve(here, 'ui'),
    plugins: [react(), tailwindcss(), runtimeConfigPlugin(mode)],
    resolve: {
      // Monorepo packages arrive via `link:` and would otherwise resolve their
      // own react copy from the monorepo store — force a single copy from here.
      dedupe: ['react', 'react-dom', '@tanstack/react-query'],
    },
    build: {
      outDir: resolve(here, '../mastra/public/ui'),
      emptyOutDir: true,
    },
    server: {
      port: devUiPort,
      strictPort: true,
      proxy: {
        '/api': {
          target: devServerTarget,
          changeOrigin: true,
        },
        // Web surface routes (fs/config/github) live under `/web/*` on the API
        // server after the `/api/web` → `/web` path migration. Proxy them so the
        // dev UI can reach the API server.
        '/web': {
          target: devServerTarget,
          changeOrigin: true,
        },
        // Optional WorkOS auth routes live on the API server too; proxy them so
        // the dev UI can reach login/callback/logout/me.
        //
        // Match only the `/auth/<route>` paths — NOT a bare `/auth` prefix.
        // A plain `'/auth'` key prefix-matches Vite module requests like
        // `/auth.ts` (the client auth module) and wrongly proxies them to the
        // API server, which 401s / ECONNREFUSEs. The trailing-slash regex keeps
        // module imports on Vite while still forwarding real auth routes.
        '^/auth/': {
          target: devServerTarget,
          changeOrigin: true,
        },
      },
    },
  };
}

export default defineConfig(({ mode }) => createViteConfig(mode));
