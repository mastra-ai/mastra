import { createRouteDispatchParityTestSuite } from '@mastra/server-adapters-test-suite';
import { Hono } from 'hono';

import { MastraServer } from '../index';

createRouteDispatchParityTestSuite({
  suiteName: 'Hono route dispatch parity',
  startServer: async (mastra, options) => {
    const app = new Hono();
    await new MastraServer({ app, mastra, prefix: options?.prefix }).init();
    return { request: (path, init) => Promise.resolve(app.request(`http://localhost${path}`, init)) };
  },
});
