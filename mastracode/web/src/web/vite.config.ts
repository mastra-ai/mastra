import { realpathSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, searchForWorkspaceRoot } from 'vite';
import type { Plugin } from 'vite';

const here = dirname(fileURLToPath(import.meta.url));
const envDir = resolve(here, '../..');

/**
 * The standalone web package links dependencies from pnpm's store, which sits
 * outside Vite's default workspace boundary. Allow only the font package that
 * serves files in development rather than exposing the entire pnpm store.
 */
const monaSansPackageRoot = realpathSync(resolve(here, '../../node_modules/@fontsource-variable/mona-sans'));
const fsAllow = [searchForWorkspaceRoot(here), monaSansPackageRoot];

/**
 * Dev-proxy target for the API server and the UI dev-server port. Overridable
 * so the dev runner can relocate both when the default ports are taken.
 */
const apiTarget = process.env.MASTRACODE_API_TARGET ?? 'http://localhost:4111';
const uiPort = Number(process.env.MASTRACODE_UI_PORT ?? 5173);

/**
 * Dev-only injection of `window.__MASTRACODE_CONFIG__` into index.html.
 * `mastra factory dev` is auth-less by default, so dev injects
 * `{ authEnabled: false }` to skip the `/auth/me` probe. When the entry opts
 * auth back in (`MASTRACODE_AUTH_ENABLED=1`) nothing is injected and the SPA
 * probes `/auth/me` at runtime through the `^/auth/` proxy — the same code
 * path as production builds, which are untouched (`apply: 'serve'`).
 */
function runtimeConfigPlugin(authEnabled: boolean): Plugin {
  return {
    name: 'mastracode-runtime-config',
    apply: 'serve',
    transformIndexHtml() {
      if (authEnabled) return [];
      return [
        {
          tag: 'script',
          children: `window.__MASTRACODE_CONFIG__ = ${JSON.stringify({ authEnabled: false })};`,
          injectTo: 'head-prepend',
        },
      ];
    },
  };
}

/**
 * Vite config for the MastraCode web UI.
 *
 * In dev, `pnpm web:dev` runs `mastra factory dev` (the API server from
 * `src/mastra/index.ts` on :4111) and Vite (:5173) side by side; API paths are
 * proxied to that server so the browser uses same-origin requests in dev.
 *
 * The production build outputs the static SPA to `src/mastra/public/factory`.
 * `mastra build` copies the `public/` dir next to the Mastra entry into
 * `.mastra/output/` automatically, so the build output is self-contained and
 * the API server serves the SPA same-origin at `/` (see @mastra/factory/spa-static).
 * Hosting the SPA separately (static host / CDN, cross-origin via
 * MASTRACODE_ALLOWED_ORIGINS) remains possible.
 */
export default defineConfig(({ mode }) => {
  // The Vite process is not wrapped by varlock (only the API server is), so
  // read the package-root `.env` directly; explicit process env still wins.
  const env = { ...loadEnv(mode, envDir, ''), ...process.env };
  const authEnabled = env.MASTRACODE_AUTH_ENABLED === '1';

  return {
    root: resolve(here, 'ui'),
    envDir,
    plugins: [react(), tailwindcss(), runtimeConfigPlugin(authEnabled)],
    resolve: {
      // Monorepo packages arrive via `link:` and would otherwise resolve their
      // own react copy from the monorepo store — force a single copy from here.
      dedupe: ['react', 'react-dom', '@tanstack/react-query'],
    },
    build: {
      outDir: resolve(here, '../mastra/public/factory'),
      emptyOutDir: true,
    },
    server: {
      port: uiPort,
      fs: {
        // Linked font files resolve outside the workspace; expose only that
        // package instead of pnpm's entire global store.
        allow: fsAllow,
      },
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
  };
});
