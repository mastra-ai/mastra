import { createCustomRouteFGATestSuite } from '@mastra/server-adapters-test-suite';
import { Elysia } from 'elysia';

import { MastraServer } from '../index';
import { startElysiaServer } from './helpers';

createCustomRouteFGATestSuite({
  suiteName: 'Elysia custom route FGA',
  startServer: async mastra => {
    const app = new Elysia();
    await new MastraServer({ app, mastra }).init();
    const { baseUrl, cleanup } = await startElysiaServer(app);
    return { request: (path, init) => fetch(`${baseUrl}${path}`, init), close: cleanup };
  },
});
