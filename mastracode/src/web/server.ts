import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Mastra } from '@mastra/core/mastra';
import { SERVER_ROUTES } from '@mastra/server/server-adapter';
import { Hono } from 'hono';

import { createMastraCode } from '../index.js';
import type { MastraCodeConfig } from '../index.js';

import { mountHarnessRoutes } from './hono-routes.js';
import type { ServerRouteLike } from './hono-routes.js';

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
  const { port: _p, uiDir, ...mastraCodeConfig } = options;

  // Build the full production harness (agents, modes, tools, memory, OM, MCP,
  // providers, observability) — identical to the terminal app.
  const result = await createMastraCode(mastraCodeConfig);
  const harness = result.harness;

  // Register the harness on a Mastra so the server route handlers can resolve it
  // via `mastra.getHarness(id)`.
  const mastra = new Mastra({ harnesses: { [HARNESS_ID]: harness } });

  const app = new Hono();
  mountHarnessRoutes(app, SERVER_ROUTES as unknown as ServerRouteLike[], mastra);

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
 * Default built-UI location. After build, this module lives at `dist/web/
 * server.js` and the Vite UI build outputs to `dist/web/` alongside it, so the
 * UI dir is this module's own directory.
 */
function defaultUiDir(): string | undefined {
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    return existsSync(join(here, 'index.html')) ? here : undefined;
  } catch {
    return undefined;
  }
}

/** serveStatic roots are resolved relative to cwd; convert an abs path. */
function relativeFromCwd(abs: string): string {
  const cwd = process.cwd();
  return abs.startsWith(cwd) ? abs.slice(cwd.length).replace(/^[/\\]/, '') || '.' : abs;
}
