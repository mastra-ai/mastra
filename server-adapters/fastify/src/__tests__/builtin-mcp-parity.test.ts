import { createBuiltinMCPParityTestSuite } from '@mastra/server-adapters-test-suite';
import Fastify from 'fastify';

import { MastraServer } from '../index';

createBuiltinMCPParityTestSuite({
  suiteName: 'Fastify built-in MCP server',
  startServer: async mastra => {
    // Drop idle client sockets on close (an aborted MCP call can leave one behind).
    const app = Fastify({ logger: false, forceCloseConnections: true });
    await new MastraServer({ app, mastra }).init();
    const address = await app.listen({ port: 0, host: '127.0.0.1' });
    return { url: address.replace('127.0.0.1', 'localhost'), close: () => app.close() };
  },
});
