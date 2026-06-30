import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { MastraServer } from '@mastra/hono';
import type { HonoBindings, HonoVariables } from '@mastra/hono';
import { Hono } from 'hono';

import { mountAgentControllerOnMastra } from '../index.js';
import type { MastraCodeConfig } from '../index.js';

import { mountWebAuth } from './auth.js';
import { mountConfigRoutes } from './config-routes.js';
import { mountFsRoutes } from './fs-routes.js';
import { assertReplicaStableStateSecret, isGithubFeatureEnabled } from './github/config.js';
import { ensureAppDbReady } from './github/db.js';
import { mountGithubRoutes } from './github/routes.js';
import { isSandboxEnabled } from './github/sandbox.js';
import { TenantDispatcher } from './tenant-server.js';
import { assertRemoteTenantDbIfRequired } from './tenant-storage.js';

const CONTROLLER_ID = 'code';

export interface WebServerOptions extends MastraCodeConfig {
  /** Port to listen on. Default 4111. */
  port?: number;
  /**
   * Hostname/interface to bind to. Defaults to `127.0.0.1` (loopback only) so
   * the dev server is not exposed on the local network. Set to `0.0.0.0` to
   * bind all interfaces (only do this behind your own auth/network controls).
   */
  hostname?: string;
  /**
   * Directory containing the built web UI (index.html + assets). When present,
   * the server serves it as static files. Omit during dev (Vite serves the UI
   * and proxies /api here).
   */
  uiDir?: string;
  /**
   * Root directory the project picker may browse. Defaults to the user's home
   * directory. The fs-browse route confines all listings to this root.
   */
  fsRoot?: string;
}

export interface WebServer {
  port: number;
  url: string;
  stop: () => Promise<void>;
}

/**
 * Boots the real MastraCode controller (the same one the terminal uses), registers
 * it on a Mastra instance, and serves the controller HTTP routes plus the built
 * web UI over a Node Hono server.
 *
 * Each browser client creates/resumes its own isolated session via the controller
 * routes (`controller.createSession({ resourceId })` get-or-create), so a single
 * server can drive many concurrent web users.
 */
export async function startWebServer(options: WebServerOptions = {}): Promise<WebServer> {
  const port = options.port ?? 4111;
  const hostname = options.hostname ?? '127.0.0.1';
  const { port: _p, hostname: _h, uiDir, fsRoot, ...mastraCodeConfig } = options;

  // Build the full production controller (agents, modes, tools, memory, OM, MCP,
  // providers, observability) — identical to the terminal app — and register it
  // on a server-owned Mastra. Registration happens BEFORE init (inside
  // mountControllerOnMastra), so the controller inherits the server's single Mastra
  // and storage instead of spinning up a duplicate internal one. No eager
  // session is minted; each browser client creates/resumes its own isolated
  // session via the controller routes.
  const result = await mountAgentControllerOnMastra({ ...mastraCodeConfig, controllerId: CONTROLLER_ID });
  const controller = result.controller;
  const mastra = result.mastra;

  // Mount the real Mastra HTTP surface (including the controller session routes)
  // via the official Hono server adapter. `init()` registers context + auth
  // middleware and every Mastra route under `/api`, with the same schema
  // validation, SSE framing, and error handling the production server uses.
  const app = new Hono<{ Bindings: HonoBindings; Variables: HonoVariables }>();

  // The browser-facing origin used to build OAuth callback URLs. In dev the SPA
  // is served by Vite on a different port (e.g. :5173) and proxies to this
  // server, so callback URLs must point at the SPA origin, not this bind. Set
  // MASTRACODE_PUBLIC_URL to that origin; otherwise we fall back to the bind.
  const publicOrigin = (
    process.env.MASTRACODE_PUBLIC_URL ?? `http://${hostname === '0.0.0.0' ? 'localhost' : hostname}:${port}`
  ).replace(/\/+$/, '');

  // Optional WorkOS AuthKit gate. Mounted BEFORE the Mastra adapter and the
  // custom routes so the `app.use('*')` gate runs ahead of every other handler
  // and protects the whole surface. No-op unless WorkOS env vars are set.
  const redirectUri = process.env.WORKOS_REDIRECT_URI ?? `${publicOrigin}/auth/callback`;
  const webAuthEnabled = mountWebAuth(app, { redirectUri });
  process.stderr.write(`MastraCode web auth: ${webAuthEnabled ? 'enabled (WorkOS AuthKit)' : 'disabled'}\n`);

  // Per-tenant isolation: when web auth is enabled, every authenticated user
  // operates against their own Mastra bound to their own libSQL storage/vector
  // pair so no tenant's threads/messages/memory/recall can leak into another's.
  // The dispatcher intercepts the Mastra controller surface (`/api/*`), routes
  // authenticated users to their isolated tenant app, and falls through to the
  // shared adapter below for the auth-disabled / unauthenticated public path.
  let tenantDispatcher: TenantDispatcher | undefined;
  if (webAuthEnabled) {
    // Fail loud if a remote tenant DB is required (multi-replica/ephemeral
    // deploy) but only local-file tenant DBs are configured.
    assertRemoteTenantDbIfRequired();
    tenantDispatcher = new TenantDispatcher({
      baseConfig: mastraCodeConfig,
      controllerId: CONTROLLER_ID,
    });
    app.use('/api/*', tenantDispatcher.middleware());
    process.stderr.write('MastraCode web storage: per-tenant libSQL (isolated)\n');
  } else {
    process.stderr.write('MastraCode web storage: shared (single store)\n');
  }

  const adapter = new MastraServer({ app, mastra });
  await adapter.init();

  // Custom web-only routes are mounted directly on the app after init() so they
  // run with Mastra context available. They live under `/api/web/...`, outside
  // the Mastra route surface.
  //
  // Server-side directory browser for the project picker (browser can't read
  // absolute paths). Confined to fsRoot (default: home dir).
  mountFsRoutes(app, { root: fsRoot });
  // Provider + API-key management for the settings panel (mirrors the TUI's
  // /api-keys command). Reuses the controller model catalog + the credential store.
  mountConfigRoutes(app, { controller, authStorage: result.authStorage });

  // Optional GitHub App + cloud-sandbox project feature. Enabled only when the
  // GitHub App env vars, web auth, and the app DB are all configured. Fails soft:
  // if the app DB can't be reached we log and leave the feature disabled rather
  // than crashing the server.
  if (isGithubFeatureEnabled()) {
    // Fail loud if state signing wouldn't be stable across replicas. A random
    // per-process secret silently breaks the OAuth/install callback on a replica
    // that didn't sign the `state`.
    assertReplicaStableStateSecret();
    const baseUrl = publicOrigin;
    let githubReady = false;
    try {
      await ensureAppDbReady();
      githubReady = true;
    } catch (err) {
      process.stderr.write(
        `MastraCode GitHub: app DB unavailable, feature disabled (${err instanceof Error ? err.message : String(err)})\n`,
      );
    }
    if (githubReady) {
      mountGithubRoutes(app, { baseUrl });
      process.stderr.write(`MastraCode GitHub: enabled (sandbox ${isSandboxEnabled() ? 'enabled' : 'disabled'})\n`);
    }
  } else {
    process.stderr.write('MastraCode GitHub: disabled\n');
  }

  // Serve the built UI when available (production / `mastracode web`).
  const resolvedUiDir = uiDir ?? defaultUiDir();
  if (resolvedUiDir && existsSync(join(resolvedUiDir, 'index.html'))) {
    app.use('/*', serveStatic({ root: relativeFromCwd(resolvedUiDir) }));
    // SPA fallback: any non-API route serves index.html.
    app.get('*', serveStatic({ path: relativeFromCwd(join(resolvedUiDir, 'index.html')) }));
  }

  const server = serve({ fetch: app.fetch, port, hostname });

  return {
    port,
    url: `http://localhost:${port}`,
    stop: async () => {
      await new Promise<void>(resolve => server.close(() => resolve()));
      await Promise.allSettled([
        controller.getMastra()?.stopWorkers(),
        controller.stopIntervals(),
        tenantDispatcher?.stopAll(),
      ]);
    },
  };
}

/**
 * Default built-UI location. The web UI is a monorepo dev-only feature, so this
 * module always runs from source (`src/web/server.ts`) via tsx; the Vite UI
 * build outputs to `<pkgRoot>/dist/web/ui` (see src/web/vite.config.ts), which is
 * two levels up from this module. We also check `ui` next to this module as a
 * fallback for any compiled layout.
 */
function defaultUiDir(): string | undefined {
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    const candidates = [join(here, '..', '..', 'dist', 'web', 'ui'), join(here, 'ui')];
    return candidates.find(dir => existsSync(join(dir, 'index.html')));
  } catch {
    return undefined;
  }
}

/** serveStatic roots are resolved relative to cwd; convert an abs path. */
function relativeFromCwd(abs: string): string {
  const cwd = process.cwd();
  return abs.startsWith(cwd) ? abs.slice(cwd.length).replace(/^[/\\]/, '') || '.' : abs;
}

function resolveWebPort(argv: string[]): number | undefined {
  const idx = argv.findIndex(a => a === '--port' || a === '-p');
  if (idx !== -1 && argv[idx + 1]) {
    const parsed = Number(argv[idx + 1]);
    if (Number.isFinite(parsed)) return parsed;
  }
  const envPort = process.env.MASTRACODE_WEB_PORT?.trim();
  if (envPort) {
    const parsed = Number(envPort);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

/**
 * Standalone entry for local development only. The web UI is not part of the
 * published TUI package; run it from the monorepo via `pnpm --filter mastracode
 * web:dev` (which launches this module with tsx alongside Vite).
 */
async function webMain() {
  const port = resolveWebPort(process.argv);
  const server = await startWebServer({ ...(port ? { port } : {}) });
  process.stderr.write(`\nMastra Code web UI running at ${server.url}\n`);

  const shutdown = () => {
    void server.stop().finally(() => process.exit(0));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  // Keep the process alive; the Hono server holds the event loop open.
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void webMain();
}
