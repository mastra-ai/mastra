import type { Server } from 'http';
import { describe } from 'vitest';
import express from 'express';
import { Mastra } from '@mastra/core/mastra';
import { MastraServer } from '../index';
import { createMCPTransportTestSuite } from '@internal/server-adapter-test-utils';

/**
 * Express Integration Tests for MCP Transport Routes
 *
 * Tests MCP protocol transport endpoints (HTTP and SSE) using MCPClient.
 * These tests require a real HTTP server for the full protocol handshake.
 */
describe('Express MCP Transport Routes Integration', () => {
  createMCPTransportTestSuite({
    suiteName: 'Express Adapter',

    createServer: async (mastra: Mastra) => {
      // Create Express app
      const app = express();
      app.use(express.json());

      // Create adapter
      const adapter = new MastraServer({
        app,
        mastra,
      });

      // Initialize routes
      adapter.init();

      // Start server on random port
      const server: Server = await new Promise(resolve => {
        const s = app.listen(0, () => resolve(s));
      });

      const address = server.address();
      if (!address || typeof address === 'string') {
        throw new Error('Failed to get server address');
      }

      return {
        server,
        port: address.port,
      };
    },
  });
});
