import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { serve } from '@hono/node-server';
import type { ServerType } from '@hono/node-server';
import { Mastra } from '@mastra/core/mastra';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createHonoServer } from '../index';

// Hard-loading a Studio URL whose path contains a dot (an agent id like
// `lead.agent`) returned 404 because the SPA fallback treated any dotted path
// as a static asset. Only real asset requests may skip the fallback. (#30296)

const STUDIO_HTML =
  '<!doctype html><html><head><base href="%%MASTRA_STUDIO_BASE_PATH%%/" /></head><body><div id="root">studio-shell</div></body></html>';
const ASSET_JS = 'console.log("studio asset");';
const TILE_SVG = '<svg xmlns="http://www.w3.org/2000/svg"></svg>';

let studioPath: string;
const servers: ServerType[] = [];

beforeAll(async () => {
  studioPath = await mkdtemp(join(tmpdir(), 'mastra-studio-dotted-'));
  await mkdir(join(studioPath, 'assets'));
  await writeFile(join(studioPath, 'index.html'), STUDIO_HTML);
  await writeFile(join(studioPath, 'assets', 'index-abc123.js'), ASSET_JS);
  await writeFile(join(studioPath, 'mastra-dark-tile.svg'), TILE_SVG);
  vi.stubEnv('MASTRA_STUDIO_PATH', studioPath);
  vi.stubEnv('MASTRA_TELEMETRY_DISABLED', '1');
});

afterAll(async () => {
  await Promise.all(servers.map(server => new Promise<void>(resolve => server.close(() => resolve()))));
  vi.unstubAllEnvs();
  await rm(studioPath, { recursive: true, force: true });
});

async function startStudioServer(studioBase?: string): Promise<string> {
  const mastra = new Mastra(studioBase === undefined ? {} : { server: { studioBase } });
  const app = await createHonoServer(mastra, { tools: {}, studio: true });
  const server = await new Promise<ServerType>(resolve => {
    const s = serve({ fetch: app.fetch, port: 0, hostname: '127.0.0.1' }, () => resolve(s));
  });
  servers.push(server);
  const { port } = server.address() as AddressInfo;
  return `http://127.0.0.1:${port}`;
}

// The Studio shell is index.html with the server config injected, not the raw file.
async function expectStudioShell(res: Response, basePath: string) {
  expect(res.status).toBe(200);
  expect(res.headers.get('content-type')).toContain('text/html');
  const html = await res.text();
  expect(html).toContain('studio-shell');
  expect(html).toContain(`<base href="${basePath}/" />`);
}

describe.each([
  { label: 'Studio at the root', studioBase: undefined, prefix: '' },
  { label: 'Studio under studioBase /studio', studioBase: '/studio', prefix: '/studio' },
])('$label: hard-loading routes with dotted ids (#30296)', ({ studioBase, prefix }) => {
  let baseUrl: string;

  beforeAll(async () => {
    baseUrl = await startStudioServer(studioBase);
  });

  it.each([
    '/agents/lead.agent',
    '/agents/lead.agent/threads',
    '/agents/lead.agent/chat/thread.2024.01',
    '/workflows/billing.v2/graph',
    '/agents/.lead.agent',
    '/agents/.lead.agent/threads',
  ])('serves the Studio shell when refreshing %s', async route => {
    await expectStudioShell(await fetch(`${baseUrl}${prefix}${route}`), prefix);
  });

  it.each(['', '/', '/agents/anything', '/index.html', '/docs.html'])(
    'still serves the Studio shell for "%s"',
    async route => {
      await expectStudioShell(await fetch(`${baseUrl}${prefix}${route}`), prefix);
    },
  );

  it('serves a real built asset from /assets', async () => {
    const res = await fetch(`${baseUrl}${prefix}/assets/index-abc123.js`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('javascript');
    expect(await res.text()).toBe(ASSET_JS);
  });

  it('serves a real top-level file from the Studio build', async () => {
    const res = await fetch(`${baseUrl}${prefix}/mastra-dark-tile.svg`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('image/svg+xml');
    expect(await res.text()).toBe(TILE_SVG);
  });

  it.each([
    '/assets/missing-chunk.js',
    '/assets/nested/missing.css',
    '/favicon.ico',
    '/.well-known/appspecific/com.chrome.devtools.json',
  ])('returns 404 instead of the Studio shell for a missing asset %s', async route => {
    const res = await fetch(`${baseUrl}${prefix}${route}`);
    expect(res.status).toBe(404);
    expect(await res.text()).not.toContain('studio-shell');
  });
});

describe('Dotted paths outside Studio keep returning 404 (#30296)', () => {
  let baseUrl: string;

  beforeAll(async () => {
    baseUrl = await startStudioServer('/studio');
  });

  it.each(['/api/not-a-route/lead.agent', '/agents/lead.agent'])(
    'does not serve the Studio shell for %s when Studio is mounted at /studio',
    async route => {
      const res = await fetch(`${baseUrl}${route}`);
      expect(res.status).toBe(404);
      expect(await res.text()).not.toContain('studio-shell');
    },
  );
});
