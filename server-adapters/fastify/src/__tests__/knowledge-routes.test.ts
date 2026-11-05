import { createKnowledgeRoutesTestSuite } from '@mastra/server-adapters-test-suite';
import Fastify from 'fastify';

import { MastraServer } from '../index';

createKnowledgeRoutesTestSuite({
  suiteName: 'Fastify Knowledge routes',
  startServer: async mastra => {
    const app = Fastify({ logger: false });
    await new MastraServer({ app, mastra }).init();
    const address = await app.listen({ port: 0 });
    return { request: (path, init) => fetch(`${address}${path}`, init), close: () => app.close() };
  },
});
