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

import { mountConfigRoutes } from './config-routes.js';
import { mountFsRoutes } from './fs-routes.js';

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
      await Promise.allSettled([controller.getMastra()?.stopWorkers(), controller.stopIntervals()]);
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
