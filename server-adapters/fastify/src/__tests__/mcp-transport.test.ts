import { createMCPTransportTestSuite } from '@internal/server-adapter-test-utils';
import type { Mastra } from '@mastra/core/mastra';
import Fastify from 'fastify';
import { describe } from 'vitest';
import { MastraServer } from '../index';

/**
 * Fastify Integration Tests for MCP Transport Routes
 *
 * Tests MCP protocol transport endpoints (HTTP and SSE) using MCPClient.
 * These tests require a real HTTP server for the full protocol handshake.
 *
 */
describe('Fastify MCP Transport Routes Integration', () => {
  createMCPTransportTestSuite({
    suiteName: 'Fastify Adapter',

    createServer: async (mastra: Mastra) => {
      // Create Fastify app
      const app = Fastify();

      // Create adapter
      const adapter = new MastraServer({
        app,
        mastra,
      });

      // Initialize routes
      await adapter.init();

      // Start server on random port
      const address = await app.listen({ port: 0 });

      // Extract port from address (e.g., "http://127.0.0.1:3000")
      const url = new URL(address);
      const port = parseInt(url.port, 10);

      return {
        server: app.server,
        port,
      };
    },
  });
});
