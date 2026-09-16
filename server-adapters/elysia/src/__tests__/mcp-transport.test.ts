import type { AddressInfo } from 'node:net';
import { createMCPTransportTestSuite } from '@internal/server-adapter-test-utils';
import type { Mastra } from '@mastra/core/mastra';
import { Elysia } from 'elysia';
import { describe } from 'vitest';
import { MastraServer } from '../index';
import { startElysiaServer } from './helpers';

describe('Elysia MCP Transport Routes Integration', () => {
  createMCPTransportTestSuite({
    suiteName: 'Elysia Adapter',
    createServer: async (mastra: Mastra) => {
      const app = new Elysia();
      const adapter = new MastraServer({ app, mastra });
      await adapter.init();

      const { server } = await startElysiaServer(app);
      const address = server.address() as AddressInfo;
      const port = address.port;
      return { server, port };
    },
  });
});
