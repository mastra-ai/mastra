import { realpathSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, searchForWorkspaceRoot } from 'vite';
import type { Plugin } from 'vite';

const here = dirname(fileURLToPath(import.meta.url));

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
// Bind the dev server to IPv4 loopback explicitly. Vite's default `localhost`
// bind resolves to `::1` (IPv6) only on modern macOS/Node, which leaves the UI
// unreachable over `127.0.0.1` — a cloudflared tunnel pointed at
// `http://127.0.0.1:5173` gets connection-refused. Overridable so the dev
// runner can expose the server on all interfaces when needed.
const uiHost = process.env.MASTRACODE_UI_HOST ?? '127.0.0.1';

/**
 * Dev-only injection of `window.__MASTRACODE_CONFIG__` into index.html.
 * `mastra factory dev` is auth-less by default. Production builds are
 * untouched (`apply: 'serve'`) and probe `/auth/me` at runtime instead.
 */
function runtimeConfigPlugin(): Plugin {
  return {
    name: 'mastracode-runtime-config',
    apply: 'serve',
    transformIndexHtml() {
      const authEnabled = false;
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
  // `web:dev` only wraps the API server in `varlock run`, so the package-root
  // `.env` never reaches this Vite process's `process.env` — load it here.
  const env = { ...loadEnv(mode, resolve(here, '../..'), ''), ...process.env };
  const publicUrl = env.MASTRACODE_PUBLIC_URL;
  const channelsPublicUrl = env.MASTRACODE_CHANNELS_PUBLIC_URL;
  const allowedHosts = publicUrl ? [new URL(publicUrl).host] : [];
  if (channelsPublicUrl) allowedHosts.push(new URL(channelsPublicUrl).host);

  return {
    root: resolve(here, 'ui'),
    envDir: resolve(here, '../..'),
    plugins: [react(), tailwindcss(), runtimeConfigPlugin()],
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
      host: uiHost,
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
        // needed for SlackProvider event endpoints
        '/slack': {
          target: apiTarget,
          changeOrigin: true,
        },
        // Slack account-linking deep link (`/connect/slack?state=...`) is an
        // API-server route, not an SPA page — without this entry Vite serves
        // the SPA shell (a white page) for it in dev.
        '/connect/slack': {
          target: apiTarget,
          changeOrigin: true,
        },
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
      allowedHosts,
    },
  };
});
