import { createRouteDispatchParityTestSuite } from '@mastra/server-adapters-test-suite';
import { Elysia } from 'elysia';

import { MastraServer } from '../index';
import { startElysiaServer } from './helpers';

createRouteDispatchParityTestSuite({
  suiteName: 'Elysia route dispatch parity',
  startServer: async (mastra, options) => {
    const app = new Elysia();
    await new MastraServer({ app, mastra, prefix: options?.prefix }).init();
    const { baseUrl, cleanup } = await startElysiaServer(app);
    return { request: (path, init) => fetch(`${baseUrl}${path}`, init), close: cleanup };
  },
});
