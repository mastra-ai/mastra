import { Mastra } from '@mastra/core/mastra';
import { createStreamDisconnectTestSuite } from '@mastra/server-adapters-test-suite';
import Fastify from 'fastify';
import { MastraServer } from '../index';

createStreamDisconnectTestSuite({
  startServer: async (route, { beforeContext } = {}) => {
    const app = Fastify();
    const adapter = new MastraServer({ app, mastra: new Mastra({ logger: false }) });
    if (beforeContext) app.addHook('onRequest', beforeContext);
    app.addHook('preHandler', adapter.createContextMiddleware());
    await adapter.registerRoute(app, route, { prefix: '' });
    await app.listen({ port: 0, host: '127.0.0.1' });
    const address = app.server.address();
    if (!address || typeof address === 'string') throw new Error('Expected TCP listener');
    return {
      url: `http://127.0.0.1:${address.port}${route.path}`,
      close: async () => {
        app.server.closeAllConnections();
        await app.close();
      },
    };
  },
});
