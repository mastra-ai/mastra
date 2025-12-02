import type { ServerType } from '@hono/node-server';
import { serve } from '@hono/node-server';
import { Mastra } from '@mastra/core/mastra';
import { createTool } from '@mastra/core/tools';
import { MCPServer, MCPClient } from '@mastra/mcp';
import type { Hono } from 'hono';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { z } from 'zod';
import { createHonoServer } from '../../index';

/**
 * Deployer MCP Smoke Test
 *
 * This test verifies that MCP routes work correctly when served through
 * the full deployer server setup (createHonoServer).
 *
 * Detailed MCP route testing is done in:
 * - server-adapters/hono/src/__tests__/mcp-routes.test.ts (registry routes)
 * - server-adapters/hono/src/__tests__/mcp-transport.test.ts (transport routes)
 *
 * This smoke test ensures the deployer's middleware stack (CORS, timeout,
 * body limits, etc.) doesn't interfere with MCP functionality.
 */
describe('Deployer MCP Smoke Test', () => {
  let app: Hono;
  let mastra: Mastra;
  let mcpServer: MCPServer;
  let httpServer: ServerType;
  const PORT = 9500 + Math.floor(Math.random() * 100);

  const calculatorTool = createTool({
    id: 'calculate',
    description: 'Performs basic calculations',
    inputSchema: z.object({
      operation: z.enum(['add', 'subtract', 'multiply', 'divide']),
      a: z.number(),
      b: z.number(),
    }),
    execute: async ({ operation, a, b }) => {
      const ops: Record<string, (a: number, b: number) => number> = {
        add: (a, b) => a + b,
        subtract: (a, b) => a - b,
        multiply: (a, b) => a * b,
        divide: (a, b) => a / b,
      };
      return { result: ops[operation](a, b) };
    },
  });

  beforeAll(async () => {
    mcpServer = new MCPServer({
      name: 'test-server',
      version: '1.0.0',
      description: 'Test MCP Server',
      tools: { calculate: calculatorTool },
    });

    mastra = new Mastra({
      mcpServers: { 'test-server': mcpServer },
    });

    app = await createHonoServer(mastra);
    httpServer = serve({ fetch: app.fetch, port: PORT });
  });

  afterAll(async () => {
    await mcpServer.close();
    httpServer.close();
  });

  describe('Registry Routes', () => {
    it('should list MCP servers', async () => {
      const res = await fetch(`http://localhost:${PORT}/api/mcp/v0/servers`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.servers).toBeDefined();
      expect(data.servers.length).toBeGreaterThan(0);
    });

    it('should get server details', async () => {
      const res = await fetch(`http://localhost:${PORT}/api/mcp/v0/servers/test-server`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.id).toBe('test-server');
      expect(data.name).toBe('test-server');
    });

    it('should list server tools', async () => {
      const res = await fetch(`http://localhost:${PORT}/api/mcp/test-server/tools`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.tools).toBeDefined();
      expect(data.tools.some((t: any) => t.name === 'calculate')).toBe(true);
    });

    it('should execute tool', async () => {
      const res = await fetch(`http://localhost:${PORT}/api/mcp/test-server/tools/calculate/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ args: { operation: 'add', a: 5, b: 3 } }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.result).toBeDefined();
    });
  });

  describe('Transport Routes', () => {
    it('should respond to HTTP transport endpoint', async () => {
      // Just verify the endpoint exists and responds (404 for non-existent server)
      const res = await fetch(`http://localhost:${PORT}/api/mcp/non-existent/mcp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      expect(res.status).toBe(404);
    });

    it('should connect via MCPClient and list tools', async () => {
      const client = new MCPClient({
        servers: {
          'test-server': {
            url: new URL(`http://localhost:${PORT}/api/mcp/test-server/mcp`),
          },
        },
      });

      try {
        const tools = await client.listTools();
        expect(Object.keys(tools).length).toBeGreaterThan(0);
        expect(tools['test-server_calculate']).toBeDefined();
      } finally {
        await client.disconnect();
      }
    });
  });
});
