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
      // Create Hono app with explicit type parameters to avoid 'as any'
      const app = new Hono<any, any, any>();

      // Create adapter
      const adapter = new MastraServer({
        app,
        mastra,
      });

      // Initialize routes
      await adapter.init();

      // Start server on random port (port 0 lets OS assign available port)
      const server = serve({ fetch: app.fetch, port: 0 });

      const address = server.address();
      if (!address || typeof address === 'string') {
        throw new Error('Failed to get server address');
      }
      const port = address.port;

      return {
        server,
        port,
      };
    },
  });
});
