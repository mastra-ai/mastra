import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import type { Plugin } from 'vite';

const here = dirname(fileURLToPath(import.meta.url));

/**
 * Dev-proxy target for the API server and the UI dev-server port. Overridable
 * so the dev runner can relocate both when the default ports are taken.
 */
const apiTarget = process.env.MASTRACODE_API_TARGET ?? 'http://localhost:4111';
const uiPort = Number(process.env.MASTRACODE_UI_PORT ?? 5173);

/**
 * Dev-only injection of `window.__MASTRACODE_CONFIG__` into index.html.
 * Mirrors the server's default: auth is on unless MASTRACODE_AUTH_DISABLED=1,
 * because MastraFactory installs MastraAuthStudio by default when no explicit
 * provider is passed. Legacy WorkOS/better-auth branches also flip auth on when
 * their env vars are present so those paths keep working.
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
      const authDisabled = env.MASTRACODE_AUTH_DISABLED === '1';
      const authEnabled = !authDisabled;
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
 * The production build outputs the static SPA to `src/mastra/public/ui`.
 * `mastra build` copies the `public/` dir next to the Mastra entry into
 * `.mastra/output/` automatically, so the build output is self-contained and
 * the API server serves the SPA same-origin at `/` (see src/web/spa-static.ts).
 * Hosting the SPA separately (static host / CDN, cross-origin via
 * MASTRACODE_ALLOWED_ORIGINS) remains possible.
 */
export default defineConfig(({ mode }) => ({
  root: resolve(here, 'ui'),
  envDir: resolve(here, '../..'),
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
    port: uiPort,
    // OAuth callback URLs (WorkOS/GitHub/Linear) are registered against the
    // configured UI origin ahead of time. Silently hopping to a free port
    // would keep the UI working while every OAuth redirect breaks — fail
    // instead so the port stays consistent with MASTRACODE_PUBLIC_URL.
    strictPort: true,
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
      },
      // Web surface routes (fs/config/github) live under `/web/*` on the API
      // server after the `/api/web` → `/web` path migration. Proxy them so the
      // configured dev UI server can reach the configured API server.
      '/web': {
        target: apiTarget,
        changeOrigin: true,
      },
      // Optional WorkOS auth routes live on the API server too; proxy them so
      // the configured dev UI server can reach login/callback/logout/me on the
      // configured API server.
      //
      // Match only the `/auth/<route>` paths — NOT a bare `/auth` prefix.
      // A plain `'/auth'` key prefix-matches Vite module requests like
      // `/auth.ts` (the client auth module) and wrongly proxies them to the
      // API server, which 401s / ECONNREFUSEs. The trailing-slash regex keeps
      // module imports on Vite while still forwarding real auth routes.
      '^/auth/': {
        target: apiTarget,
        changeOrigin: true,
      },
    },
  },
}));
