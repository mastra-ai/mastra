/**
 * Same-origin SPA serving for production.
 *
 * In dev the SPA is served by Vite (:5173) which proxies API paths to the
 * server (:4111) — this module is effectively idle there. In production the
 * built SPA (vite output) is served by the API server itself at `/`, so the
 * app is a single origin and no CORS / separate static host is required.
 *
 * The middleware is mounted via the Mastra entry's `server.middleware`, which
 * the deployer applies before routes: real file hits and SPA navigations are
 * answered here, everything else falls through to the API routes.
 */

import { existsSync } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Context } from 'hono';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.map': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.wasm': 'application/wasm',
};

/** Server-owned path prefixes the SPA middleware must never answer for. */
const SERVER_PREFIXES = ['/api', '/web', '/auth'];

/**
 * Locate the built SPA (a dir containing `index.html`). Checked in order:
 *   1. `MASTRACODE_UI_DIST` — explicit override for custom layouts.
 *   2. `factory/` next to the bundled server module — vite builds into
 *      `src/mastra/public/factory` and `mastra build` copies `public/` into
 *      `.mastra/output/`, so the build output is self-contained.
 *   3. `src/mastra/public/factory` under cwd — the vite outDir when running from
 *      the package root before `mastra build`.
 * Returns `undefined` when no build is found (e.g. plain `mastra dev` without
 * a prior vite build), in which case the middleware is simply not mounted.
 */
export function resolveUiDistDir(): string | undefined {
  const candidates = [
    process.env.MASTRACODE_UI_DIST,
    join(dirname(fileURLToPath(import.meta.url)), 'factory'),
    resolve(process.cwd(), 'src/mastra/public/factory'),
  ];
  for (const candidate of candidates) {
    if (candidate && existsSync(join(candidate, 'index.html'))) return resolve(candidate);
  }
  return undefined;
}

async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

async function serveFile(c: Context, filePath: string, immutable: boolean): Promise<Response> {
  const data = await readFile(filePath);
  c.header('Content-Type', MIME[extname(filePath).toLowerCase()] ?? 'application/octet-stream');
  // Vite emits content-hashed filenames under assets/ — cache those forever;
  // index.html (and anything unhashed) must revalidate so deploys roll out.
  c.header('Cache-Control', immutable ? 'public, max-age=31536000, immutable' : 'no-cache');
  return c.body(new Uint8Array(data));
}

/**
 * Hono middleware serving the built SPA from `uiDist`:
 *   - exact file hits (js/css/assets) are served directly,
 *   - GET navigations to non-server paths fall back to `index.html` (SPA
 *     client-side routing),
 *   - `/api`, `/web`, `/auth` and non-GET requests always pass through.
 */
export function createSpaStaticMiddleware(uiDist: string) {
  return async (c: Context, next: () => Promise<void>): Promise<Response | void> => {
    if (c.req.method !== 'GET' && c.req.method !== 'HEAD') return next();
    const path = c.req.path;
    if (SERVER_PREFIXES.some(prefix => path === prefix || path.startsWith(`${prefix}/`))) return next();

    // Resolve the request path inside uiDist, rejecting traversal escapes.
    const relative = normalize(decodeURIComponent(path)).replace(/^[/\\]+/, '');
    const filePath = resolve(uiDist, relative);
    // Use a trailing separator so a sibling like "ui.key" can't slip past the
    // prefix check (same pattern as fs-routes.ts isWithinRoot).
    const uiDistPrefix = uiDist.endsWith(sep) ? uiDist : uiDist + sep;
    if (filePath.startsWith(uiDistPrefix) && relative !== '' && (await isFile(filePath))) {
      return serveFile(c, filePath, relative.startsWith('assets/'));
    }

    // SPA fallback: serve index.html for root and html navigations.
    const accept = c.req.header('Accept') ?? '';
    if (path === '/' || accept.includes('text/html')) {
      return serveFile(c, join(uiDist, 'index.html'), false);
    }

    return next();
  };
}
