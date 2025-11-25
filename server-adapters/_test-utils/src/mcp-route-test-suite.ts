import { describe, it, expect, beforeEach } from 'vitest';
import { Mastra } from '@mastra/core/mastra';
import { MCPServer } from '@mastra/mcp';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import type { HttpRequest, HttpResponse } from './route-adapter-test-suite';

/**
 * Configuration for MCP route integration test suite
 */
export interface MCPRouteTestSuiteConfig {
  /** Name for the test suite */
  suiteName?: string;

  /**
   * Setup adapter and app for testing MCP routes
   * Called in beforeEach
   */
  setupAdapter: (mastra: Mastra) => Promise<{
    app: any;
    adapter: any;
  }>;

  /**
   * Execute HTTP request through the adapter's framework (Express/Hono)
   */
  executeHttpRequest: (app: any, request: HttpRequest) => Promise<HttpResponse>;
}

/**
 * Creates a standardized integration test suite for MCP registry routes
 *
 * Tests the 5 MCP registry routes work correctly with any adapter:
 * - List MCP servers
 * - Get MCP server details
 * - List MCP server tools
 * - Get MCP server tool details
 * - Execute MCP server tool
 *
 * Usage:
 * ```ts
 * describe('Hono MCP Routes', () => {
 *   createMCPRouteTestSuite({
 *     suiteName: 'Hono Adapter',
 *     setupAdapter: async (mastra) => {
 *       const app = new Hono();
 *       const adapter = new MastraServer({ app, mastra, ... });
 *       await adapter.init(); // Registers context, auth, and all routes
 *       return { app, adapter };
 *     },
 *     executeHttpRequest: async (app, req) => {
 *       const res = await app.request(req.path + (req.query ? '?' + new URLSearchParams(req.query).toString() : ''));
 *       return { status: res.status, type: 'json', data: await res.json() };
 *     }
 *   });
 * });
 * ```
 */
export function createMCPRouteTestSuite(config: MCPRouteTestSuiteConfig) {
  const { suiteName = 'MCP Registry Routes Integration', setupAdapter, executeHttpRequest } = config;

  describe(suiteName, () => {
    let app: any;
    let mastra: Mastra;
    let mcpServer1: MCPServer;
    let mcpServer2: MCPServer;

    beforeEach(async () => {
      // Create real tools for MCP servers
      const weatherTool = createTool({
        id: 'getWeather',
        description: 'Gets the current weather for a location',
        inputSchema: z.object({
          location: z.string().describe('The location to get weather for'),
        }),
        outputSchema: z.object({
          temperature: z.number(),
          condition: z.string(),
        }),
        execute: async ({ location }) => ({
          temperature: 72,
          condition: `Sunny in ${location}`,
        }),
      });

      const calculatorTool = createTool({
        id: 'calculate',
        description: 'Performs basic calculations',
        inputSchema: z.object({
          operation: z.enum(['add', 'subtract', 'multiply', 'divide']),
          a: z.number(),
          b: z.number(),
        }),
        outputSchema: z.object({
          result: z.number(),
        }),
        execute: async ({ operation, a, b }) => {
          let result = 0;
          switch (operation) {
            case 'add':
              result = a + b;
              break;
            case 'subtract':
              result = a - b;
              break;
            case 'multiply':
              result = a * b;
              break;
            case 'divide':
              result = a / b;
              break;
          }
          return { result };
        },
      });

      // Create real MCP servers with tools
      mcpServer1 = new MCPServer({
        name: 'Test Server 1',
        version: '1.0.0',
        description: 'Test MCP Server 1',
        tools: {
          getWeather: weatherTool,
          calculate: calculatorTool,
        },
      });

      mcpServer2 = new MCPServer({
        name: 'Test Server 2',
        version: '1.1.0',
        description: 'Test MCP Server 2',
        tools: {},
      });

      // Create real Mastra instance with MCP servers
      mastra = new Mastra({
        mcpServers: {
          'test-server-1': mcpServer1,
          'test-server-2': mcpServer2,
        },
      });

      const setup = await setupAdapter(mastra);
      app = setup.app;
    });

    describe('GET /api/mcp/v0/servers', () => {
      it('should list MCP servers', async () => {
        const res = await executeHttpRequest(app, {
          method: 'GET',
          path: '/api/mcp/v0/servers',
        });

        expect(res.status).toBe(200);
        expect(res.data).toMatchObject({
          servers: expect.arrayContaining([
            expect.objectContaining({
              name: 'Test Server 1',
              version_detail: expect.objectContaining({
                version: '1.0.0',
              }),
            }),
            expect.objectContaining({
              name: 'Test Server 2',
              version_detail: expect.objectContaining({
                version: '1.1.0',
              }),
            }),
          ]),
          total_count: 2,
        });
      });

      it('should handle pagination', async () => {
        const res = await executeHttpRequest(app, {
          method: 'GET',
          path: '/api/mcp/v0/servers',
          query: { limit: '1', offset: '0' },
        });

        expect(res.status).toBe(200);
        expect(res.data).toMatchObject({
          servers: expect.any(Array),
          total_count: 2,
        });
        expect((res.data as any).servers).toHaveLength(1);
        expect((res.data as any).next).toContain('limit=1');
        expect((res.data as any).next).toContain('offset=1');
      });
    });

    describe('GET /api/mcp/v0/servers/:id', () => {
      it('should get server details', async () => {
        const res = await executeHttpRequest(app, {
          method: 'GET',
          path: `/api/mcp/v0/servers/${mcpServer1.id}`,
        });

        expect(res.status).toBe(200);
        expect(res.data).toMatchObject({
          id: mcpServer1.id,
          name: 'Test Server 1',
          description: 'Test MCP Server 1',
          version_detail: {
            version: '1.0.0',
            is_latest: true,
          },
        });
      });

      it('should return 404 for non-existent server', async () => {
        const res = await executeHttpRequest(app, {
          method: 'GET',
          path: '/api/mcp/v0/servers/non-existent',
        });

        expect(res.status).toBe(404);
        expect((res.data as any).error).toContain('not found');
      });
    });

    describe('GET /api/mcp/:serverId/tools', () => {
      it('should list server tools', async () => {
        const res = await executeHttpRequest(app, {
          method: 'GET',
          path: `/api/mcp/${mcpServer1.id}/tools`,
        });

        expect(res.status).toBe(200);
        expect((res.data as any).tools).toHaveLength(2);
        expect((res.data as any).tools).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ name: 'getWeather' }),
            expect.objectContaining({ name: 'calculate' }),
          ]),
        );
      });

      it('should return 404 for non-existent server', async () => {
        const res = await executeHttpRequest(app, {
          method: 'GET',
          path: '/api/mcp/non-existent/tools',
        });

        expect(res.status).toBe(404);
      });
    });

    describe('GET /api/mcp/:serverId/tools/:toolId', () => {
      it('should get tool details', async () => {
        const res = await executeHttpRequest(app, {
          method: 'GET',
          path: `/api/mcp/${mcpServer1.id}/tools/getWeather`,
        });

        expect(res.status).toBe(200);
        expect(res.data).toMatchObject({
          name: 'getWeather',
          description: 'Gets the current weather for a location',
          inputSchema: expect.any(Object),
        });
      });

      it('should return 404 for non-existent tool', async () => {
        const res = await executeHttpRequest(app, {
          method: 'GET',
          path: `/api/mcp/${mcpServer1.id}/tools/non-existent`,
        });

        expect(res.status).toBe(404);
      });
    });

    describe('POST /api/mcp/:serverId/tools/:toolId/execute', () => {
      it('should execute tool', async () => {
        const res = await executeHttpRequest(app, {
          method: 'POST',
          path: `/api/mcp/${mcpServer1.id}/tools/calculate/execute`,
          body: { data: { operation: 'add', a: 5, b: 3 } },
        });

        expect(res.status).toBe(200);
        expect((res.data as any).result).toEqual({
          result: 8,
        });
      });

      it('should execute tool with location data', async () => {
        const res = await executeHttpRequest(app, {
          method: 'POST',
          path: `/api/mcp/${mcpServer1.id}/tools/getWeather/execute`,
          body: { data: { location: 'San Francisco' } },
        });

        expect(res.status).toBe(200);
        expect((res.data as any).result).toMatchObject({
          temperature: 72,
          condition: 'Sunny in San Francisco',
        });
      });
    });
  });
}
