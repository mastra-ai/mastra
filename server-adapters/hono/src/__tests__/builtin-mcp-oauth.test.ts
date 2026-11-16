import { serve } from '@hono/node-server';
import { createBuiltinMCPOAuthTestSuite } from '@mastra/server-adapters-test-suite';
import { Hono } from 'hono';

import { MastraServer } from '../index';

createBuiltinMCPOAuthTestSuite({
  suiteName: 'Hono built-in MCP OAuth',
  startServer: async mastra => {
    const app = new Hono();
    await new MastraServer({ app, mastra }).init();
    const server = serve({ fetch: app.fetch, port: 0 });
    await new Promise(resolve => server.once('listening', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Failed to get server address');
    return {
      url: `http://localhost:${address.port}`,
      close: () => new Promise<void>(resolve => server.close(() => resolve())),
    };
  },
});
