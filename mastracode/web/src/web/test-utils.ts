import type { ApiRoute } from '@mastra/core/server';
import type { Hono } from 'hono';

/**
 * Test-only helper: register a list of Mastra `ApiRoute` entries onto a plain
 * Hono app. In production these routes are handed to Mastra as `server.apiRoutes`
 * and mounted by the Hono adapter's `registerCustomApiRoutes()`. Tests that drive
 * the route handlers directly use this to mount them on a bare Hono app so they
 * can assert HTTP behavior at the same `/web/...` paths the adapter serves.
 */
export function mountApiRoutes(app: Hono<any>, routes: ApiRoute[]): void {
  for (const route of routes) {
    const handler = 'handler' in route ? route.handler : undefined;
    if (!handler) continue;
    app.on(route.method, route.path, handler as never);
  }
}
