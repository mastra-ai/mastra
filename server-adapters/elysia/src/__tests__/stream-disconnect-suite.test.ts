import { node } from '@elysiajs/node';
import { Mastra } from '@mastra/core/mastra';
import { createStreamDisconnectTestSuite } from '@mastra/server-adapters-test-suite';
import { Elysia } from 'elysia';
import { MastraServer } from '../index';
import { listenWithNodeAdapter } from './helpers';

// Served through Elysia's official Node adapter over a real socket.
createStreamDisconnectTestSuite({
  startServer: async (route, { beforeContext } = {}) => {
    const app = new Elysia({ adapter: node() });
    if (beforeContext) {
      app.onRequest(beforeContext);
    }

    const adapter = new MastraServer({ app, mastra: new Mastra({ logger: false }) });
    adapter.registerContextMiddleware();
    await adapter.registerRoute(app, route, { prefix: '' });
    const { baseUrl, close } = await listenWithNodeAdapter(app);
    return { url: `${baseUrl}${route.path}`, close };
  },
});
