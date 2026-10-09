import type { Mastra } from '@mastra/core/mastra';
import { Hono } from 'hono';

/**
 * Mounts the Mastra instance's merged `server.apiRoutes` (which include every
 * channel route contributed by the `channels()` resolver) onto a Hono app,
 * registering handlers exactly the way `@mastra/server`'s adapter does:
 * `route.handler` when present, otherwise `await route.createHandler({ mastra })`.
 *
 * The returned app dispatches requests through real Hono routing into the
 * real channel handlers — webhook payloads hit the same code path a deployed
 * server would run. Auth middleware is intentionally not replicated; the
 * suite asserts each route's `requiresAuth` flag instead and only ever
 * requests webhook routes (which are `requiresAuth: false` by design).
 */
export async function mountChannelRoutes(mastra: Mastra): Promise<Hono> {
  const app = new Hono();
  const routes = mastra.getServer()?.apiRoutes ?? [];
  for (const route of routes) {
    const handler =
      'handler' in route && route.handler
        ? route.handler
        : 'createHandler' in route && route.createHandler
          ? await route.createHandler({ mastra })
          : undefined;
    if (!handler) continue;
    if (route.method === 'ALL') {
      app.all(route.path, handler as never);
    } else {
      app.on(route.method, route.path, handler as never);
    }
  }
  return app;
}
