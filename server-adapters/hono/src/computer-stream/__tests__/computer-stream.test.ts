import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { upstreamSocketUrl, viewerTarget } from '../index.js';
import {
  SECRET,
  createStubMastra,
  mintSession,
  mintSocketUrl,
  nextClose,
  nextMessage,
  openSocket,
  startProxy,
  startUpstream,
  stubViewer,
  waitFor,
} from './harness.js';

type Upstream = Awaited<ReturnType<typeof startUpstream>>;
type Proxy = Awaited<ReturnType<typeof startProxy>>;

let upstream: Upstream;
let proxy: Proxy | undefined;
let viewer: ReturnType<typeof stubViewer>;

beforeEach(async () => {
  upstream = await startUpstream();
  viewer = stubViewer(upstream.viewerUrl, upstream.state);
});

afterEach(async () => {
  vi.useRealTimers();
  await proxy?.close();
  proxy = undefined;
  await upstream.close();
});

async function start(options: Parameters<typeof startProxy>[0] = {}) {
  proxy = await startProxy({ getViewer: viewer.getViewer, ...options });
  return proxy;
}


describe('session route', () => {
  it('requires authentication when server auth is configured', async () => {
    const { origin } = await start();
    const res = await fetch(`${origin}/api/computers/c1/session`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ threadId: 'thread-1', resourceId: 'res-1', mode: 'watch' }),
    });
    expect(res.status).toBe(401);
    expect(viewer.state.calls).toBe(0);
  });

  it('returns a ticket-bearing socket URL for an attached, running computer', async () => {
    const { origin } = await start();
    const res = await mintSession(origin, 'c1', { mode: 'watch' });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { state: string; socketUrl: string };
    expect(body.state).toBe('ready');
    expect(body.socketUrl).toMatch(/^\/computer\/c1\/websockify\?ticket=[A-Za-z0-9_-]{43}$/);
    expect(JSON.stringify(body)).not.toContain(SECRET);
    expect(JSON.stringify(body)).not.toContain('127.0.0.1');
  });

  it('is forbidden when the computer is not attached to the thread/resource', async () => {
    const { origin } = await start();
    viewer.state.attached = false;
    const res = await mintSession(origin, 'c1');
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ state: 'forbidden' });
  });

  it('reports not-running when the viewer resolves to null', async () => {
    const { origin } = await start();
    viewer.state.running = false;
    const res = await mintSession(origin, 'c1');
    expect(await res.json()).toEqual({ state: 'not-running' });
  });

  it('404s when no computers are registered', async () => {
    const { origin } = await start({ getViewer: undefined });
    expect((await mintSession(origin, 'c1')).status).toBe(404);
    expect((await fetch(`${origin}/computer/c1/connect?ticket=x`)).status).toBe(404);
    expect((await fetch(`${origin}/computer/c1/vnc.html`)).status).toBe(404);
  });

  it.each([
    [{ mode: 'drive' }, 400],
    [{ mode: undefined }, 400],
    [{ threadId: undefined }, 400],
    [{ resourceId: undefined }, 400],
  ])('validates the body %j', async (body, status) => {
    const { origin } = await start();
    expect((await mintSession(origin, 'c1', body)).status).toBe(status);
  });

  it('404s for an unknown thread and 403s for a thread of another resource', async () => {
    const mastra = createStubMastra({
      threads: [
        { id: 'thread-1', resourceId: 'res-1' },
        { id: 'thread-2', resourceId: 'res-2' },
      ],
    });
    const { origin } = await start({ mastra });
    expect((await mintSession(origin, 'c1', { threadId: 'nope' })).status).toBe(404);
    expect((await mintSession(origin, 'c1', { threadId: 'thread-2' })).status).toBe(403);
  });

  it('checks memory:read for watch and memory:write for control through FGA', async () => {
    const checked: string[] = [];
    const fga = {
      check: async () => true,
      require: async (_user: unknown, { permission }: { permission: string }) => {
        checked.push(permission);
        if (permission === 'memory:write') throw Object.assign(new Error('denied'), { status: 403 });
      },
      filterAccessible: async (_u: unknown, items: unknown[]) => items,
    };
    const { origin } = await start({ mastra: createStubMastra({ fga }) });
    expect((await mintSession(origin, 'c1', { mode: 'watch' })).status).toBe(200);
    expect((await mintSession(origin, 'c1', { mode: 'control' })).status).toBe(403);
    expect(checked).toEqual(['memory:read', 'memory:write']);
  });

  it('rejects disallowed, malformed and non-http origins without minting', async () => {
    const { origin } = await start({ allowedOrigins: ['http://studio.test'] });
    for (const bad of ['http://evil.test', 'not a url', 'file://x', 'http://\u0000x']) {
      const res = await mintSession(origin, 'c1', {}, { origin: bad }).catch(() => undefined);
      if (res) expect(res.status).toBe(403);
    }
    const allowed = await mintSession(origin, 'c1', {}, { origin: 'http://studio.test' });
    expect(allowed.status).toBe(200);
    expect(viewer.state.calls).toBe(1);
  });
});

describe('no sandbox HTTP content', () => {
  it('404s every non-websocket /computer path and never fetches sandbox vnc.html or rfb.js', async () => {
    const { origin } = await start();
    const { socketUrl } = await mintSocketUrl(origin, 'c1');
    const before = upstream.requests.length;
    for (const rest of ['vnc.html', 'core/rfb.js', 'anything', 'connect?ticket=x', 'websockify', socketUrl.split('/').pop()!]) {
      for (const method of ['GET', 'HEAD', 'POST']) {
        const res = await fetch(`${origin}/computer/c1/${rest}`, { method });
        expect(res.status, `${method} ${rest}`).toBe(404);
        expect(res.headers.get('set-cookie')).toBeNull();
      }
    }
    expect(upstream.requests.length).toBe(before);
  });

  it('refuses sessions with 403 when no memory store is configured', async () => {
    const { origin } = await start({ mastra: createStubMastra({ threads: null }) });
    const res = await mintSession(origin, 'c1');
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ state: 'forbidden' });
    expect(viewer.state.calls).toBe(0);
  });
});

describe('websocket proxy', () => {
  it("relays noVNC's default upgrade, which requests no subprotocol", async () => {
    const { origin } = await start();
    const { url } = await mintSocketUrl(origin, 'c1');
    const { ws, protocol } = await openSocket(url, { origin }, []);
    expect(protocol).toBe('');
    ws!.send(Buffer.from([7, 8]));
    expect([...(await nextMessage(ws!)).data]).toEqual([7, 8]);
    const handshake = upstream.wsHandshakes.at(-1)!;
    expect(handshake.headers['sec-websocket-protocol']).toBeUndefined();
    expect(handshake.headers.cookie).toBe(`__mastra_preview=${SECRET}`);
    expect(handshake.headers.origin).toBeUndefined();
    ws!.close();
  });

  it('tickets are single-use, computer-bound and origin-bound', async () => {
    const { origin } = await start({ allowedOrigins: ['http://studio.test'] });
    const bare = `${origin.replace('http', 'ws')}/computer/c1/websockify`;
    expect((await openSocket(bare, { origin })).status).toBe(401);
    expect((await openSocket(`${bare}?ticket=nope`, { origin })).status).toBe(401);

    const first = await mintSocketUrl(origin, 'c1');
    expect((await openSocket(first.url.replace('/c1/', '/c2/'), { origin })).status).toBe(401);
    const second = await mintSocketUrl(origin, 'c1');
    const opened = await openSocket(second.url, { origin });
    expect(opened.protocol).toBe('binary');
    opened.ws!.close();
    expect((await openSocket(second.url, { origin })).status).toBe(401);

    // Minted from the allowed Studio origin: only that origin may redeem it.
    const studio = await mintSession(origin, 'c1', {}, { origin: 'http://studio.test' });
    const { socketUrl } = (await studio.json()) as { socketUrl: string };
    expect((await openSocket(`${origin.replace('http', 'ws')}${socketUrl}`, { origin })).status).toBe(401);
    const again = await mintSession(origin, 'c1', {}, { origin: 'http://studio.test' });
    const againUrl = ((await again.json()) as { socketUrl: string }).socketUrl;
    const studioSocket = await openSocket(`${origin.replace('http', 'ws')}${againUrl}`, { origin: 'http://studio.test' });
    expect(studioSocket.ws).toBeDefined();
    studioSocket.ws!.close();
  });

  it('enforces origin and the subprotocol allow-list', async () => {
    const { origin } = await start({ allowedOrigins: ['http://studio.test'] });
    expect((await openSocket((await mintSocketUrl(origin, 'c1')).url, {})).status).toBe(403);
    expect((await openSocket((await mintSocketUrl(origin, 'c1')).url, { origin: 'http://evil.test' })).status).toBe(403);
    expect((await openSocket((await mintSocketUrl(origin, 'c1')).url, { origin }, ['base64'])).status).toBe(400);
    expect((await openSocket((await mintSocketUrl(origin, 'c1')).url, { origin }, ['binary', 'base64'])).status).toBe(400);
  });

  it('re-checks the attachment when the socket opens', async () => {
    const { origin } = await start();
    const { url } = await mintSocketUrl(origin, 'c1');
    viewer.state.attached = false;
    expect((await openSocket(url, { origin })).status).toBe(401);
    viewer.state.attached = true;
    const stopped = await mintSocketUrl(origin, 'c1');
    viewer.state.running = false;
    expect((await openSocket(stopped.url, { origin })).status).toBe(502);
  });

  it('refreshes auth once when the upstream handshake is refused', async () => {
    const { origin } = await start();
    const { url } = await mintSocketUrl(origin, 'c1');
    upstream.state.wsUnauthorizedOnce = true;
    const { ws } = await openSocket(url, { origin });
    ws!.send(Buffer.from([9]));
    expect([...(await nextMessage(ws!)).data]).toEqual([9]);
    ws!.close();
  });

  it('propagates upstream close codes and leaves no upstream sockets behind', async () => {
    const { origin } = await start();
    const { ws } = await openSocket((await mintSocketUrl(origin, 'c1')).url, { origin });
    await waitFor(() => upstream.upstreamSockets.size === 1);
    const closed = nextClose(ws!);
    ws!.send('close-me');
    expect(await closed).toBe(4000);
    await waitFor(() => upstream.upstreamSockets.size === 0);
  });

  it('closes with 1009 when the client floods before the upstream opens', async () => {
    const { origin } = await start();
    const { url } = await mintSocketUrl(origin, 'c1');
    upstream.state.wsDelayMs = 300;
    const { ws } = await openSocket(url, { origin });
    const closed = nextClose(ws!);
    ws!.send(Buffer.alloc(1024 * 1024 + 1));
    expect(await closed).toBe(1009);
  });

  it('does not leave an upstream open when the client leaves first', async () => {
    const { origin } = await start();
    const { url } = await mintSocketUrl(origin, 'c1');
    upstream.state.wsDelayMs = 200;
    const { ws } = await openSocket(url, { origin });
    ws!.close();
    await new Promise(resolve => setTimeout(resolve, 400));
    expect(upstream.upstreamSockets.size).toBe(0);
  });

  it('cuts live viewers within one revalidation tick after release', async () => {
    const { origin } = await start();
    const { url } = await mintSocketUrl(origin, 'c1');
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const { ws } = await openSocket(url, { origin });
    await waitFor(() => upstream.upstreamSockets.size === 1);
    const closed = nextClose(ws!);
    viewer.state.attached = false;
    await vi.advanceTimersByTimeAsync(15_000);
    expect(await closed).toBe(4401);
    vi.useRealTimers();
    await waitFor(() => upstream.upstreamSockets.size === 0);
    expect((await mintSession(origin, 'c1')).status).toBe(403);
  });

  it('round-trips computer ids with reserved and unicode characters', async () => {
    const { origin } = await start();
    const id = 'a b/c?d#é';
    const { url, socketUrl } = await mintSocketUrl(origin, id);
    expect(socketUrl.startsWith(`/computer/${encodeURIComponent(id)}/websockify?ticket=`)).toBe(true);
    const { ws } = await openSocket(url, { origin });
    expect(ws).toBeDefined();
    ws!.close();
  });

  it('lets the ticketed socket past user middleware on the API prefix', async () => {
    const { origin } = await start({ userMiddleware: true });
    const { ws } = await openSocket((await mintSocketUrl(origin, 'c1')).url, { origin });
    expect(ws).toBeDefined();
    ws!.close();
    const unauth = await fetch(`${origin}/api/computers/c1/session`, { method: 'POST' });
    expect(unauth.status).toBe(401);
  });

  it('shares one WebSocket server with the browser stream', async () => {
    const { origin } = await start({ withBrowserStream: true });
    const computer = await openSocket((await mintSocketUrl(origin, 'c1')).url, { origin });
    expect(computer.ws).toBeDefined();
    const browser = await openSocket(
      `${origin.replace('http', 'ws')}/browser/agent-1/stream`,
      { authorization: 'Bearer valid-token' },
      [],
    );
    expect(browser.ws).toBeDefined();
    computer.ws!.close();
    browser.ws!.close();
  });
});

describe('url helpers', () => {
  it('maps http bases to ws: and https bases to wss:', () => {
    expect(upstreamSocketUrl(new URL('http://h/vnc/')).href).toBe('ws://h/vnc/websockify');
    expect(upstreamSocketUrl(new URL('https://6080-x.sandbox.test/')).href).toBe('wss://6080-x.sandbox.test/websockify');
  });

  it('drops the viewer query and keeps the directory', () => {
    expect(viewerTarget({ url: 'https://h/a/vnc.html?autoconnect=1#x', headers: {} }).base.href).toBe('https://h/a/');
  });
});
