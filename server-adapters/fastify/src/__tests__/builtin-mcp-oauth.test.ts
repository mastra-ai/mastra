import { createBuiltinMCPOAuthTestSuite } from '@mastra/server-adapters-test-suite';
import Fastify from 'fastify';

import { MastraServer } from '../index';

createBuiltinMCPOAuthTestSuite({
  suiteName: 'Fastify built-in MCP OAuth',
  startServer: async mastra => {
    const app = Fastify({ logger: false });
    await new MastraServer({ app, mastra }).init();
    const address = await app.listen({ port: 0, host: '127.0.0.1' });
    return { url: address.replace('127.0.0.1', 'localhost'), close: () => app.close() };
  },
});
