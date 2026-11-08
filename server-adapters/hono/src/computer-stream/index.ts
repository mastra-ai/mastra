import type { Mastra } from '@mastra/core/mastra';
import type { ComputerTicketStore } from '@mastra/server/computer-stream';
import type { Context, Hono, MiddlewareHandler } from 'hono';
import type { WebSocket as WsWebSocket } from 'ws';

import { isOriginAllowed, isSameOrigin, requestHost } from '../shared/origin';
import type { BrowserStreamOrigin } from '../shared/origin';
import { createWebSocketSupport } from '../shared/websocket-support';
import type { WebSocketSupport } from '../shared/websocket-support';
import { ComputerSessionStore } from './sessions';
import type { ComputerSession, ComputerViewerTarget } from './sessions';

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

/** Lease holder for a computer's input, as reported by `mastra.getComputers().controlState`. @experimental */
export type ComputerControlSource = (
  computerId: string,
  scope: { threadId: string; resourceId: string },
) => Promise<{ holder: 'agent' | 'human'; reason?: string }>;

/** Hands a computer to the user or back to the agent; matches `mastra.getComputers().control`. @experimental */
export type ComputerControlSetter = (
  computerId: string,
  scope: { threadId: string; resourceId: string },
  change: { action: 'take' | 'release'; note?: string },
) => Promise<{ holder: 'agent' | 'human'; notified: boolean; reason?: string }>;

/** @experimental */
export interface HonoComputerStreamConfig {
  mastra: Mastra;
  /** Viewer resolver; `undefined` when no computers are registered (routes answer 404). */
  getViewer: ComputerViewerSource | undefined;
  apiPrefix?: string;
  /** Origins other than the server's own that may embed the viewer (same shape as `cors.origin`). */
  allowedOrigins?: BrowserStreamOrigin;
  /** Ticket backend shared with the authenticated JSON mint route. */
  ticketStore: ComputerTicketStore;
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
/** A session whose upgrade never completes is dropped after this long. */
const OPEN_DEADLINE_MS = 10_000;

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
 *   caller may write the thread in the memory store (403 when no memory store
 *   is configured or the thread is unknown) and that the computer is attached
 *   to it, then mints a 30 s single-use ticket.
 * - `GET /computer/:computerId/websockify?ticket=` — WebSocket upgrade from the
 *   same origin that minted the ticket; relays binary RFB frames only (a text
 *   frame from either side closes the socket with 1003).
 * - `GET|POST {apiPrefix}/computers/:computerId/control` — authenticated; reads
 *   (`memory:read`) or changes (`memory:write`, `{ action: 'take'|'release', note? }`)
 *   who holds the computer's input. Mounted only when `getControl` and
 *   `setControl` are given. POST requires a JSON body and, when the browser sends
 *   an `Origin`, a same-origin or allowed one, so a cross-site form can't hand the
 *   desktop over.
 * - Every other `/computer/:computerId/*` request is 404.
 *
 * The upstream auth (the sandbox preview cookie) is added server-side and never
 * reaches the browser. Live sockets are revalidated every 15 s, so releasing a
 * computer from the thread cuts its viewers within that interval; thread
 * permissions are checked when the ticket is minted, not re-checked live.
 *
 * Both modes require write access to the thread: the proxy does not filter RFB
 * input, so "watch" is a display setting on the viewer, not a security boundary.
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

  const { allowedOrigins, ticketStore: tickets } = config;

  interface LiveSocket {
    client: { close: (code?: number, reason?: string) => void };
    upstream?: WsWebSocket;
  }
  const liveSockets = new Map<string, Set<LiveSocket>>();
  const revalidators = new Map<string, ReturnType<typeof setInterval>>();
  const openDeadlines = new Map<string, ReturnType<typeof setTimeout>>();
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
      // Upkeep, not activity: idle sessions still expire.
      if (!sessions.get(session.id, session.computerId)) return;
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

  // ---- WebSocket proxy -------------------------------------------------------------------------
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
    const payload = ticket ? await tickets.consume(ticket, computerId) : undefined;
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
    // If the handshake fails after this point no socket hook runs; free the slot.
    const deadline = setTimeout(() => sessions.end(session), OPEN_DEADLINE_MS);
    deadline.unref?.();
    openDeadlines.set(session.id, deadline);
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
      let pending: ArrayBuffer[] = [];
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
          // RFB is binary; sandbox-controlled text is never decoded or relayed.
          if (!isBinary) {
            upstream.terminate();
            ws.close(1003);
            return;
          }
          ws.send(data);
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
          clearTimeout(openDeadlines.get(session.id));
          openDeadlines.delete(session.id);
          live.client = ws;
          let set = liveSockets.get(session.id);
          if (!set) liveSockets.set(session.id, (set = new Set()));
          set.add(live);
          startRevalidation(session);
          openUpstream(ws);
        },
        onMessage(event, ws) {
          const data = event.data as ArrayBuffer | string;
          if (typeof data === 'string') {
            ws.close(1003, 'binary frames only');
            return;
          }
          sessions.touch(session.id, session.computerId);
          const upstream = live.upstream;
          if (upstream?.readyState === WebSocketClient.OPEN) {
            upstream.send(data);
            return;
          }
          pendingBytes += data.byteLength;
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
