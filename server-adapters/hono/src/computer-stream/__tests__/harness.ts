import { createServer } from 'node:http';
import type { IncomingMessage, Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { serve } from '@hono/node-server';
import type { Mastra } from '@mastra/core/mastra';
import type { MastraAuthConfig } from '@mastra/core/server';
import { Hono } from 'hono';
import WebSocket, { WebSocketServer } from 'ws';

import { setupBrowserStream } from '../../browser-stream/index.js';
import { createWebSocketSupport } from '../../shared/websocket-support.js';
import { setupComputerStream } from '../index.js';
import type { ComputerViewerSource, HonoComputerStreamConfig } from '../index.js';

export const SECRET = 'test-secret';

export interface UpstreamRequest {
  method: string;
  url: string;
  headers: IncomingMessage['headers'];
}

/**
 * A real stand-in for a sandbox preview host: noVNC assets under `/vnc/` and a
 * `websockify` endpoint, both refusing requests without the preview cookie.
 */
export async function startUpstream() {
  const requests: UpstreamRequest[] = [];
  const state = { secret: SECRET, wsUnauthorizedOnce: false, wsDelayMs: 0 };
  const authorized = (req: IncomingMessage) => (req.headers.cookie ?? '').includes(`__mastra_preview=${state.secret}`);

  const server = createServer((req, res) => {
    requests.push({ method: req.method!, url: req.url!, headers: req.headers });
    const path = new URL(req.url!, 'http://upstream').pathname;
    if (path === '/public/vnc.html') {
      res.writeHead(200, { 'content-type': 'text/html' }).end('<html>public</html>');
      return;
    }
    if (!authorized(req)) {
      res.writeHead(401, { 'www-authenticate': 'Cookie' }).end('nope');
      return;
    }
    switch (path) {
      case '/vnc/vnc.html':
        res
          .writeHead(200, {
            'content-type': 'text/html',
            etag: '"v1"',
            'set-cookie': ['__mastra_preview=leak; Path=/', 'other=1'],
            'content-security-policy': "default-src 'self'",
            'x-frame-options': 'DENY',
            'www-authenticate': 'Basic',
            'x-upstream-secret': SECRET,
          })
          .end(req.method === 'HEAD' ? undefined : '<html><script src="core/rfb.js"></script></html>');
        return;
      case '/vnc/core/rfb.js':
        res.writeHead(200, { 'content-type': 'text/javascript' }).end('export default class RFB {}');
        return;
      case '/vnc/redirect':
        res.writeHead(302, { location: '/vnc/redirect-target' }).end();
        break;
      case '/vnc/slow':
        // Never answers.
        break;
      default:
        res.writeHead(404).end('missing');
    }
  });

  const wss = new WebSocketServer({ noServer: true, handleProtocols: protocols => (protocols.has('binary') ? 'binary' : false) });
  const upstreamSockets = new Set<WebSocket>();
  const wsHandshakes: UpstreamRequest[] = [];
  server.on('upgrade', (req, socket, head) => {
    wsHandshakes.push({ method: req.method!, url: req.url!, headers: req.headers });
    if (state.wsUnauthorizedOnce || !authorized(req) || !req.url?.startsWith('/vnc/websockify')) {
      state.wsUnauthorizedOnce = false;
      socket.end('HTTP/1.1 401 Unauthorized\r\nContent-Length: 0\r\n\r\n');
      return;
    }
    setTimeout(() => wss.handleUpgrade(req, socket, head, ws => {
      upstreamSockets.add(ws);
      ws.on('close', () => upstreamSockets.delete(ws));
      ws.on('message', (data, isBinary) => {
        if (!isBinary && data.toString() === 'close-me') {
          ws.close(4000, 'upstream bye');
          return;
        }
        ws.send(data, { binary: isBinary });
      });
    }), state.wsDelayMs);
  });

  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as AddressInfo).port;
  return {
    server,
    requests,
    wsHandshakes,
    state,
    upstreamSockets,
    base: `http://127.0.0.1:${port}`,
    viewerUrl: `http://127.0.0.1:${port}/vnc/vnc.html?autoconnect=1&path=websockify`,
    close: async () => {
      for (const ws of upstreamSockets) ws.terminate();
      server.closeAllConnections();
      await new Promise<void>(resolve => server.close(() => resolve()));
    },
  };
}

export const authConfig: MastraAuthConfig = {
  authenticateToken: async token => (token === 'valid-token' ? { id: 'user-1', role: 'user' } : null),
};

export interface StubThread {
  id: string;
  resourceId: string;
}

export function createStubMastra(
  options: { auth?: MastraAuthConfig; threads?: StubThread[] | null; fga?: unknown } = {},
): Mastra {
  const threads = options.threads === undefined ? [{ id: 'thread-1', resourceId: 'res-1' }] : options.threads;
  const memoryStore = threads
    ? { getThreadById: async ({ threadId }: { threadId: string }) => threads.find(t => t.id === threadId) ?? null }
    : undefined;
  return {
    getServer: () => ({ auth: options.auth ?? authConfig, fga: options.fga }),
    getStudio: () => undefined,
    getLogger: () => undefined,
    getStorage: () => (memoryStore ? { getStore: async () => memoryStore } : undefined),
  } as unknown as Mastra;
}

export async function startProxy(
  options: Partial<Omit<HonoComputerStreamConfig, 'webSocket'>> & {
    userMiddleware?: boolean;
    withBrowserStream?: boolean;
  } = {},
) {
  const app = new Hono();
  if (options.userMiddleware) {
    app.use('/api/*', async (c, next) => {
      if (c.req.header('authorization') !== 'Bearer valid-token') return c.text('user middleware says no', 401);
      return next();
    });
  }
  const webSocket = await createWebSocketSupport(app);
  if (!webSocket) throw new Error('Expected @hono/node-ws to be available');
  if (options.withBrowserStream) {
    await setupBrowserStream(app, { mastra: options.mastra ?? createStubMastra(), getToolset: () => undefined, webSocket });
  }
  const stream = await setupComputerStream(app, {
    mastra: options.mastra ?? createStubMastra(),
    getViewer: 'getViewer' in options ? options.getViewer : async () => null,
    allowedOrigins: options.allowedOrigins,
    webSocket,
  });
  if (!stream) throw new Error('Expected computer stream to be set up');
  const server = serve({ fetch: app.fetch, port: 0, hostname: '127.0.0.1' }) as Server;
  stream.injectWebSocket(server);
  await new Promise<void>(resolve => server.once('listening', () => resolve()));
  const port = (server.address() as AddressInfo).port;
  const origin = `http://127.0.0.1:${port}`;
  return {
    server,
    origin,
    close: async () => {
      stream.close();
      server.closeAllConnections();
      await new Promise<void>(resolve => server.close(() => resolve()));
    },
  };
}

/** A stub `computers.viewer` pointing at the upstream, that can be "released". */
export function stubViewer(upstreamViewerUrl: string, upstreamState: { secret: string }) {
  const state = { attached: true, running: true, calls: 0, url: upstreamViewerUrl };
  const getViewer: ComputerViewerSource = async (_computerId, scope) => {
    state.calls += 1;
    if (!state.attached || scope.threadId !== 'thread-1' || scope.resourceId !== 'res-1') {
      throw new Error('computer is not attached to this thread');
    }
    if (!state.running) return null;
    return { url: state.url, headers: { cookie: `__mastra_preview=${upstreamState.secret}` } };
  };
  return { state, getViewer };
}

export async function mintSession(
  origin: string,
  computerId: string,
  body: Record<string, unknown> = {},
  headers: Record<string, string> = {},
) {
  return fetch(`${origin}/api/computers/${encodeURIComponent(computerId)}/session`, {
    method: 'POST',
    headers: { authorization: 'Bearer valid-token', 'content-type': 'application/json', origin, ...headers },
    body: JSON.stringify({ threadId: 'thread-1', resourceId: 'res-1', mode: 'control', ...body }),
  });
}

/** Mint + connect; returns the session cookie and the redirect location. */
export async function openSession(origin: string, computerId: string, body: Record<string, unknown> = {}) {
  const minted = await mintSession(origin, computerId, body);
  const json = (await minted.json()) as { state: string; connectUrl: string };
  if (json.state !== 'ready') throw new Error(`expected ready, got ${JSON.stringify(json)}`);
  const connect = await fetch(`${origin}${json.connectUrl}`, { redirect: 'manual' });
  const setCookie = connect.headers.get('set-cookie') ?? '';
  const cookie = setCookie.split(';')[0]!;
  return { connect, setCookie, cookie, location: connect.headers.get('location'), connectUrl: json.connectUrl };
}

export interface SocketResult {
  ws?: WebSocket;
  status?: number;
  protocol?: string;
}

export function openSocket(url: string, headers: Record<string, string>, protocols: string[] = ['binary']) {
  return new Promise<SocketResult>((resolve, reject) => {
    const ws = new WebSocket(url, protocols, { headers });
    const timer = setTimeout(() => reject(new Error('handshake timeout')), 5000);
    ws.on('open', () => {
      clearTimeout(timer);
      resolve({ ws, protocol: ws.protocol });
    });
    ws.on('unexpected-response', (_req, res) => {
      clearTimeout(timer);
      res.resume();
      resolve({ status: res.statusCode });
    });
    ws.on('error', () => {});
  });
}

export function nextMessage(ws: WebSocket) {
  return new Promise<{ data: Buffer; isBinary: boolean }>(resolve =>
    ws.once('message', (data, isBinary) => resolve({ data: data as Buffer, isBinary })),
  );
}

export function nextClose(ws: WebSocket) {
  return new Promise<number>(resolve => ws.once('close', code => resolve(code)));
}

export async function waitFor(predicate: () => boolean, timeoutMs = 3000) {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) throw new Error('waitFor timed out');
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}
