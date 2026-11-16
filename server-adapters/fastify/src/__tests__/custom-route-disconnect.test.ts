import { createCustomRouteDisconnectTestSuite } from '@mastra/server-adapters-test-suite';
import Fastify from 'fastify';

import { MastraServer } from '../index';

createCustomRouteDisconnectTestSuite({
  suiteName: 'Fastify custom route client disconnect',
  startServer: async mastra => {
    const app = Fastify({ logger: false, forceCloseConnections: true });
    await new MastraServer({ app, mastra }).init();
    const baseUrl = await app.listen({ port: 0, host: '127.0.0.1' });
    return { baseUrl, close: () => app.close() };
  },
});
