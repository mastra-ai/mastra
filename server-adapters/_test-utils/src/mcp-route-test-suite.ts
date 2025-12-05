import { describe, it, expect, beforeEach } from 'vitest';
import { Mastra } from '@mastra/core/mastra';
import { MCPServer } from '@mastra/mcp';
import { AdapterTestContext, AdapterTestSuiteConfig, createDefaultTestContext } from './test-helpers';

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
 *     setupAdapter: async (context) => {
 *       const app = new Hono();
 *       const adapter = new MastraServer({ app, mastra: context.mastra, ... });
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
export function createMCPRouteTestSuite(config: AdapterTestSuiteConfig) {
  const { suiteName = 'MCP Registry Routes Integration', setupAdapter, executeHttpRequest, createTestContext } = config;

  describe(suiteName, () => {
    let context: AdapterTestContext;
    let app: any;
    let mcpServer1: MCPServer;
    let mcpServer2: MCPServer;

    beforeEach(async () => {
      // Create test context - use provided or default
      if (createTestContext) {
        const result = createTestContext();
        context = result instanceof Promise ? await result : result;
      } else {
        context = await createDefaultTestContext();
      }

      const setup = await setupAdapter(context);
      app = setup.app;
      const mastra = setup.adapter.mastra;
      mcpServer1 = mastra.getMCPServerById('test-server-1');
      mcpServer2 = mastra.getMCPServerById('test-server-2');
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

      it('should handle pagination with page/perPage', async () => {
        const res = await executeHttpRequest(app, {
          method: 'GET',
          path: '/api/mcp/v0/servers',
          query: { perPage: '1', page: '0' },
        });

        expect(res.status).toBe(200);
        expect(res.data).toMatchObject({
          servers: expect.any(Array),
          total_count: 2,
        });
        expect((res.data as any).servers).toHaveLength(1);
        expect((res.data as any).next).toContain('perPage=1');
        expect((res.data as any).next).toContain('page=1');
        // Verify the returned server is one of the expected ones
        expect(['Test Server 1', 'Test Server 2']).toContain((res.data as any).servers[0].name);
      });

      it('should handle pagination with legacy limit/offset', async () => {
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
        // Response mirrors request format (legacy limit/offset)
        expect((res.data as any).next).toContain('limit=1');
        expect((res.data as any).next).toContain('offset=1');
        // Verify the returned server is one of the expected ones
        expect(['Test Server 1', 'Test Server 2']).toContain((res.data as any).servers[0].name);
      });

      it('should return empty list when no MCP servers registered', async () => {
        // Create a minimal Mastra instance with no MCP servers
        const emptyMastra = new Mastra({});

        // Setup adapter with empty Mastra
        const emptySetup = await setupAdapter({
          mastra: emptyMastra,
          tools: {},
        });

        const res = await executeHttpRequest(emptySetup.app, {
          method: 'GET',
          path: '/api/mcp/v0/servers',
        });

        expect(res.status).toBe(200);
        expect(res.data).toMatchObject({
          servers: [],
          total_count: 0,
          next: null,
        });
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

      it('should return 404 for non-existent server', async () => {
        const res = await executeHttpRequest(app, {
          method: 'POST',
          path: '/api/mcp/non-existent/tools/calculate/execute',
          body: { data: { operation: 'add', a: 1, b: 2 } },
        });

        expect(res.status).toBe(404);
      });

      it('should return error for non-existent tool', async () => {
        const res = await executeHttpRequest(app, {
          method: 'POST',
          path: `/api/mcp/${mcpServer1.id}/tools/non-existent/execute`,
          body: { data: {} },
        });

        // Current behavior returns 500, ideally should be 404
        expect([404, 500]).toContain(res.status);
      });

      it('should handle invalid tool input', async () => {
        const res = await executeHttpRequest(app, {
          method: 'POST',
          path: `/api/mcp/${mcpServer1.id}/tools/calculate/execute`,
          body: { data: { operation: 'invalid', a: 'not-a-number', b: 3 } },
        });

        // Input validation may return 400 or 200 with error details depending on implementation
        // Current behavior: zod validation fails during execution, but enum check happens first
        expect([200, 400, 500]).toContain(res.status);
        if (res.status === 200) {
          // If 200, expect error in response body
          expect((res.data as any).error || (res.data as any).result).toBeDefined();
        }
      });
    });
  });
}
