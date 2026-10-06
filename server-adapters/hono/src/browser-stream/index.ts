import type { createNodeWebSocket as CreateNodeWebSocket } from '@hono/node-ws';
import type { Mastra } from '@mastra/core/mastra';
import { handleInputMessage, ViewerRegistry } from '@mastra/server/browser-stream';
import type { BrowserStreamConfig, BrowserStreamResult } from '@mastra/server/browser-stream';
import type { Context, Env, Hono, MiddlewareHandler, Schema } from 'hono';

import { createAuthMiddleware } from '../auth-middleware';

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
   * the session probe, and the close endpoint — is gated by the server auth
   * middleware. Without this, an unauthenticated caller could watch and drive an
   * agent's browser. When the instance has no `server.auth` configured the
   * middleware is a no-op.
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
   * Requests without an `Origin` header (non-browser clients) are not affected,
   * and the check is skipped entirely when this is unset. The deployer passes the
   * explicitly configured `server.cors.origin` here; its permissive default is
   * left as-is so cross-origin Studio deployments keep working.
   */
  allowedOrigins?: BrowserStreamOrigin;
}

/**
 * Resolve an `allowedOrigins` value against the request's `Origin` header.
 */
async function isOriginAllowed(allowedOrigins: BrowserStreamOrigin, origin: string, c: Context): Promise<boolean> {
  if (allowedOrigins === '*') {
    return true;
  }
  if (typeof allowedOrigins === 'string') {
    return allowedOrigins === origin;
  }
  if (Array.isArray(allowedOrigins)) {
    return allowedOrigins.includes('*') || allowedOrigins.includes(origin);
  }
  return Boolean(await allowedOrigins(origin, c));
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
 * Non-browser clients can pass the token as the `apiKey` query parameter — use a
 * short-lived token, since a URL can be retained in proxy and access logs, and
 * prefer the `Authorization` header on the HTTP routes where the client can set one.
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
    if (!(await isOriginAllowed(allowedOrigins, origin, c))) {
      return c.text('Forbidden', 403);
    }
    return next();
  };

  app.get(
    '/browser/:agentId/stream',
    checkOrigin,
    authenticate,
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
  app.post(`${apiPrefix}/agents/:agentId/browser/close`, authenticate, async c => {
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
