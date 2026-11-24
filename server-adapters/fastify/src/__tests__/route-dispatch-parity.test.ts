import { createRouteDispatchParityTestSuite } from '@mastra/server-adapters-test-suite';
import Fastify from 'fastify';

import { MastraServer } from '../index';

createRouteDispatchParityTestSuite({
  suiteName: 'Fastify route dispatch parity',
  startServer: async (mastra, options) => {
    const app = Fastify({ logger: false });
    await new MastraServer({ app, mastra, prefix: options?.prefix }).init();
    const address = await app.listen({ port: 0 });
    return { request: (path, init) => fetch(`${address}${path}`, init), close: () => app.close() };
  },
});
