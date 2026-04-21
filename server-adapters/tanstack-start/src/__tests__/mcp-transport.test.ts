import { serve } from '@hono/node-server';
import { createMCPTransportTestSuite } from '@internal/server-adapter-test-utils';
import type { Mastra } from '@mastra/core/mastra';
import { describe } from 'vitest';
import { MastraServer } from '../index';

describe('TanStack Start MCP Transport Routes Integration', () => {
  createMCPTransportTestSuite({
    suiteName: 'TanStack Start Adapter',
    createServer: async (mastra: Mastra) => {
      const adapter = new MastraServer({ mastra });
      await adapter.init();

      const server = serve({ fetch: adapter.app.fetch, port: 0 });
      const address = server.address();
      if (!address || typeof address === 'string') {
        throw new Error('Failed to get server address');
      }

      return { server, port: address.port };
    },
  });
});
