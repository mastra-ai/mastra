import { createKnowledgeRoutesTestSuite } from '@mastra/server-adapters-test-suite';
import { Hono } from 'hono';

import { MastraServer } from '../index';

createKnowledgeRoutesTestSuite({
  suiteName: 'Hono Knowledge routes',
  startServer: async mastra => {
    const app = new Hono();
    await new MastraServer({ app, mastra }).init();
    return { request: (path, init) => Promise.resolve(app.request(`http://localhost${path}`, init)) };
  },
});
