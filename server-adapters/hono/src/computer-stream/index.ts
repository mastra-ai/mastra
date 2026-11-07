import type { Mastra } from '@mastra/core/mastra';
import { MASTRA_RESOURCE_ID_KEY, MASTRA_THREAD_ID_KEY, RequestContext } from '@mastra/core/request-context';
import { enforceThreadAccess } from '@mastra/server/handlers/utils';
import type { Context, Hono, MiddlewareHandler } from 'hono';
import { bodyLimit } from 'hono/body-limit';
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

export const REVALIDATE_INTERVAL_MS = 15_000;
export const MAX_PENDING_CLIENT_BYTES = 1024 * 1024;
const SESSION_BODY_MAX_BYTES = 1024;

class ViewerUnavailable extends Error {}

/**
 * Normalize a viewer URL into the directory its websockify endpoint lives in.
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

function canonicalOrigin(origin: string): string | undefined {
  try {
    return new URL(origin).origin;
  } catch {
    return undefined;
  }
}

function serverOrigin(c: Context): string {
  const forwarded = c.req.header('x-forwarded-proto')?.split(',')[0]?.trim().toLowerCase();
  const https = forwarded === 'https' || new URL(c.req.url).protocol === 'https:';
  const host = (requestHost(c)?.split(',')[0] ?? '').trim();
  return `${https ? 'https' : 'http'}://${host}`;
}

function statusError(error: unknown): number | undefined {
  const status = (error as { status?: unknown })?.status;
  return typeof status === 'number' ? status : undefined;
}

/**
 * WebSocket proxy that streams a computer's live desktop (RFB) to Studio's own
 * noVNC viewer. No sandbox HTTP content is ever served on this origin: the
 * desktop is agent-writable, so its viewer page and scripts are untrusted.
 *
 * - `POST {apiPrefix}/computers/:computerId/session` — authenticated; checks the
 *   caller may read (`watch`) or write (`control`) the thread in the memory store
 *   (403 when no memory store is configured) and that the computer is attached
 *   to it, then mints a 30 s single-use ticket.
 * - `GET /computer/:computerId/websockify?ticket=` — WebSocket upgrade from the
 *   same origin that minted the ticket; relays binary RFB frames to the desktop.
 * - Every other `/computer/:computerId/*` request is 404.
 *
 * The upstream auth (the sandbox preview cookie) is added server-side and never
 * reaches the browser. Live sockets are revalidated every 15 s, so releasing a
 * computer from the thread cuts its viewers within that interval. `watch` is a
 * viewer setting, not a security boundary: a `watch` ticket still needs read
 * access, and control requires a `control` ticket (write access).
 *
 * Requires a long-running Node server that accepts WebSocket upgrades (not
 * serverless). Sockets are in-process, so multi-instance deployments need
 * sticky routing.
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
      if (!sessions.touch(session.id, session.computerId)) return;
      void refresh(session).then(result => {
        if (!result && !session.revoked) closeSessionSockets(session.id, 1011, 'computer unavailable');
      });
    }, REVALIDATE_INTERVAL_MS);
    timer.unref?.();
    revalidators.set(session.id, timer);
  };

  const computerIdOf = (c: Context) => c.req.param('computerId')!;

  const requireComputers: MiddlewareHandler = async (c, next) => {
    if (!config.getViewer) return c.json({ error: 'No computers are registered' }, 404);
    return next();
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

      // No memory store means no thread-access check, which means no access.
      const memoryStore = await mastra.getStorage()?.getStore('memory');
      if (!memoryStore) return c.json({ state: 'forbidden' }, 403);
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
        socketUrl: `/computer/${encodeURIComponent(computerId)}/websockify?ticket=${encodeURIComponent(issued.ticket)}`,
      });
    },
  );

  // ---- 3. WebSocket proxy ----------------------------------------------------------------------
  const authorizeSocket: MiddlewareHandler = async (c, next) => {
    if (c.req.header('upgrade')?.toLowerCase() !== 'websocket') return c.text('Not Found', 404);
    const origin = c.req.header('origin');
    const originAllowed =
      !!origin &&
      (isSameOrigin(origin, requestHost(c)) ||
        (allowedOrigins !== undefined && (await isOriginAllowed(allowedOrigins, origin, c))));
    if (!originAllowed) return c.text('Forbidden', 403);
    // noVNC requests no subprotocol by default; older clients ask for `binary`. Anything else is refused.
    const protocols = (c.req.header('sec-websocket-protocol') ?? '')
      .split(',')
      .map(p => p.trim())
      .filter(Boolean);
    if (protocols.some(p => p !== 'binary')) return c.text('Bad Request', 400);
    const computerId = computerIdOf(c);
    const ticket = c.req.query('ticket');
    const payload = ticket ? tickets.consume(ticket, computerId) : undefined;
    // The ticket only works from the origin that minted it.
    if (!payload || canonicalOrigin(origin) !== payload.studioOrigin) return c.text('Unauthorized', 401);
    if (!sessions.hasCapacity(computerId)) return c.text('Too Many Requests', 429);
    // Every socket open re-checks the attachment.
    let viewer: ComputerViewerTarget;
    try {
      const resolved = await config.getViewer!(computerId, { threadId: payload.threadId, resourceId: payload.resourceId });
      if (!resolved) return c.text('Bad Gateway', 502);
      viewer = viewerTarget(resolved);
    } catch (error) {
      return error instanceof ViewerUnavailable ? c.text('Bad Gateway', 502) : c.text('Unauthorized', 401);
    }
    const session = sessions.insert({ ...payload, viewer });
    if (!session) return c.text('Too Many Requests', 429);
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

      const upstreamProtocols = c.req.header('sec-websocket-protocol') ? ['binary'] : [];
      const openUpstream = (ws: { send: (data: ArrayBuffer | string) => void; close: (code?: number) => void }) => {
        const upstream = new WebSocketClient(upstreamSocketUrl(session.viewer.base), upstreamProtocols, {
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
          sessions.end(session);
        },
      };
    }),
  );

  // ---- 3. Nothing else: sandbox HTTP content is never served on this origin -----------------
  app.all('/computer/:computerId/*', c => c.text('Not Found', 404));

  return {
    injectWebSocket: webSocket.injectWebSocket,
    close: () => {
      for (const id of [...liveSockets.keys()]) closeSessionSockets(id, 1001, 'server closing');
    },
  };
}
