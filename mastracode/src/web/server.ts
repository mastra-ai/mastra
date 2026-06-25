import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Mastra } from '@mastra/core/mastra';
import { MastraServer } from '@mastra/hono';
import type { HonoBindings, HonoVariables } from '@mastra/hono';
import { Hono } from 'hono';

import { createMastraCode } from '../index.js';
import type { MastraCodeConfig } from '../index.js';

import { mountConfigRoutes } from './config-routes.js';
import { mountFsRoutes } from './fs-routes.js';

const HARNESS_ID = 'code';

export interface WebServerOptions extends MastraCodeConfig {
  /** Port to listen on. Default 4111. */
  port?: number;
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
 * Boots the real MastraCode harness (the same one the terminal uses), registers
 * it on a Mastra instance, and serves the harness HTTP routes plus the built
 * web UI over a Node Hono server.
 *
 * Each browser client creates/resumes its own isolated session via the harness
 * routes (`harness.createSession({ resourceId })` get-or-create), so a single
 * server can drive many concurrent web users.
 */
export async function startWebServer(options: WebServerOptions = {}): Promise<WebServer> {
  const port = options.port ?? 4111;
  const { port: _p, uiDir, fsRoot, ...mastraCodeConfig } = options;

  // Build the full production harness (agents, modes, tools, memory, OM, MCP,
  // providers, observability) — identical to the terminal app.
  const result = await createMastraCode(mastraCodeConfig);
  const harness = result.harness;

  // Register the harness on a Mastra so the server route handlers can resolve it
  // via `mastra.getHarness(id)`. Storage is owned by the Mastra: we hand it the
  // same composite store the harness was built with, so durability is
  // configured in one place and every harness registered here inherits it
  // (see Harness#resolveStorage — config.storage ?? parent Mastra storage).
  const mastra = new Mastra({ harnesses: { [HARNESS_ID]: harness }, storage: result.storage });

  // Mount the real Mastra HTTP surface (including the harness session routes)
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
  // /api-keys command). Reuses the harness model catalog + the credential store.
  mountConfigRoutes(app, { harness, authStorage: result.authStorage });

  // Serve the built UI when available (production / `mastracode web`).
  const resolvedUiDir = uiDir ?? defaultUiDir();
  if (resolvedUiDir && existsSync(join(resolvedUiDir, 'index.html'))) {
    app.use('/*', serveStatic({ root: relativeFromCwd(resolvedUiDir) }));
    // SPA fallback: any non-API route serves index.html.
    app.get('*', serveStatic({ path: relativeFromCwd(join(resolvedUiDir, 'index.html')) }));
  }

  const server = serve({ fetch: app.fetch, port });

  return {
    port,
    url: `http://localhost:${port}`,
    stop: async () => {
      await new Promise<void>(resolve => server.close(() => resolve()));
      await Promise.allSettled([harness.getMastra()?.stopWorkers(), harness.stopHeartbeats()]);
    },
  };
}

/**
 * Default built-UI location. After build this module lives at
 * `dist/web/server.js` and the Vite UI build outputs to `dist/web/ui/`, so the
 * UI dir is the `ui` subdirectory next to this module.
 */
function defaultUiDir(): string | undefined {
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    const uiDir = join(here, 'ui');
    return existsSync(join(uiDir, 'index.html')) ? uiDir : undefined;
  } catch {
    return undefined;
  }
}

/** serveStatic roots are resolved relative to cwd; convert an abs path. */
function relativeFromCwd(abs: string): string {
  const cwd = process.cwd();
  return abs.startsWith(cwd) ? abs.slice(cwd.length).replace(/^[/\\]/, '') || '.' : abs;
}
