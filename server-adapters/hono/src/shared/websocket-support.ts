import type { createNodeWebSocket as CreateNodeWebSocket } from '@hono/node-ws';
import type { Hono } from 'hono';

/**
 * One `@hono/node-ws` instance shared by every WebSocket route on an app.
 *
 * `injectWebSocket` installs a single `upgrade` listener that answers every
 * upgrade it has no matching `upgradeWebSocket` route for by ending the socket,
 * so two instances on one server would reject each other's upgrades. Route
 * families (browser stream, computer stream) must therefore share one.
 *
 * @internal
 */
export interface WebSocketSupport {
  injectWebSocket: (server: unknown) => void;
  upgradeWebSocket: ReturnType<typeof CreateNodeWebSocket>['upgradeWebSocket'];
}

/**
 * Create the shared WebSocket support for `app`, or `null` when `@hono/node-ws`
 * (and its `ws` dependency) can't be loaded, e.g. outside Node.
 *
 * @internal
 */
export async function createWebSocketSupport(app: Hono<any, any, any>): Promise<WebSocketSupport | null> {
  // Dynamic import to avoid bundling ws into non-Node environments (e.g. Cloudflare Workers).
  // The variable-based specifier prevents bundlers from resolving the module at build time.
  let createNodeWebSocket: typeof CreateNodeWebSocket;
  try {
    const mod = '@hono/node-ws';
    const honoNodeWs = await import(/* @vite-ignore */ /* webpackIgnore: true */ mod);
    createNodeWebSocket = honoNodeWs.createNodeWebSocket;
  } catch {
    return null;
  }

  const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });
  return { injectWebSocket: injectWebSocket as (server: unknown) => void, upgradeWebSocket };
}
