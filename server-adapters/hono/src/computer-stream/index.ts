import type { Mastra } from '@mastra/core/mastra';
import { MASTRA_RESOURCE_ID_KEY, MASTRA_THREAD_ID_KEY, RequestContext } from '@mastra/core/request-context';
import { enforceThreadAccess } from '@mastra/server/handlers/utils';
import type { Context, Hono, MiddlewareHandler } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { getCookie } from 'hono/cookie';
import type { WebSocket as WsWebSocket } from 'ws';

import { createAuthMiddleware } from '../auth-middleware';
import { isOriginAllowed, isSameOrigin, requestHost } from '../shared/origin';
import type { BrowserStreamOrigin } from '../shared/origin';
import { createWebSocketSupport } from '../shared/websocket-support';
import type { WebSocketSupport } from '../shared/websocket-support';
import { ComputerSessionStore } from './sessions';
import type { ComputerSession, ComputerViewerTarget } from './sessions';
import { ComputerTicketStore } from './tickets';
import type { ComputerViewMode } from './tickets';

/**
 * Resolves a computer's viewer for a thread. Matches the contract of
 * `mastra.getComputers().viewer`: the noVNC page URL plus upstream-only auth
 * headers, `null` while the computer exists but isn't running, and a throw when
 * the computer isn't attached to that thread and resource.
 *
 * @experimental
 */
export type ComputerViewerSource = (
  computerId: string,
  scope: { threadId: string; resourceId: string },
) => Promise<{ url: string; headers: Record<string, string> } | null>;

/** @experimental */
export interface HonoComputerStreamConfig {
  mastra: Mastra;
  /** Viewer resolver; `undefined` when no computers are registered (routes answer 404). */
  getViewer: ComputerViewerSource | undefined;
  apiPrefix?: string;
  /** Origins other than the server's own that may embed the viewer (same shape as `cors.origin`). */
  allowedOrigins?: BrowserStreamOrigin;
  /** Shared WebSocket support; pass the instance the browser stream uses. */
  webSocket?: WebSocketSupport | null;
}

/** @experimental */
export interface ComputerStreamResult {
  injectWebSocket: (server: unknown) => void;
  /** Stop revalidation timers and close every proxied socket. */
  close: () => void;
}

export const SESSION_COOKIE = 'mastra_computer';
export const REVALIDATE_INTERVAL_MS = 15_000;
export const VIEWER_REFRESH_AFTER_MS = 50 * 60_000;
export const UPSTREAM_TIMEOUT_MS = 15_000;
export const MAX_PENDING_CLIENT_BYTES = 1024 * 1024;
const SESSION_BODY_MAX_BYTES = 1024;
const COOKIE_MAX_AGE_S = 3600;

const FORWARDED_REQUEST_HEADERS = ['accept', 'if-none-match', 'if-modified-since', 'range'];
const FORWARDED_RESPONSE_HEADERS = ['content-type', 'etag', 'last-modified', 'content-range', 'accept-ranges'];

const STATUS_TEXT: Record<StatusCode, string> = {
  401: 'This computer viewer link is no longer valid.',
  429: 'Too many computer viewers are open. Close one and try again.',
  502: 'The computer could not be reached.',
};
type StatusCode = 401 | 429 | 502;

const STATUS_SCRIPT =
  "(function(){var m=document.querySelector('meta[name=\"mastra-computer-status\"]');" +
  "parent.postMessage({type:'mastra-computer-status',code:Number(m&&m.content)},'*')})()";

async function sha256Base64(text: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return btoa(String.fromCharCode(...new Uint8Array(digest)));
}

class ViewerUnavailable extends Error {}

/**
 * Normalize a viewer URL into the directory its assets resolve against.
 * Only `http:`/`https:` viewers are proxied.
 */
export function viewerTarget(viewer: { url: string; headers: Record<string, string> }): ComputerViewerTarget {
  let url: URL;
  try {
    url = new URL(viewer.url);
  } catch {
    throw new ViewerUnavailable('invalid viewer url');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new ViewerUnavailable('unsupported viewer protocol');
  }
  const base = new URL('./', url);
  base.search = '';
  base.hash = '';
  return { base, headers: { ...viewer.headers } };
}

/** The upstream websockify URL for a viewer base: `ws:` for `http:`, `wss:` for `https:`. */
export function upstreamSocketUrl(base: URL): URL {
  const target = new URL('websockify', base);
  target.protocol = base.protocol === 'https:' ? 'wss:' : 'ws:';
  return target;
}

/** Path segments that could escape the viewer directory, raw or after decoding. */
function isUnsafeRemainder(raw: string): boolean {
  if (raw.length === 0) return true;
  let decoded = raw;
  for (let i = 0; i < 3; i++) {
    if (/(^|\/)\.\.?(\/|$)/.test(decoded) || /[\\\0]/.test(decoded) || /%(2f|5c|00)/i.test(decoded)) return true;
    let next: string;
    try {
      next = decodeURIComponent(decoded);
    } catch {
      return true;
    }
    if (next === decoded) return false;
    decoded = next;
  }
  return true;
}

function isHttps(c: Context): boolean {
  const forwarded = c.req.header('x-forwarded-proto')?.split(',')[0]?.trim().toLowerCase();
  return forwarded === 'https' || new URL(c.req.url).protocol === 'https:';
}

function serverOrigin(c: Context): string {
  const host = (requestHost(c)?.split(',')[0] ?? '').trim();
  return `${isHttps(c) ? 'https' : 'http'}://${host}`;
}

function staticFrameAncestors(allowed: BrowserStreamOrigin | undefined): string {
  if (allowed === '*') return "'self' *";
  const list = Array.isArray(allowed) ? allowed : typeof allowed === 'string' ? [allowed] : [];
  const valid = list.flatMap(origin => {
    try {
      const parsed = new URL(origin);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? [parsed.origin] : [];
    } catch {
      return [];
    }
  });
  return ["'self'", ...valid].join(' ');
}

function statusError(error: unknown): number | undefined {
  const status = (error as { status?: unknown })?.status;
  return typeof status === 'number' ? status : undefined;
}

/**
 * Same-origin proxy that embeds a computer's live desktop (noVNC) in Studio.
 *
 * - `POST {apiPrefix}/computers/:computerId/session` — authenticated; checks the
 *   caller may read (`watch`) or write (`control`) the thread and that the
 *   computer is attached to it, then mints a 30 s single-use ticket.
 * - `GET /computer/:computerId/connect?ticket=` — the iframe's first navigation:
 *   trades the ticket for an HttpOnly cookie scoped to `/computer/:computerId/`
 *   and redirects to the viewer page. Failures render a small status page that
 *   posts `{ type: 'mastra-computer-status', code }` to the embedding Studio.
 * - `GET /computer/:computerId/websockify` — WebSocket proxy to the desktop.
 * - `GET|HEAD /computer/:computerId/*` — viewer asset proxy.
 *
 * The upstream auth (the sandbox preview cookie) is added server-side and never
 * reaches the browser. Live sessions are revalidated every 15 s, so releasing a
 * computer from the thread cuts its viewers within that interval.
 *
 * Requires a long-running Node server that accepts WebSocket upgrades (not
 * serverless). Sessions are in-process, so multi-instance deployments need
 * sticky routing. Server middleware registered for every path must let
 * `/computer/*` through, because the iframe authenticates with the session
 * cookie only. The first desktop boot can take minutes; Node's default
 * `server.requestTimeout` (300 s) bounds `/connect`.
 *
 * @experimental
 */
export async function setupComputerStream(
  app: Hono<any, any, any>,
  config: HonoComputerStreamConfig,
): Promise<ComputerStreamResult | null> {
  const webSocket = config.webSocket === undefined ? await createWebSocketSupport(app) : config.webSocket;
  if (!webSocket) {
    return null;
  }
  let WebSocketClient: typeof WsWebSocket;
  try {
    const mod = 'ws';
    WebSocketClient = (await import(/* @vite-ignore */ /* webpackIgnore: true */ mod)).WebSocket;
  } catch {
    return null;
  }

  const rawPrefix = config.apiPrefix ?? '/api';
  const apiPrefix = (rawPrefix.endsWith('/') ? rawPrefix.slice(0, -1) : rawPrefix) || '/api';
  const { mastra, allowedOrigins } = config;
  const authenticate = createAuthMiddleware({ mastra });
  const tickets = new ComputerTicketStore();
  const scriptHash = await sha256Base64(STATUS_SCRIPT);

  interface LiveSocket {
    client: { close: (code?: number, reason?: string) => void };
    upstream?: WsWebSocket;
  }
  const liveSockets = new Map<string, Set<LiveSocket>>();
  const revalidators = new Map<string, ReturnType<typeof setInterval>>();
  const refreshes = new Map<string, Promise<ComputerSession | undefined>>();

  const closeSessionSockets = (sessionId: string, code: number, reason: string) => {
    for (const live of liveSockets.get(sessionId) ?? []) {
      live.client.close(code, reason);
      live.upstream?.terminate();
    }
    liveSockets.delete(sessionId);
    const timer = revalidators.get(sessionId);
    if (timer) clearInterval(timer);
    revalidators.delete(sessionId);
  };

  const sessions = new ComputerSessionStore({
    onRemove: session => {
      if (liveSockets.has(session.id)) closeSessionSockets(session.id, session.revoked ? 4401 : 1000, 'session ended');
    },
  });

  /**
   * Re-resolve a session's viewer (coalesced per session). A throw means the
   * computer is no longer attached to the thread: the session is revoked.
   */
  const refresh = (session: ComputerSession): Promise<ComputerSession | undefined> => {
    const inflight = refreshes.get(session.id);
    if (inflight) return inflight;
    const run = (async () => {
      let viewer: Awaited<ReturnType<ComputerViewerSource>>;
      try {
        viewer = await config.getViewer!(session.computerId, {
          threadId: session.threadId,
          resourceId: session.resourceId,
        });
      } catch {
        sessions.revoke(session);
        return undefined;
      }
      if (!viewer) return undefined;
      try {
        session.viewer = viewerTarget(viewer);
      } catch {
        return undefined;
      }
      session.resolvedAt = Date.now();
      return session;
    })().finally(() => refreshes.delete(session.id));
    refreshes.set(session.id, run);
    return run;
  };

  const startRevalidation = (session: ComputerSession) => {
    if (revalidators.has(session.id)) return;
    const timer = setInterval(() => {
      void refresh(session).then(result => {
        if (!result && !session.revoked) closeSessionSockets(session.id, 1011, 'computer unavailable');
      });
    }, REVALIDATE_INTERVAL_MS);
    timer.unref?.();
    revalidators.set(session.id, timer);
  };

  const computerIdOf = (c: Context) => c.req.param('computerId')!;
  const cookiePath = (computerId: string) => `/computer/${encodeURIComponent(computerId)}/`;

  const requireComputers: MiddlewareHandler = async (c, next) => {
    if (!config.getViewer) return c.json({ error: 'No computers are registered' }, 404);
    return next();
  };

  const statusPage = (c: Context, code: StatusCode, frameAncestors: string) => {
    const html =
      `<!doctype html><html><head><meta charset="utf-8"><meta name="mastra-computer-status" content="${code}">` +
      `<title>Computer viewer</title></head><body><p>${STATUS_TEXT[code]}</p><script>${STATUS_SCRIPT}</script></body></html>`;
    return c.body(html, code, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'Content-Security-Policy': `default-src 'none'; script-src 'sha256-${scriptHash}'; frame-ancestors ${frameAncestors}`,
    });
  };

  // ---- 1. Authenticated session mint -------------------------------------------------------
  app.post(
    `${apiPrefix}/computers/:computerId/session`,
    requireComputers,
    authenticate,
    bodyLimit({ maxSize: SESSION_BODY_MAX_BYTES, onError: c => c.json({ error: 'Request body too large' }, 413) }),
    async (c: Context) => {
      const computerId = computerIdOf(c);
      let body: { threadId?: unknown; resourceId?: unknown; mode?: unknown };
      try {
        body = await c.req.json();
      } catch {
        return c.json({ error: 'Invalid JSON body' }, 400);
      }
      if (body?.mode !== 'watch' && body?.mode !== 'control') {
        return c.json({ error: "mode must be 'watch' or 'control'" }, 400);
      }
      const mode: ComputerViewMode = body.mode;
      const requestContext = (c.get('requestContext') as RequestContext | undefined) ?? new RequestContext();
      const contextThreadId = requestContext.get(MASTRA_THREAD_ID_KEY) as string | undefined;
      const threadId = contextThreadId || (typeof body.threadId === 'string' ? body.threadId : undefined);
      if (!threadId) return c.json({ error: 'threadId is required' }, 400);

      const contextResourceId = requestContext.get(MASTRA_RESOURCE_ID_KEY) as string | undefined;
      const bodyResourceId = typeof body.resourceId === 'string' ? body.resourceId : undefined;
      if (contextResourceId && bodyResourceId && bodyResourceId !== contextResourceId) {
        return c.json({ state: 'forbidden' }, 403);
      }
      const resourceId = contextResourceId || bodyResourceId;
      if (!resourceId) return c.json({ error: 'resourceId is required' }, 400);

      // Canonicalize the embedding origin before any lookups so a hostile page gets nothing.
      const rawOrigin = c.req.header('origin');
      let studioOrigin = serverOrigin(c);
      if (rawOrigin) {
        let parsed: URL;
        try {
          parsed = new URL(rawOrigin);
        } catch {
          return c.json({ state: 'forbidden' }, 403);
        }
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return c.json({ state: 'forbidden' }, 403);
        studioOrigin = parsed.origin;
        const allowed =
          isSameOrigin(studioOrigin, requestHost(c)) ||
          (allowedOrigins !== undefined && (await isOriginAllowed(allowedOrigins, studioOrigin, c)));
        if (!allowed) return c.json({ state: 'forbidden' }, 403);
      }

      const memoryStore = await mastra.getStorage()?.getStore('memory');
      if (memoryStore) {
        const thread = await memoryStore.getThreadById({ threadId });
        if (!thread) return c.json({ error: 'Thread not found' }, 404);
        try {
          await enforceThreadAccess({
            mastra,
            requestContext,
            threadId,
            thread,
            effectiveResourceId: resourceId,
            permission: mode === 'watch' ? 'memory:read' : 'memory:write',
          });
        } catch (error) {
          const status = statusError(error);
          if (status === 400) return c.json({ error: 'Invalid thread access request' }, 400);
          return c.json({ state: 'forbidden' }, 403);
        }
      }

      let viewer: Awaited<ReturnType<ComputerViewerSource>>;
      try {
        viewer = await config.getViewer!(computerId, { threadId, resourceId });
      } catch {
        return c.json({ state: 'forbidden' }, 403);
      }
      if (!viewer) return c.json({ state: 'not-running' });

      const issued = tickets.issue({ computerId, threadId, resourceId, mode, studioOrigin });
      if (!issued.ok) return c.json({ error: 'Too many computer viewer tickets' }, 429);
      return c.json({
        state: 'ready',
        connectUrl: `${cookiePath(computerId)}connect?ticket=${encodeURIComponent(issued.ticket)}`,
      });
    },
  );

  // ---- 2. Ticket → cookie --------------------------------------------------------------------
  app.get('/computer/:computerId/connect', requireComputers, async (c: Context) => {
    const computerId = computerIdOf(c);
    const ticket = c.req.query('ticket');
    const payload = ticket ? tickets.consume(ticket, computerId) : undefined;
    if (!payload) return statusPage(c, 401, staticFrameAncestors(allowedOrigins));
    const frameAncestors = `'self' ${payload.studioOrigin}`;

    if (!sessions.hasCapacity(computerId)) return statusPage(c, 429, frameAncestors);

    let viewer: ComputerViewerTarget;
    try {
      const resolved = await config.getViewer!(computerId, {
        threadId: payload.threadId,
        resourceId: payload.resourceId,
      });
      if (!resolved) return statusPage(c, 502, frameAncestors);
      viewer = viewerTarget(resolved);
    } catch (error) {
      return statusPage(c, error instanceof ViewerUnavailable ? 502 : 401, frameAncestors);
    }

    const session = sessions.insert({ ...payload, viewer });
    if (!session) return statusPage(c, 429, frameAncestors);

    const encodedId = encodeURIComponent(computerId);
    const secure = isHttps(c) ? '; Secure' : '';
    c.header(
      'Set-Cookie',
      `${SESSION_COOKIE}=${session.id}; HttpOnly; SameSite=Lax; Path=${cookiePath(computerId)}; Max-Age=${COOKIE_MAX_AGE_S}${secure}`,
    );
    c.header('Referrer-Policy', 'no-referrer');
    c.header('Cache-Control', 'no-store');
    const viewOnly = session.mode === 'watch' ? '1' : '0';
    return c.redirect(
      `vnc.html?autoconnect=1&resize=scale&reconnect=1&view_only=${viewOnly}&path=computer/${encodedId}/websockify`,
      302,
    );
  });

  // ---- 3. WebSocket proxy ----------------------------------------------------------------------
  const authorizeSocket: MiddlewareHandler = async (c, next) => {
    if (c.req.header('upgrade')?.toLowerCase() !== 'websocket') return c.text('Not Found', 404);
    const origin = c.req.header('origin');
    const originAllowed =
      !!origin &&
      (isSameOrigin(origin, requestHost(c)) ||
        (allowedOrigins !== undefined && (await isOriginAllowed(allowedOrigins, origin, c))));
    if (!originAllowed) return c.text('Forbidden', 403);
    const session = sessions.touch(getCookie(c, SESSION_COOKIE), computerIdOf(c));
    if (!session) return c.text('Unauthorized', 401);
    const protocols = (c.req.header('sec-websocket-protocol') ?? '').split(',').map(p => p.trim());
    if (!protocols.includes('binary')) return c.text('Bad Request', 400);
    // Every socket open re-checks the attachment.
    const current = await refresh(session);
    if (!current) return c.text(session.revoked ? 'Unauthorized' : 'Bad Gateway', session.revoked ? 401 : 502);
    c.set('computerSession', session);
    return next();
  };

  app.get(
    '/computer/:computerId/websockify',
    requireComputers,
    authorizeSocket,
    webSocket.upgradeWebSocket(c => {
      const session = (c as Context).get('computerSession') as ComputerSession;
      const live: LiveSocket = { client: { close: () => {} } };
      let pending: (ArrayBuffer | string)[] = [];
      let pendingBytes = 0;
      let clientClosed = false;
      let retried = false;

      const openUpstream = (ws: { send: (data: ArrayBuffer | string) => void; close: (code?: number) => void }) => {
        const upstream = new WebSocketClient(upstreamSocketUrl(session.viewer.base), ['binary'], {
          headers: session.viewer.headers,
        });
        live.upstream = upstream;
        upstream.binaryType = 'arraybuffer';
        upstream.on('open', () => {
          if (clientClosed) return upstream.close();
          for (const frame of pending) upstream.send(frame);
          pending = [];
          pendingBytes = 0;
        });
        upstream.on('message', (data: ArrayBuffer, isBinary: boolean) => {
          ws.send(isBinary ? data : Buffer.from(data).toString('utf-8'));
        });
        let refused = false;
        upstream.on('unexpected-response', (_req, res) => {
          refused = true;
          upstream.terminate();
          if (res.statusCode === 401 && !retried) {
            retried = true;
            void refresh(session).then(result => {
              if (result && !clientClosed) openUpstream(ws);
              else ws.close(session.revoked ? 4401 : 1011);
            });
          } else {
            ws.close(1011);
          }
        });
        upstream.on('close', (code: number) => {
          if (refused || live.upstream !== upstream || clientClosed) return;
          ws.close(code >= 1000 && code < 5000 && code !== 1005 && code !== 1006 ? code : 1011);
        });
        upstream.on('error', () => {
          // `close` follows; `unexpected-response` handles refused handshakes.
        });
      };

      return {
        onOpen(_event, ws) {
          live.client = ws;
          let set = liveSockets.get(session.id);
          if (!set) liveSockets.set(session.id, (set = new Set()));
          set.add(live);
          startRevalidation(session);
          openUpstream(ws);
        },
        onMessage(event, ws) {
          const data = event.data as ArrayBuffer | string;
          const upstream = live.upstream;
          if (upstream?.readyState === WebSocketClient.OPEN) {
            upstream.send(data);
            return;
          }
          pendingBytes += typeof data === 'string' ? data.length : data.byteLength;
          if (pendingBytes > MAX_PENDING_CLIENT_BYTES) {
            ws.close(1009, 'Message too big');
            return;
          }
          pending.push(data);
        },
        onClose() {
          clientClosed = true;
          live.upstream?.terminate();
          const set = liveSockets.get(session.id);
          set?.delete(live);
          if (set && set.size === 0) {
            liveSockets.delete(session.id);
            const timer = revalidators.get(session.id);
            if (timer) clearInterval(timer);
            revalidators.delete(session.id);
          }
        },
      };
    }),
  );

  // ---- 4. Asset proxy --------------------------------------------------------------------------
  const proxyAsset = async (c: Context) => {
    const computerId = computerIdOf(c);
    const session = sessions.touch(getCookie(c, SESSION_COOKIE), computerId);
    if (!session) return c.text('Unauthorized', 401);

    const pathname = new URL(c.req.url).pathname;
    const rawSegment = pathname.split('/')[2] ?? '';
    const remainder = pathname.slice(`/computer/${rawSegment}/`.length);
    if (isUnsafeRemainder(remainder)) return c.text('Bad Request', 400);

    if (Date.now() - session.resolvedAt >= VIEWER_REFRESH_AFTER_MS && !(await refresh(session))) {
      return c.text(session.revoked ? 'Unauthorized' : 'Bad Gateway', session.revoked ? 401 : 502);
    }

    const send = async (target: ComputerViewerTarget) => {
      const url = new URL(remainder, target.base);
      url.search = '';
      if (url.origin !== target.base.origin || !url.pathname.startsWith(target.base.pathname)) return undefined;
      const headers = new Headers(target.headers);
      for (const name of FORWARDED_REQUEST_HEADERS) {
        const value = c.req.header(name);
        if (value) headers.set(name, value);
      }
      const controller = new AbortController();
      const onAbort = () => controller.abort();
      c.req.raw.signal.addEventListener('abort', onAbort, { once: true });
      const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
      try {
        return await fetch(url, { method: c.req.method, headers, redirect: 'manual', signal: controller.signal });
      } finally {
        clearTimeout(timer);
      }
    };

    let upstream: Response | undefined;
    try {
      const sentWith = session.viewer;
      upstream = await send(sentWith);
      if (upstream?.status === 401) {
        await upstream.body?.cancel();
        // Another request may already have refreshed the viewer while this one was in flight.
        const refreshed = session.viewer !== sentWith ? session : await refresh(session);
        if (!refreshed) {
          return c.text(session.revoked ? 'Unauthorized' : 'Bad Gateway', session.revoked ? 401 : 502);
        }
        upstream = await send(refreshed.viewer);
      }
    } catch {
      return c.text('Bad Gateway', 502);
    }
    if (!upstream) return c.text('Bad Request', 400);
    if (upstream.status >= 300 && upstream.status < 400 && upstream.status !== 304) {
      await upstream.body?.cancel();
      return c.text('Bad Gateway', 502);
    }

    const headers = new Headers({
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': `frame-ancestors 'self' ${session.studioOrigin}`,
    });
    for (const name of FORWARDED_RESPONSE_HEADERS) {
      const value = upstream.headers.get(name);
      if (value) headers.set(name, value);
    }
    const noBody = c.req.method === 'HEAD' || upstream.status === 204 || upstream.status === 304;
    if (noBody) await upstream.body?.cancel();
    return new Response(noBody ? null : upstream.body, { status: upstream.status, headers });
  };

  app.on(['GET', 'HEAD'], '/computer/:computerId/*', requireComputers, proxyAsset);

  return {
    injectWebSocket: webSocket.injectWebSocket,
    close: () => {
      for (const id of [...liveSockets.keys()]) closeSessionSockets(id, 1001, 'server closing');
    },
  };
}
