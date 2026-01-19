import type { Server } from 'node:http';
import { createMCPTransportTestSuite } from '@internal/server-adapter-test-utils';
import type { Mastra } from '@mastra/core/mastra';
import Koa from 'koa';
import bodyParser from 'koa-bodyparser';
import { describe } from 'vitest';
import { MastraServer } from '../index';

/**
 * Koa Integration Tests for MCP Transport Routes
 *
 * Tests MCP protocol transport endpoints (HTTP and SSE) using MCPClient.
 * These tests require a real HTTP server for the full protocol handshake.
 *
 */
describe('Koa MCP Transport Routes Integration', () => {
  createMCPTransportTestSuite({
    suiteName: 'Koa Adapter',

    createServer: async (mastra: Mastra) => {
      // Create Koa app
      const app = new Koa();
      app.use(bodyParser());

      // Create adapter
      const adapter = new MastraServer({
        app,
        mastra,
      });

      // Initialize routes
      await adapter.init();

      // Start server on random port
      const server = await new Promise<Server>(resolve => {
        const s = app.listen(0, () => resolve(s));
      });

      // Extract port from address
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;

      return {
        server,
        port,
      };
    },
  });
});
