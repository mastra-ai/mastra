import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Mastra } from '@mastra/core/mastra';
import { RequestContext } from '@mastra/core/request-context';
import { createTool } from '@mastra/core/tools';
import type { ServerRoute } from '@mastra/server/server-adapter';
import { createRoute, dispatchRoute, SERVER_ROUTES } from '@mastra/server/server-adapter';
import express from 'express';
import { afterEach, describe, expect, it } from 'vitest';
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

const listTools = SERVER_ROUTES.find(route => route.method === 'GET' && route.path === '/tools') as ServerRoute;

describe('Express adapter - checkRoutePermission override with two adapters on one Mastra', () => {
  const servers: Server[] = [];

  afterEach(async () => {
    await Promise.all(servers.splice(0).map(server => new Promise<void>(resolve => server.close(() => resolve()))));
  });

  async function listen(app: express.Express) {
    const server: Server = await new Promise(resolve => {
      const s = app.listen(0, () => resolve(s));
    });
    servers.push(server);
    const { port } = server.address() as AddressInfo;
    return (path: string) => fetch(`http://localhost:${port}${path}`, { headers: { authorization: 'Bearer valid' } });
  }

  it('keeps each adapter’s own denial in-process when both serve the same prefix', async () => {
    // A route running a built-in route in-process, the way the built-in MCP endpoint (served
    // under the adapter's prefix) does. Custom routes are served unprefixed, so name the prefix.
    const probe = createRoute({
      method: 'ALL',
      path: '/__dispatch',
      responseType: 'json',
      handler: async ({ mastra, requestContext, abortSignal, request }) =>
        dispatchRoute(listTools, {}, { mastra, requestContext, abortSignal, request, routePrefix: '/api' }),
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

    const lockedApp = express();
    lockedApp.use(express.json());
    await new ToolsLockedServer({ app: lockedApp, mastra, prefix: '/api' }).init();
    const openApp = express();
    openApp.use(express.json());
    await new MastraServer({ app: openApp, mastra, prefix: '/api' }).init();

    const locked = await listen(lockedApp);
    const open = await listen(openApp);

    expect((await locked('/api/tools')).status).toBe(403);
    expect(await (await locked('/__dispatch')).json()).toEqual({
      ok: false,
      status: 403,
      body: { error: 'Forbidden', message: 'Tools are locked on this server' },
    });

    expect((await open('/api/tools')).status).toBe(200);
    expect(await (await open('/__dispatch')).json()).toMatchObject({ ok: true });

    // Outside a request either adapter served, the prefix alone can't say whose policy applies.
    const requestContext = new RequestContext();
    requestContext.set('mastra__user', { id: 'user-1' });
    await expect(
      dispatchRoute(
        listTools,
        {},
        {
          mastra,
          requestContext,
          abortSignal: new AbortController().signal,
          routePrefix: '/api',
        },
      ),
    ).rejects.toThrow(/cannot tell which path GET \/tools is served under/);
  });
});
