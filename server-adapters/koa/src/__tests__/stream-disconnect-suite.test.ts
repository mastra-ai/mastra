import type { Server } from 'node:http';
import { Mastra } from '@mastra/core/mastra';
import { createStreamDisconnectTestSuite } from '@mastra/server-adapters-test-suite';
import Koa from 'koa';
import bodyParser from 'koa-bodyparser';
import { MastraServer } from '../index';

createStreamDisconnectTestSuite({
  startServer: async (route, { beforeContext } = {}) => {
    const app = new Koa();
    app.use(bodyParser());
    const adapter = new MastraServer({ app, mastra: new Mastra({ logger: false }) });
    if (beforeContext) {
      app.use(async (_ctx, next) => {
        await beforeContext();
        await next();
      });
    }
    app.use(adapter.createContextMiddleware());
    await adapter.registerRoute(app, route, { prefix: '' });
    const server: Server = await new Promise(resolve => {
      const started = app.listen(0, '127.0.0.1', () => resolve(started));
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
