import { createCustomRouteFGATestSuite } from '@mastra/server-adapters-test-suite';
import { MastraServer } from '../index';
import { createAdonisRouter, listen } from './helpers';

createCustomRouteFGATestSuite({
  suiteName: 'AdonisJS custom route FGA',
  startServer: async mastra => {
    const app = await createAdonisRouter();
    await new MastraServer({ app, mastra }).init();
    const { url, close } = await listen(app);
    return { request: (path, init) => fetch(`${url}${path}`, init), close };
  },
});
