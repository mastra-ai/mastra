import type { Server } from 'node:http';
import { serve } from '@hono/node-server';
import { Mastra } from '@mastra/core/mastra';
import { createStreamDisconnectTestSuite } from '@mastra/server-adapters-test-suite';
import { Hono } from 'hono';
import { MastraServer } from '../index';
import type { HonoBindings, HonoVariables } from '../index';

createStreamDisconnectTestSuite({
  startServer: async (route, { beforeContext } = {}) => {
    const app = new Hono<{ Bindings: HonoBindings; Variables: HonoVariables }>();
    const adapter = new MastraServer({ app, mastra: new Mastra({ logger: false }) });
    if (beforeContext) {
      app.use('*', async (_c, next) => {
        await beforeContext();
        await next();
      });
    }
    app.use('*', adapter.createContextMiddleware());
    await adapter.registerRoute(app, route, { prefix: '' });
    const server = await new Promise<Server>(resolve => {
      const started = serve({ fetch: app.fetch, hostname: '127.0.0.1', port: 0 }, () => resolve(started as Server));
    });
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Expected TCP listener');
    return {
      url: `http://127.0.0.1:${address.port}${route.path}`,
      close: async () => {
        server.closeAllConnections();
        await new Promise<void>(resolve => server.close(() => resolve()));
      },
    };
  },
});
