import { createCustomRouteDisconnectTestSuite } from '@mastra/server-adapters-test-suite';
import { Elysia } from 'elysia';

import { MastraServer } from '../index';
import { startElysiaServer } from './helpers';

createCustomRouteDisconnectTestSuite({
  suiteName: 'Elysia custom route client disconnect',
  startServer: async mastra => {
    const app = new Elysia();
    await new MastraServer({ app, mastra }).init();
    const { baseUrl, server, cleanup } = await startElysiaServer(app);
    return {
      baseUrl,
      close: async () => {
        server.closeAllConnections();
        await cleanup();
      },
    };
  },
});
