import { serve } from '@hono/node-server';
import { createMCPTransportTestSuite } from '@internal/server-adapter-test-utils';
import type { Mastra } from '@mastra/core/mastra';
import { Hono } from 'hono';
import { describe } from 'vitest';
import { MastraServer } from '../index';

/**
 * Hono Integration Tests for MCP Transport Routes
 *
 * Tests MCP protocol transport endpoints (HTTP and SSE) using MCPClient.
 * These tests require a real HTTP server for the full protocol handshake.
 */
describe('Hono MCP Transport Routes Integration', () => {
  createMCPTransportTestSuite({
    suiteName: 'Hono Adapter',

    createServer: async (mastra: Mastra) => {
      // Create Hono app
      const app = new Hono();

      // Create adapter
      const adapter = new MastraServer({
        app: app as any,
        mastra,
      });

      // Initialize routes
      adapter.init();

      // Start server on random port (port 0 lets OS assign available port)
      const server = serve({ fetch: app.fetch, port: 0 });

      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 9999;

      return {
        server,
        port,
      };
    },
  });
});
