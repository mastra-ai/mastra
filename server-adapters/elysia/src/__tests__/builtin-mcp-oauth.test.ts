import { createBuiltinMCPOAuthTestSuite } from '@mastra/server-adapters-test-suite';
import { Elysia } from 'elysia';

import { MastraServer } from '../index';
import { startElysiaServer } from './helpers';

createBuiltinMCPOAuthTestSuite({
  suiteName: 'Elysia built-in MCP OAuth',
  startServer: async mastra => {
    const app = new Elysia();
    await new MastraServer({ app, mastra }).init();
    const { baseUrl, cleanup } = await startElysiaServer(app);
    return { url: baseUrl, close: cleanup };
  },
});
