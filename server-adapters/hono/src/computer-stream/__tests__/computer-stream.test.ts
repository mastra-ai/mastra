import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { upstreamSocketUrl, viewerTarget } from '../index.js';
import {
  SECRET,
  createStubMastra,
  mintSession,
  nextClose,
  nextMessage,
  openSession,
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

function assetUrl(origin: string, computerId: string, rest: string) {
  return `${origin}/computer/${encodeURIComponent(computerId)}/${rest}`;
}

function socketUrl(origin: string, computerId: string) {
  return `${origin.replace('http', 'ws')}/computer/${encodeURIComponent(computerId)}/websockify`;
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

  it('returns a ticket-bearing connect URL for an attached, running computer', async () => {
    const { origin } = await start();
    const res = await mintSession(origin, 'c1', { mode: 'watch' });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { state: string; connectUrl: string };
    expect(body.state).toBe('ready');
    expect(body.connectUrl).toMatch(/^\/computer\/c1\/connect\?ticket=[A-Za-z0-9_-]{43}$/);
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

describe('connect', () => {
  it('sets a scoped HttpOnly cookie and redirects to the viewer with the ticket-bound mode', async () => {
    const { origin } = await start();
    const watch = await openSession(origin, 'c1', { mode: 'watch' });
    expect(watch.connect.status).toBe(302);
    expect(watch.setCookie).toMatch(
      /^mastra_computer=[A-Za-z0-9_-]{43}; HttpOnly; SameSite=Lax; Path=\/computer\/c1\/; Max-Age=3600$/,
    );
    expect(watch.location).toBe('vnc.html?autoconnect=1&resize=scale&reconnect=1&view_only=1&path=computer/c1/websockify');
    expect(watch.connect.headers.get('referrer-policy')).toBe('no-referrer');
    expect(watch.connect.headers.get('cache-control')).toBe('no-store');

    const control = await openSession(origin, 'c1', { mode: 'control' });
    expect(control.location).toContain('view_only=0');
  });

  it('adds Secure behind an https proxy', async () => {
    const { origin } = await start();
    const minted = (await (await mintSession(origin, 'c1')).json()) as { connectUrl: string };
    const res = await fetch(`${origin}${minted.connectUrl}`, {
      redirect: 'manual',
      headers: { 'x-forwarded-proto': 'https' },
    });
    expect(res.headers.get('set-cookie')).toMatch(/; Secure$/);
  });

  it('renders the unauthorized status page for replayed, foreign and missing tickets', async () => {
    const { origin } = await start({ allowedOrigins: ['http://studio.test'] });
    const first = await openSession(origin, 'c1');
    const replay = await fetch(`${origin}${first.connectUrl}`, { redirect: 'manual' });
    expect(replay.status).toBe(401);
    expect(replay.headers.get('set-cookie')).toBeNull();
    expect(replay.headers.get('www-authenticate')).toBeNull();
    const html = await replay.text();
    expect(html).toContain('<meta name="mastra-computer-status" content="401">');
    expect(replay.headers.get('content-security-policy')).toMatch(
      /^default-src 'none'; script-src 'sha256-[A-Za-z0-9+/=]+'; frame-ancestors 'self' http:\/\/studio\.test$/,
    );

    const minted = (await (await mintSession(origin, 'c1')).json()) as { connectUrl: string };
    const foreign = await fetch(`${origin}${minted.connectUrl.replace('/c1/', '/c2/')}`, { redirect: 'manual' });
    expect(foreign.status).toBe(401);

    const injected = await fetch(`${origin}/computer/c1/connect?code=<script>alert(1)</script>`);
    expect(injected.status).toBe(401);
    expect(await injected.text()).not.toContain('alert(1)');
  });

  it('frames failure pages only for self when allowedOrigins is a callback', async () => {
    const { origin } = await start({ allowedOrigins: o => o });
    const res = await fetch(`${origin}/computer/c1/connect?ticket=bogus`);
    expect(res.headers.get('content-security-policy')).toMatch(/frame-ancestors 'self'$/);
  });

  it('renders unauthorized when the computer is released between mint and connect', async () => {
    const { origin } = await start();
    const minted = (await (await mintSession(origin, 'c1')).json()) as { connectUrl: string };
    viewer.state.attached = false;
    const res = await fetch(`${origin}${minted.connectUrl}`, { redirect: 'manual' });
    expect(res.status).toBe(401);
  });

  it.each(['file:///etc/passwd', 'data:text/html,hi', 'not a url'])('renders 502 for viewer url %s', async url => {
    const { origin } = await start();
    const minted = (await (await mintSession(origin, 'c1')).json()) as { connectUrl: string };
    viewer.state.url = url;
    const res = await fetch(`${origin}${minted.connectUrl}`, { redirect: 'manual', headers: { origin } });
    expect(res.status).toBe(502);
    expect(res.headers.get('content-security-policy')).toContain(`frame-ancestors 'self' ${origin}`);
    expect(await res.text()).toContain('content="502"');
  });

  it('renders 429 with no cookie when the session store is full', async () => {
    const { origin } = await start();
    // 500 computers × 1 session fills the global cap.
    const ids = Array.from({ length: 500 }, (_, i) => `cap-${i}`);
    for (const id of ids) {
      const opened = await openSession(origin, id);
      expect(opened.connect.status).toBe(302);
    }
    const minted = (await (await mintSession(origin, 'one-more')).json()) as { connectUrl: string };
    const res = await fetch(`${origin}${minted.connectUrl}`, { redirect: 'manual' });
    expect(res.status).toBe(429);
    expect(res.headers.get('set-cookie')).toBeNull();
    expect(await res.text()).toContain('content="429"');
  }, 60_000);
});

describe('asset proxy', () => {
  it('follows connect → vnc.html → core/rfb.js → websocket end to end', async () => {
    const { origin } = await start();
    const { cookie, location } = await openSession(origin, 'c1');
    const page = await fetch(new URL(location!, `${origin}/computer/c1/connect`), { headers: { cookie } });
    expect(page.status).toBe(200);
    expect(await page.text()).toContain('core/rfb.js');
    const rfb = await fetch(assetUrl(origin, 'c1', 'core/rfb.js'), { headers: { cookie } });
    expect(await rfb.text()).toContain('class RFB');

    const { ws, protocol } = await openSocket(socketUrl(origin, 'c1'), { cookie, origin });
    expect(protocol).toBe('binary');
    ws!.send(Buffer.from([1, 2, 3]));
    const echoed = await nextMessage(ws!);
    expect([...echoed.data]).toEqual([1, 2, 3]);
    expect(echoed.isBinary).toBe(true);
    ws!.close();
    await waitFor(() => upstream.upstreamSockets.size === 0);
  });

  it('isolates headers in both directions and never leaks the upstream secret', async () => {
    const { origin } = await start();
    const { cookie } = await openSession(origin, 'c1');
    const res = await fetch(assetUrl(origin, 'c1', 'vnc.html?x=1'), {
      headers: {
        cookie: `${cookie}; other=client`,
        authorization: 'Bearer valid-token',
        origin: 'http://evil.test',
        referer: 'http://evil.test/page',
        'x-forwarded-for': '1.2.3.4',
        'x-custom': 'nope',
        'if-none-match': '"v0"',
      },
    });
    expect(res.status).toBe(200);
    const sent = upstream.requests.at(-1)!;
    expect(sent.url).toBe('/vnc/vnc.html');
    expect(sent.headers.cookie).toBe(`__mastra_preview=${SECRET}`);
    expect(sent.headers['if-none-match']).toBe('"v0"');
    for (const name of ['authorization', 'origin', 'referer', 'x-forwarded-for', 'x-custom']) {
      expect(sent.headers[name]).toBeUndefined();
    }

    expect(res.headers.get('set-cookie')).toBeNull();
    expect(res.headers.get('www-authenticate')).toBeNull();
    expect(res.headers.get('x-frame-options')).toBeNull();
    expect(res.headers.get('x-upstream-secret')).toBeNull();
    expect(res.headers.get('content-security-policy')).toBe(`frame-ancestors 'self' ${origin}`);
    expect(res.headers.get('etag')).toBe('"v1"');
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(res.headers.get('referrer-policy')).toBe('no-referrer');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    const all = [...res.headers.entries()].join('\n') + (await res.text());
    expect(all).not.toContain(SECRET);
  });

  it('answers HEAD without a body', async () => {
    const { origin } = await start();
    const { cookie } = await openSession(origin, 'c1');
    const res = await fetch(assetUrl(origin, 'c1', 'vnc.html'), { method: 'HEAD', headers: { cookie } });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('');
  });

  it('rejects missing, foreign-computer and garbage cookies', async () => {
    const { origin } = await start();
    const { cookie } = await openSession(origin, 'c1');
    expect((await fetch(assetUrl(origin, 'c1', 'vnc.html'))).status).toBe(401);
    expect((await fetch(assetUrl(origin, 'c2', 'vnc.html'), { headers: { cookie } })).status).toBe(401);
    expect((await fetch(assetUrl(origin, 'c1', 'vnc.html'), { headers: { cookie: 'mastra_computer=x' } })).status).toBe(
      401,
    );
  });

  it('never follows upstream redirects', async () => {
    const { origin } = await start();
    const { cookie } = await openSession(origin, 'c1');
    const res = await fetch(assetUrl(origin, 'c1', 'redirect'), { headers: { cookie }, redirect: 'manual' });
    expect(res.status).toBe(502);
    expect(res.headers.get('location')).toBeNull();
    expect(upstream.requests.some(r => r.url.includes('redirect-target'))).toBe(false);
  });

  it.each(['../secret', '%2e%2e/secret', '%252e%252e/secret', '..%5csecret', 'a%2fb', 'a%00b', 'a%5cb', '%2E%2E%2Fsecret'])(
    'refuses traversal %s without touching upstream',
    async rest => {
      const { origin } = await start();
      const { cookie } = await openSession(origin, 'c1');
      const before = upstream.requests.length;
      const res = await fetch(`${origin}/computer/c1/${rest}`, { headers: { cookie } });
      expect([400, 401, 404]).toContain(res.status);
      expect(upstream.requests.length).toBe(before);
    },
  );

  it('times out a hung upstream with 502', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { origin } = await start();
    vi.useRealTimers();
    const { cookie } = await openSession(origin, 'c1');
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const pending = fetch(assetUrl(origin, 'c1', 'slow'), { headers: { cookie } });
    await waitForRealRequest(() => upstream.requests.some(r => r.url === '/vnc/slow'));
    await vi.advanceTimersByTimeAsync(15_000);
    vi.useRealTimers();
    expect((await pending).status).toBe(502);
  });

  it('refreshes upstream auth once on 401 and coalesces concurrent refreshes', async () => {
    const { origin } = await start();
    const { cookie } = await openSession(origin, 'c1');
    const callsAfterConnect = viewer.state.calls;
    upstream.state.secret = 'rotated-secret';
    const results = await Promise.all(
      Array.from({ length: 5 }, () => fetch(assetUrl(origin, 'c1', 'core/rfb.js'), { headers: { cookie } })),
    );
    expect(results.map(r => r.status)).toEqual([200, 200, 200, 200, 200]);
    expect(viewer.state.calls - callsAfterConnect).toBe(1);
  });

  it('calls getViewer once for the session, once for connect, and never per asset', async () => {
    const { origin } = await start();
    const { cookie } = await openSession(origin, 'c1');
    expect(viewer.state.calls).toBe(2);
    for (let i = 0; i < 40; i++) {
      expect((await fetch(assetUrl(origin, 'c1', 'core/rfb.js'), { headers: { cookie } })).status).toBe(200);
    }
    expect(viewer.state.calls).toBe(2);
    const { ws } = await openSocket(socketUrl(origin, 'c1'), { cookie, origin });
    expect(viewer.state.calls).toBe(3);
    ws!.close();
  });

  it('round-trips computer ids with reserved and unicode characters', async () => {
    const { origin } = await start();
    for (const id of ['a b/c', 'ü-π']) {
      const { setCookie, cookie, location } = await openSession(origin, id);
      const encoded = encodeURIComponent(id);
      expect(setCookie).toContain(`Path=/computer/${encoded}/`);
      expect(location).toContain(`path=computer/${encoded}/websockify`);
      expect((await fetch(assetUrl(origin, id, 'core/rfb.js'), { headers: { cookie } })).status).toBe(200);
      const { ws } = await openSocket(socketUrl(origin, id), { cookie, origin });
      expect(ws).toBeDefined();
      ws!.close();
    }
  });

  it('lets cookie-only iframe routes past user middleware on the API prefix', async () => {
    const { origin } = await start({ userMiddleware: true });
    const { cookie } = await openSession(origin, 'c1');
    expect((await fetch(assetUrl(origin, 'c1', 'vnc.html'), { headers: { cookie } })).status).toBe(200);
    const unauth = await fetch(`${origin}/api/computers/c1/session`, { method: 'POST', body: '{}' });
    expect(unauth.status).toBe(401);
  });
});

async function waitForRealRequest(predicate: () => boolean) {
  for (let i = 0; i < 300 && !predicate(); i++) {
    await new Promise(resolve => setImmediate(resolve));
  }
  expect(predicate()).toBe(true);
}

describe('websocket proxy', () => {
  it("relays noVNC's default upgrade, which requests no subprotocol", async () => {
    const { origin } = await start();
    const { cookie } = await openSession(origin, 'c1');
    const { ws, protocol } = await openSocket(socketUrl(origin, 'c1'), { cookie, origin }, []);
    expect(protocol).toBe('');
    ws!.send(Buffer.from([7, 8]));
    expect([...(await nextMessage(ws!)).data]).toEqual([7, 8]);
    expect(upstream.wsHandshakes.at(-1)!.headers['sec-websocket-protocol']).toBeUndefined();
    ws!.close();
  });

  it('enforces origin, session cookie and the subprotocol allow-list', async () => {
    const { origin } = await start({ allowedOrigins: ['http://studio.test'] });
    const { cookie } = await openSession(origin, 'c1');
    const url = socketUrl(origin, 'c1');
    expect((await openSocket(url, { cookie })).status).toBe(403);
    expect((await openSocket(url, { cookie, origin: 'http://evil.test' })).status).toBe(403);
    expect((await openSocket(url, { origin })).status).toBe(401);
    expect((await openSocket(url, { cookie: 'mastra_computer=nope', origin })).status).toBe(401);
    expect((await openSocket(url, { cookie, origin }, ['base64'])).status).toBe(400);
    expect((await openSocket(url, { cookie, origin }, ['binary', 'base64'])).status).toBe(400);
    const allowed = await openSocket(url, { cookie, origin: 'http://studio.test' });
    expect(allowed.protocol).toBe('binary');
    allowed.ws!.close();
    const same = await openSocket(url, { cookie, origin });
    same.ws!.close();
    const handshake = upstream.wsHandshakes.at(-1)!;
    expect(handshake.headers.cookie).toBe(`__mastra_preview=${SECRET}`);
    expect(handshake.headers.origin).toBeUndefined();
  });

  it('rejects a missing Origin even with no allowlist configured', async () => {
    const { origin } = await start();
    const { cookie } = await openSession(origin, 'c1');
    expect((await openSocket(socketUrl(origin, 'c1'), { cookie })).status).toBe(403);
  });

  it('404s a plain GET to websockify', async () => {
    const { origin } = await start();
    const { cookie } = await openSession(origin, 'c1');
    expect((await fetch(`${origin}/computer/c1/websockify`, { headers: { cookie } })).status).toBe(404);
  });

  it('refreshes auth once when the upstream handshake is refused', async () => {
    const { origin } = await start();
    const { cookie } = await openSession(origin, 'c1');
    upstream.state.wsUnauthorizedOnce = true;
    const { ws } = await openSocket(socketUrl(origin, 'c1'), { cookie, origin });
    ws!.send(Buffer.from([9]));
    expect([...(await nextMessage(ws!)).data]).toEqual([9]);
    ws!.close();
  });

  it('propagates upstream close codes and leaves no upstream sockets behind', async () => {
    const { origin } = await start();
    const { cookie } = await openSession(origin, 'c1');
    const { ws } = await openSocket(socketUrl(origin, 'c1'), { cookie, origin });
    await waitFor(() => upstream.upstreamSockets.size === 1);
    const closed = nextClose(ws!);
    ws!.send('close-me');
    expect(await closed).toBe(4000);
    await waitFor(() => upstream.upstreamSockets.size === 0);
  });

  it('closes with 1009 when the client floods before the upstream opens', async () => {
    const { origin } = await start();
    const { cookie } = await openSession(origin, 'c1');
    upstream.state.wsDelayMs = 300;
    const { ws } = await openSocket(socketUrl(origin, 'c1'), { cookie, origin });
    const closed = nextClose(ws!);
    ws!.send(Buffer.alloc(1024 * 1024 + 1));
    expect(await closed).toBe(1009);
  });

  it('does not leave an upstream open when the client leaves first', async () => {
    const { origin } = await start();
    const { cookie } = await openSession(origin, 'c1');
    upstream.state.wsDelayMs = 200;
    const { ws } = await openSocket(socketUrl(origin, 'c1'), { cookie, origin });
    ws!.close();
    await new Promise(resolve => setTimeout(resolve, 400));
    expect(upstream.upstreamSockets.size).toBe(0);
  });

  it('cuts live viewers within one revalidation tick after release', async () => {
    const { origin } = await start();
    const { cookie } = await openSession(origin, 'c1');
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const { ws } = await openSocket(socketUrl(origin, 'c1'), { cookie, origin });
    await waitFor(() => upstream.upstreamSockets.size === 1);
    const closed = nextClose(ws!);
    viewer.state.attached = false;
    await vi.advanceTimersByTimeAsync(15_000);
    expect(await closed).toBe(4401);
    vi.useRealTimers();
    expect((await fetch(assetUrl(origin, 'c1', 'vnc.html'), { headers: { cookie } })).status).toBe(401);
    expect((await openSocket(socketUrl(origin, 'c1'), { cookie, origin })).status).toBe(401);
    await waitFor(() => upstream.upstreamSockets.size === 0);
  });

  it('shares one WebSocket server with the browser stream', async () => {
    const { origin } = await start({ withBrowserStream: true });
    const { cookie } = await openSession(origin, 'c1');
    const computer = await openSocket(socketUrl(origin, 'c1'), { cookie, origin });
    expect(computer.ws).toBeDefined();
    const browser = await openSocket(`${origin.replace('http', 'ws')}/browser/agent-1/stream`, {
      authorization: 'Bearer valid-token',
    }, []);
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
