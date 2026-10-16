import type { createNodeWebSocket as CreateNodeWebSocket } from '@hono/node-ws';
import type { Mastra } from '@mastra/core/mastra';
import { handleInputMessage, ViewerRegistry } from '@mastra/server/browser-stream';
import type { BrowserStreamConfig, BrowserStreamResult } from '@mastra/server/browser-stream';
import type { Context, Env, Hono, MiddlewareHandler, Schema } from 'hono';
import { bodyLimit } from 'hono/body-limit';

import { createAuthMiddleware } from '../auth-middleware';
import { UpgradeTicketStore } from './upgrade-tickets';

const TICKET_BODY_MAX_BYTES = 4 * 1024;

/**
 * Allowed `Origin` values for browser WebSocket upgrades. Accepts the same shape
 * as Hono's `cors.origin` option.
 */
export type BrowserStreamOrigin =
  | string
  | string[]
  | ((origin: string, c: Context) => Promise<string | undefined | null> | string | undefined | null);

/**
 * Hono-specific browser stream configuration.
 */
export interface HonoBrowserStreamConfig extends BrowserStreamConfig {
  /**
   * Mastra instance used to authenticate requests to the browser stream routes.
   *
   * Every route registered by {@link setupBrowserStream} — the WebSocket upgrade,
   * the session probe, the close endpoint, and the upgrade-ticket endpoint — is
   * gated by the server auth middleware. Without this, an unauthenticated caller
   * could watch and drive an agent's browser. When the instance has no
   * `server.auth` configured the middleware is a no-op.
   */
  mastra: Mastra;

  /**
   * Origin allowlist for the browser WebSocket upgrade.
   *
   * Browsers always send an `Origin` header on a WebSocket handshake and attach
   * the session cookie to it, so without an allowlist a page on any origin could
   * open a cookie-authenticated stream and drive the agent's browser. When this is
   * set, an upgrade from an origin that isn't allowed is rejected with `403`.
   *
   * Values are matched the way Hono's `cors.origin` matches them: array entries
   * literally, and a callback only approves an origin when it returns that same
   * origin (or `'*'`). The server's own origin always passes, because a CORS
   * allowlist names the *other* origins and never includes the server itself.
   *
   * Requests without an `Origin` header (non-browser clients) are not affected,
   * and the check is skipped entirely when this is unset. The deployer passes the
   * explicitly configured `server.cors.origin` here; its permissive default is
   * left as-is so cross-origin Studio deployments keep working.
   */
  allowedOrigins?: BrowserStreamOrigin;
}

/**
 * Resolve an `allowedOrigins` value against the request's `Origin` header.
 *
 * Mirrors Hono's `cors.origin` semantics so the same config value means the same
 * thing on the upgrade as it does on the HTTP routes: `'*'` allows everything,
 * array entries match literally, and a callback is only an approval when it
 * returns the request's own origin (the value Hono would echo back) or `'*'`.
 */
async function isOriginAllowed(allowedOrigins: BrowserStreamOrigin, origin: string, c: Context): Promise<boolean> {
  if (Array.isArray(allowedOrigins)) {
    return allowedOrigins.includes(origin);
  }
  if (typeof allowedOrigins === 'function') {
    const allowed = await allowedOrigins(origin, c);
    return allowed === origin || allowed === '*';
  }
  return allowedOrigins === '*' || allowedOrigins === origin;
}

/**
 * Is the `Origin` header the server's own origin?
 *
 * A Studio served by this server connects back to the same host, and operators
 * don't add their own origin to a CORS allowlist because same-origin requests
 * never needed CORS. Comparing hosts (rather than scheme + host) keeps that
 * working behind TLS-terminating proxies, where the server sees `http` while the
 * browser sends `https`.
 */
function isSameOrigin(origin: string, requestHost: string | undefined): boolean {
  if (!requestHost) {
    return false;
  }
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return false;
  }
  // `x-forwarded-host` may list several hosts; the first is the client-facing one.
  const host = (requestHost.split(',')[0] ?? '').trim();
  return originHost !== '' && originHost.toLowerCase() === host.toLowerCase();
}

/**
 * Set up WebSocket-based browser stream endpoint for real-time screencast viewing.
 *
 * Creates a WebSocket route at `/browser/:agentId/stream` that:
 * - Accepts viewer connections
 * - Starts screencast when first viewer connects
 * - Broadcasts frames to all connected viewers
 * - Stops screencast when last viewer disconnects
 *
 * All routes are authenticated with the server's auth configuration. Browsers
 * cannot attach an `Authorization` header to a WebSocket upgrade, so
 * session-cookie providers authenticate from the upgrade request's cookies.
 * Clients that authenticate with a header token instead request a short-lived,
 * single-use ticket from `POST ${apiPrefix}/agents/:agentId/browser/stream-ticket`
 * and pass it to the upgrade as `?ticket=`, which keeps the reusable credential
 * out of the URL. Non-browser clients can pass the token as the `apiKey` query
 * parameter — use a short-lived token, since a URL can be retained in proxy and
 * access logs, and prefer the `Authorization` header on the HTTP routes where the
 * client can set one.
 *
 * **Note**: Requires `ws` package to be installed. If not available, returns null
 * and logs a warning. Browser streaming will be disabled but everything else works.
 *
 * @param app - The Hono application instance
 * @param config - Configuration for browser stream
 * @returns Object containing injectWebSocket function and registry instance, or null if ws is not available
 *
 * @example
 * ```typescript
 * import { Hono } from 'hono';
 * import { serve } from '@hono/node-server';
 * import { setupBrowserStream } from '@mastra/hono';
 *
 * const app = new Hono();
 * const browserStream = await setupBrowserStream(app, {
 *   mastra,
 *   getToolset: (agentId) => browserToolsets.get(agentId),
 * });
 *
 * const server = serve({ fetch: app.fetch, port: 4111 });
 * browserStream?.injectWebSocket(server);
 * ```
 */
export async function setupBrowserStream<E extends Env, S extends Schema, B extends string>(
  app: Hono<E, S, B>,
  config: HonoBrowserStreamConfig,
): Promise<BrowserStreamResult | null> {
  // Dynamic import to avoid bundling ws into non-Node environments (e.g. Cloudflare Workers).
  // The variable-based specifier prevents bundlers from resolving the module at build time.
  let createNodeWebSocket: typeof CreateNodeWebSocket;
  try {
    const mod = '@hono/node-ws';
    const honoNodeWs = await import(/* @vite-ignore */ /* webpackIgnore: true */ mod);
    createNodeWebSocket = honoNodeWs.createNodeWebSocket;
  } catch {
    // @hono/node-ws is not available (e.g. no ws package installed).
    // This is expected in non-Node environments — silently disable browser streaming.
    return null;
  }

  const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });
  const registry = new ViewerRegistry();

  // Normalize the API prefix so we can build paths like `${apiPrefix}/agents/...`
  // without producing `//agents/...` when the prefix is missing or has a single
  // trailing slash. Anything weirder than that (e.g. `'/api//'`) is a config
  // bug we don't try to silently fix.
  const rawPrefix = config.apiPrefix ?? '/api';
  const trimmed = rawPrefix.endsWith('/') ? rawPrefix.slice(0, -1) : rawPrefix;
  const apiPrefix = trimmed || '/api';

  // Authenticate every browser stream route before it runs.
  //
  // These routes are registered as raw Hono handlers rather than ServerRoutes, so
  // they never pass through the per-route `checkRouteAuth` middleware the adapter
  // applies elsewhere. Without this gate an unauthenticated caller could open the
  // screencast, inject input, and force-close an agent's browser.
  //
  // The middleware marks the request path as protected itself, which also covers
  // the WebSocket upgrade path (`/browser/:agentId/stream`) that falls outside
  // `apiPrefix`. Because browsers cannot set an `Authorization` header on a
  // WebSocket upgrade, session-cookie providers authenticate from the upgrade
  // request's cookies and token-based clients pass `?apiKey=`.
  const authenticate = createAuthMiddleware({ mastra: config.mastra });

  // Neither of the paths above works for a browser that authenticates with an
  // `Authorization` header: it can't set that header on the handshake, and it
  // doesn't own a session cookie. Putting the token in the handshake URL would
  // leak a reusable credential into proxy and access logs, so such a client
  // instead trades its token for a ticket over an ordinary authenticated HTTP
  // request and presents the ticket on the upgrade.
  //
  // Tickets are per-process, like the viewer registry and browser sessions they
  // authorize: a screencast is served by the process that owns the browser, so a
  // ticket never needs to be understood by another instance.
  const upgradeTickets = new UpgradeTicketStore();

  // Authenticate an upgrade with a ticket when one is presented, and with the
  // regular server auth otherwise. An unusable ticket is rejected outright rather
  // than falling back, so a client can't silently downgrade to another credential.
  const authorizeUpgrade: MiddlewareHandler = async (c, next) => {
    const ticket = c.req.query('ticket');
    if (!ticket) {
      return authenticate(c, next);
    }

    const agentId = c.req.param('agentId')!;
    if (!upgradeTickets.consume(ticket, agentId, c.req.query('threadId'))) {
      return c.json({ error: 'Invalid or expired upgrade ticket' }, 401);
    }

    return next();
  };

  // Reject browser WebSocket upgrades from origins that aren't explicitly
  // allow-listed. Browsers send `Origin` automatically and attach cookies to the
  // handshake, so without this a page on any origin could open a
  // cookie-authenticated stream and drive the agent's browser (CSWSH). Sessions
  // that authenticate with a query token are unaffected in practice, but the
  // check applies to the route rather than the credential. Non-browser clients
  // send no `Origin` and are never blocked, and nothing is enforced unless the
  // server configured an explicit origin.
  const allowedOrigins = config.allowedOrigins;
  const checkOrigin: MiddlewareHandler = async (c, next) => {
    const origin = c.req.header('origin');
    if (!allowedOrigins || !origin) {
      return next();
    }
    // The server's own origin is always allowed, so an origin allowlist (which
    // only ever lists *other* origins) can't lock out the Studio this server serves.
    if (isSameOrigin(origin, c.req.header('x-forwarded-host') ?? c.req.header('host'))) {
      return next();
    }
    if (!(await isOriginAllowed(allowedOrigins, origin, c))) {
      return c.text('Forbidden', 403);
    }
    return next();
  };

  app.get(
    '/browser/:agentId/stream',
    checkOrigin,
    authorizeUpgrade,
    upgradeWebSocket(c => {
      const agentId = c.req.param('agentId')!;
      const threadId = c.req.query('threadId');
      // Use composite key for thread-scoped screencasts
      const viewerKey = threadId ? `${agentId}:${threadId}` : agentId;

      return {
        onOpen(_event, ws) {
          // Send connected status immediately
          ws.send(JSON.stringify({ status: 'connected' }));

          // Add to registry (starts screencast if first viewer)
          // Fire-and-forget: screencast starts asynchronously
          // Pass agentId for toolset lookup, but viewerKey for registry scoping
          void registry.addViewer(viewerKey, ws, config.getToolset, agentId, threadId);
        },

        onMessage(event, _ws) {
          const data = typeof event.data === 'string' ? event.data : null;
          if (data) {
            void handleInputMessage(data, config.getToolset, agentId, threadId);
          }
        },

        onClose(_event, ws) {
          // Remove from registry (stops screencast if last viewer)
          // Fire-and-forget: cleanup is best-effort
          void registry.removeViewer(viewerKey, ws);
        },

        onError(event, ws) {
          console.error('[BrowserStream] WebSocket error:', event);
          // Fire-and-forget: cleanup is best-effort
          void registry.removeViewer(viewerKey, ws);
        },
      };
    }),
  );

  // Trade an authenticated request for a single-use ticket the browser can put
  // on the WebSocket upgrade. This is an ordinary HTTP route, so a
  // header-authenticated client can send its `Authorization` header here and
  // keep that reusable credential out of every URL.
  // The body only carries `{ threadId }`; cap it before parsing because this raw
  // route is outside the per-route body limit applied to registered API routes.
  const ticketBodyLimit = bodyLimit({
    maxSize: TICKET_BODY_MAX_BYTES,
    onError: c => c.json({ error: 'Request body too large' }, 413),
  });
  app.post(`${apiPrefix}/agents/:agentId/browser/stream-ticket`, authenticate, ticketBodyLimit, async c => {
    const agentId = c.req.param('agentId');
    if (!agentId) {
      return c.json({ error: 'Agent ID is required' }, 400);
    }

    // Studio sends `{ threadId }`; the query string is accepted as well so the
    // route is usable from clients that can't send a body.
    let threadId = c.req.query('threadId');
    try {
      const body = await c.req.json();
      if (!threadId && typeof body?.threadId === 'string') {
        threadId = body.threadId;
      }
    } catch {
      // No body or invalid JSON - mint an agent-scoped ticket.
    }

    // Tickets are cheap, not free: without a bound this route lets any caller
    // grow the process's memory and per-mint work with request volume.
    const issued = upgradeTickets.issue(agentId, threadId);
    if (!issued.ok) {
      const error =
        issued.reason === 'capacity'
          ? 'Too many outstanding browser stream upgrade tickets'
          : 'Too many browser stream upgrade tickets requested';
      return c.json({ error }, 429);
    }

    return c.json({ ticket: issued.ticket, expiresIn: issued.expiresIn });
  });

  // Browser session probe endpoint - tells the client whether to open a WS.
  // Returns:
  //   - screencastAvailable: true (this route only exists if setupBrowserStream succeeded)
  //   - hasSession: whether the agent has an active browser session for the given thread
  app.get(`${apiPrefix}/agents/:agentId/browser/session`, authenticate, async c => {
    const agentId = c.req.param('agentId');
    if (!agentId) {
      return c.json({ error: 'Agent ID is required' }, 400);
    }

    const threadId = c.req.query('threadId');
    const toolset = await config.getToolset(agentId);

    if (!toolset) {
      return c.json({ hasSession: false, screencastAvailable: true });
    }

    const hasSession = threadId ? toolset.hasThreadSession(threadId) : false;
    return c.json({ hasSession, screencastAvailable: true });
  });

  // Close browser session endpoint
  app.post(`${apiPrefix}/agents/:agentId/browser/close`, authenticate, ticketBodyLimit, async c => {
    const agentId = c.req.param('agentId');
    if (!agentId) {
      return c.json({ error: 'Agent ID is required' }, 400);
    }

    const toolset = await config.getToolset(agentId);
    if (!toolset) {
      return c.json({ error: 'No browser session for this agent' }, 404);
    }

    try {
      // Parse threadId from request body
      let threadId: string | undefined;
      try {
        const body = await c.req.json();
        threadId = body?.threadId;
      } catch {
        // No body or invalid JSON - proceed without threadId
      }

      const scope = toolset.getScope();
      const viewerKey = threadId ? `${agentId}:${threadId}` : agentId;

      // For thread scope with a threadId, close only that thread's session
      if (scope === 'thread' && threadId) {
        // Close the session in the registry (stops screencast for this thread)
        await registry.closeBrowserSession(viewerKey);

        // Close just this thread's browser session
        if ('closeThreadSession' in toolset && typeof toolset.closeThreadSession === 'function') {
          await toolset.closeThreadSession(threadId);
        }
      } else {
        // For shared scope or no threadId, close the entire browser
        await registry.closeBrowserSession(viewerKey);
        await toolset.close();
      }

      return c.json({ success: true });
    } catch (error) {
      console.error(`[BrowserStream] Error closing browser for ${agentId}:`, error);
      return c.json({ error: 'Failed to close browser' }, 500);
    }
  });

  return { injectWebSocket: injectWebSocket as (server: unknown) => void, registry };
}
