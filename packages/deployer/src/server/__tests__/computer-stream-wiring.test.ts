import { Mastra } from '@mastra/core/mastra';
import type * as MastraHono from '@mastra/hono';
import { afterEach, describe, expect, it, vi } from 'vitest';

type Viewer = MastraHono.ComputerViewerSource;

function mastraWithComputers(viewer?: Viewer) {
  return new Mastra({ logger: false, ...(viewer && { computers: { tools: () => ({}), viewer } }) });
}

async function createServer(mastra: Mastra, extra: Record<string, unknown> = {}) {
  const memory = await mastra.getStorage()?.getStore('memory');
  const now = new Date();
  await memory?.saveThread({ thread: { id: 'thread-1', resourceId: 'res-1', title: '', createdAt: now, updatedAt: now } });
  const { createHonoServer } = await import('../index');
  return createHonoServer(mastra, { tools: {}, ...extra });
}

const sessionRequest = (app: { request: (url: string, init?: RequestInit) => Response | Promise<Response> }) =>
  app.request('http://localhost/api/computers/c1/session', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ threadId: 'thread-1', resourceId: 'res-1', mode: 'watch' }),
  });

describe('deployer computer stream wiring', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    vi.doUnmock('@mastra/hono');
  });

  it('mounts nothing while MASTRA_EXPERIMENTAL_COMPUTER is off', async () => {
    vi.stubEnv('MASTRA_EXPERIMENTAL_COMPUTER', '');
    const viewer = vi.fn<Viewer>();
    const app = await createServer(mastraWithComputers(viewer));

    expect((await sessionRequest(app)).status).toBe(404);
    // GETs fall through to the server's existing catch-all page, never the proxy.
    for (const path of ['/computer/c1/connect?ticket=x', '/computer/c1/vnc.html']) {
      const res = await app.request(`http://localhost${path}`, { redirect: 'manual' });
      expect(res.headers.get('set-cookie')).toBeNull();
      expect(res.status).not.toBe(302);
      expect(await res.text()).not.toContain('mastra-computer-status');
    }
    // With the proxy mounted this upgrade would be refused 403 (no Origin); off, it is just an unknown page.
    const upgrade = await app.request('http://localhost/computer/c1/websockify', { headers: { upgrade: 'websocket' } });
    expect(upgrade.status).not.toBe(403);
    expect(viewer).not.toHaveBeenCalled();
  });

  it('does not set up the proxy when no computers are registered', async () => {
    vi.stubEnv('MASTRA_EXPERIMENTAL_COMPUTER', 'true');
    const setupComputerStream = vi.fn();
    vi.doMock('@mastra/hono', async () => ({
      ...(await vi.importActual<typeof MastraHono>('@mastra/hono')),
      setupComputerStream,
    }));
    const app = await createServer(mastraWithComputers());

    expect((await sessionRequest(app)).status).toBe(404);
    expect((await app.request('http://localhost/api/agents')).status).toBe(200);
    expect(setupComputerStream).not.toHaveBeenCalled();
  });

  it('routes the session request to the registry viewer with the thread scope', async () => {
    vi.stubEnv('MASTRA_EXPERIMENTAL_COMPUTER', 'true');
    const viewer = vi.fn<Viewer>().mockResolvedValue(null);
    const app = await createServer(mastraWithComputers(viewer));

    const res = await sessionRequest(app);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ state: 'not-running' });
    expect(viewer).toHaveBeenCalledWith('c1', { threadId: 'thread-1', resourceId: 'res-1' });
  });

  it('respects computerStream: false', async () => {
    vi.stubEnv('MASTRA_EXPERIMENTAL_COMPUTER', 'true');
    const viewer = vi.fn<Viewer>();
    const app = await createServer(mastraWithComputers(viewer), { computerStream: false });
    expect((await sessionRequest(app)).status).toBe(404);
    expect(viewer).not.toHaveBeenCalled();
  });

  it('shares one WebSocket instance between the browser and computer streams', async () => {
    vi.stubEnv('MASTRA_EXPERIMENTAL_COMPUTER', 'true');
    const actual = await vi.importActual<typeof MastraHono>('@mastra/hono');
    const createWebSocketSupport = vi.fn(actual.createWebSocketSupport);
    const setupBrowserStream = vi.fn(actual.setupBrowserStream);
    const setupComputerStream = vi.fn(actual.setupComputerStream);
    vi.doMock('@mastra/hono', async () => ({
      ...actual,
      createWebSocketSupport,
      setupBrowserStream,
      setupComputerStream,
    }));
    await createServer(mastraWithComputers(vi.fn<Viewer>()));

    expect(createWebSocketSupport).toHaveBeenCalledTimes(1);
    const shared = await createWebSocketSupport.mock.results[0]!.value;
    expect(shared).not.toBeNull();
    expect(setupBrowserStream.mock.calls[0]![1].webSocket).toBe(shared);
    expect(setupComputerStream.mock.calls[0]![1].webSocket).toBe(shared);
  });

  it('reports unavailable when WebSocket support is missing', async () => {
    vi.stubEnv('MASTRA_EXPERIMENTAL_COMPUTER', 'true');
    vi.doMock('@mastra/hono', async () => ({
      ...(await vi.importActual<typeof MastraHono>('@mastra/hono')),
      createWebSocketSupport: vi.fn().mockResolvedValue(null),
    }));
    const app = await createServer(mastraWithComputers(vi.fn<Viewer>()));
    await expect((await sessionRequest(app)).json()).resolves.toEqual({ state: 'unavailable' });
  });

  it('keeps cookie-only iframe routes reachable past user middleware on the API prefix', async () => {
    vi.stubEnv('MASTRA_EXPERIMENTAL_COMPUTER', 'true');
    const viewer = vi.fn<Viewer>();
    const mastra = mastraWithComputers(viewer);
    mastra.setServerMiddleware([
      {
        path: '/api/*',
        handler: async (c, next) => {
          if (c.req.header('authorization') !== 'Bearer ok') return c.text('denied by user middleware', 401);
          return next();
        },
      },
    ]);
    const app = await createServer(mastra);

    // Reaches the proxy (which answers with its own unauthorized status page), not the user middleware.
    const connect = await app.request('http://localhost/computer/c1/connect?ticket=bogus');
    expect(connect.status).toBe(401);
    expect(await connect.text()).toContain('mastra-computer-status');
    expect((await sessionRequest(app)).status).toBe(401);
  });
});
