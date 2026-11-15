import { Mastra } from '@mastra/core/mastra';
import { createTool } from '@mastra/core/tools';
import type { ServerRoute } from '@mastra/server/server-adapter';
import { createRoute, dispatchRoute, SERVER_ROUTES } from '@mastra/server/server-adapter';
import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';

import { MastraServer } from '../index';

/** An adapter subclass that closes tool routes to everyone, on top of the configured RBAC. */
class ToolsLockedServer extends MastraServer {
  protected checkRoutePermission(...args: Parameters<MastraServer['checkRoutePermission']>) {
    const [route] = args;
    if (route.path.startsWith('/tools')) {
      return { status: 403, error: 'Forbidden', message: 'Tools are locked on this server' };
    }
    return super.checkRoutePermission(...args);
  }
}

describe('Hono adapter - checkRoutePermission override', () => {
  const listTools = SERVER_ROUTES.find(route => route.method === 'GET' && route.path === '/tools') as ServerRoute;

  async function start() {
    const probe = createRoute({
      method: 'ALL',
      path: '/__dispatch',
      responseType: 'json',
      handler: async ({ mastra, requestContext, abortSignal, request }) =>
        dispatchRoute(listTools, {}, { mastra, requestContext, abortSignal, request }),
    });
    const mastra = new Mastra({
      logger: false,
      tools: {
        echo: createTool({
          id: 'echo',
          description: 'Echoes its input',
          inputSchema: z.object({ text: z.string() }),
          execute: async ({ text }) => ({ echoed: text }),
        }),
      },
      server: {
        auth: { authenticateToken: async (token: string) => (token === 'valid' ? { id: 'user-1' } : null) },
        apiRoutes: [probe as any],
      },
    });
    const app = new Hono();
    await new ToolsLockedServer({ app: app as any, mastra }).init();
    return (path: string) => app.request(path, { headers: { authorization: 'Bearer valid' } });
  }

  it('applies the override to HTTP requests and to routes dispatched in-process', async () => {
    const request = await start();

    const http = await request('/api/tools');
    expect(http.status).toBe(403);
    expect(await http.json()).toEqual({ error: 'Forbidden', message: 'Tools are locked on this server' });

    expect(await (await request('/__dispatch')).json()).toEqual({
      ok: false,
      status: 403,
      body: { error: 'Forbidden', message: 'Tools are locked on this server' },
    });

    // Routes the override leaves alone still work.
    expect((await request('/api/agents')).status).toBe(200);
  });
});
