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
 *
 * IMPORTANT: MCP transport routes must NOT have body-parsing middleware applied
 * because the MCP SDK needs to read the raw request body directly from the stream.
 * Express.json() would consume the body before the MCP server can read it.
 */
describe('Express MCP Transport Routes Integration', () => {
  createMCPTransportTestSuite({
    suiteName: 'Express Adapter',

    createServer: async (mastra: Mastra) => {
      // Create Express app
      const app = express();

      // Apply JSON body parsing only to non-MCP routes
      // MCP transport routes need raw body access - the SDK reads the body directly
      app.use((req, res, next) => {
        // Skip body parsing for MCP transport routes
        if (req.path.match(/\/api\/mcp\/[^/]+\/(mcp|sse|messages)$/)) {
          return next();
        }
        return express.json()(req, res, next);
      });

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
