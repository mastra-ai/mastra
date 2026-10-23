import type { Mastra } from '@mastra/core/mastra';
import { createMCPTransportTestSuite } from '@mastra/server-adapters-test-suite';
import { describe } from 'vitest';
import { MastraServer } from '../index';
import { createAdonisRouter, listen } from './helpers';

describe('AdonisJS MCP Transport Routes Integration', () => {
  createMCPTransportTestSuite({
    suiteName: 'AdonisJS Adapter',
    createServer: async (mastra: Mastra) => {
      const app = await createAdonisRouter();
      await new MastraServer({ app, mastra }).init();
      const { server, port } = await listen(app);
      return { server, port };
    },
  });
});
