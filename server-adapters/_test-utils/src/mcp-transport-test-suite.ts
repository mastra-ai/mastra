import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Mastra } from '@mastra/core/mastra';
import { MCPServer, MCPClient } from '@mastra/mcp';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

/**
 * Configuration for MCP transport test suite
 */
export interface MCPTransportTestConfig {
  /** Name for the test suite */
  suiteName?: string;
  /**
   * Creates an HTTP server for the given Mastra instance.
   * Returns the server and port for testing.
   */
  createServer: (mastra: Mastra) => Promise<{
    /** The HTTP server instance (will be closed in afterAll) */
    server: { close: () => void };
    /** The port the server is listening on */
    port: number;
  }>;
}

/**
 * Creates a standardized integration test suite for MCP transport routes
 *
 * Tests MCP protocol transport endpoints using MCPClient:
 * - HTTP Transport (POST /api/mcp/:serverId/mcp)
 * - SSE Transport (GET /api/mcp/:serverId/sse, POST /api/mcp/:serverId/messages)
 *
 * These tests require a real HTTP server because MCPClient needs to perform
 * the full MCP protocol handshake with session management.
 *
 * Usage:
 * ```ts
 * // Hono adapter
 * createMCPTransportTestSuite({
 *   suiteName: 'Hono MCP Transport',
 *   createServer: async (mastra) => {
 *     const app = await createHonoServer(mastra, { tools: {} });
 *     const server = serve({ fetch: app.fetch, port: 0 });
 *     const address = server.address();
 *     const port = typeof address === 'object' ? address.port : 9999;
 *     return { server, port };
 *   },
 * });
 *
 * // Express adapter
 * createMCPTransportTestSuite({
 *   suiteName: 'Express MCP Transport',
 *   createServer: async (mastra) => {
 *     const app = express();
 *     const adapter = new MastraServer({ mastra });
 *     adapter.mount(app);
 *     const server = app.listen(0);
 *     const address = server.address();
 *     const port = typeof address === 'object' ? address.port : 9999;
 *     return { server, port };
 *   },
 * });
 * ```
 */
export function createMCPTransportTestSuite(config: MCPTransportTestConfig) {
  const { suiteName = 'MCP Transport Routes', createServer } = config;

  describe(suiteName, () => {
    // Test tools - no outputSchema to avoid MCP validation conflicts
    const weatherTool = createTool({
      id: 'getWeather',
      description: 'Gets the current weather for a location',
      inputSchema: z.object({
        location: z.string().describe('The location to get weather for'),
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

    let httpServer: { close: () => void };
    let port: number;
    let mcpServer1: MCPServer;
    let mcpServer2: MCPServer;
    let mcpClient: MCPClient;
    let mastra: Mastra;

    beforeAll(async () => {
      // Create MCP servers with tools
      mcpServer1 = new MCPServer({
        name: 'server1',
        version: '1.0.0',
        description: 'Test MCP Server 1',
        tools: {
          getWeather: weatherTool,
          calculate: calculatorTool,
        },
      });

      mcpServer2 = new MCPServer({
        name: 'server2',
        version: '1.1.0',
        description: 'Test MCP Server 2',
        tools: {},
      });

      // Create Mastra instance
      mastra = new Mastra({
        mcpServers: {
          'test-server-1': mcpServer1,
          'test-server-2': mcpServer2,
        },
      });

      // Create HTTP server using adapter-specific implementation
      const serverSetup = await createServer(mastra);
      httpServer = serverSetup.server;
      port = serverSetup.port;

      // Create MCPClient for transport tests
      mcpClient = new MCPClient({
        servers: {
          server1: {
            url: new URL(`http://localhost:${port}/api/mcp/${mcpServer1.id}/mcp`),
          },
          server2: {
            url: new URL(`http://localhost:${port}/api/mcp/${mcpServer2.id}/mcp`),
          },
        },
      });
    });

    afterAll(async () => {
      await mcpClient?.disconnect();
      httpServer?.close();
      await mcpServer1?.close();
      await mcpServer2?.close();
    });

    describe('HTTP Transport (/api/mcp/:serverId/mcp)', () => {
      describe('Error handling (raw HTTP)', () => {
        it('should return 404 for non-existent server', async () => {
          const res = await fetch(`http://localhost:${port}/api/mcp/non-existent/mcp`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json, text/event-stream',
            },
            body: JSON.stringify({
              jsonrpc: '2.0',
              method: 'initialize',
              params: {
                protocolVersion: '2024-11-05',
                capabilities: {},
                clientInfo: { name: 'test-client', version: '1.0.0' },
              },
              id: 1,
            }),
          });

          expect(res.status).toBe(404);
        });
      });

      describe('Protocol operations (MCPClient)', () => {
        it('should list tools via MCPClient', async () => {
          const tools = await mcpClient.listTools();

          // MCPClient prefixes tool names with server name
          expect(tools['server1_getWeather']).toBeDefined();
          expect(tools['server1_calculate']).toBeDefined();
        });

        it('should execute tool via MCPClient', async () => {
          const tools = await mcpClient.listTools();
          const calculateTool = tools['server1_calculate'];

          expect(calculateTool).toBeDefined();
          expect(calculateTool.execute).toBeDefined();

          const result = await calculateTool.execute!({ operation: 'multiply', a: 6, b: 7 });

          expect(result).toBeDefined();
          expect(result.content).toBeInstanceOf(Array);
          expect(result.content.length).toBeGreaterThan(0);

          const toolOutput = result.content[0];
          expect(toolOutput.type).toBe('text');
          const toolResult = JSON.parse(toolOutput.text);
          expect(toolResult.result).toBe(42);
        });

        it('should execute weather tool via MCPClient', async () => {
          const tools = await mcpClient.listTools();
          const weatherToolInstance = tools['server1_getWeather'];

          expect(weatherToolInstance).toBeDefined();
          expect(weatherToolInstance.execute).toBeDefined();

          const result = await weatherToolInstance.execute!({ location: 'Austin' });

          expect(result).toBeDefined();
          expect(result.content).toBeInstanceOf(Array);

          const toolOutput = result.content[0];
          expect(toolOutput.type).toBe('text');
          const toolResult = JSON.parse(toolOutput.text);
          expect(toolResult.temperature).toBe(72);
          expect(toolResult.condition).toBe('Sunny in Austin');
        });

        it('should handle multiple MCP servers', async () => {
          const tools = await mcpClient.listTools();

          // Server 1 has 2 tools
          expect(tools['server1_getWeather']).toBeDefined();
          expect(tools['server1_calculate']).toBeDefined();

          // Server 2 has 0 tools
          const server2Tools = Object.keys(tools).filter(k => k.startsWith('server2_'));
          expect(server2Tools).toHaveLength(0);
        });
      });

      describe('Tool execution errors (MCPClient)', () => {
        let failingClient: MCPClient;
        let failingServer: MCPServer;
        let failingMastra: Mastra;
        let failingHttpServer: { close: () => void };

        beforeAll(async () => {
          const failingTool = createTool({
            id: 'failingTool',
            description: 'A tool that always throws an error',
            inputSchema: z.object({}),
            execute: async () => {
              throw new Error('Tool execution failed intentionally');
            },
          });

          failingServer = new MCPServer({
            name: 'failingServer',
            version: '1.0.0',
            tools: { failingTool },
          });

          failingMastra = new Mastra({
            mcpServers: { 'failing-server': failingServer },
          });

          const serverSetup = await createServer(failingMastra);
          failingHttpServer = serverSetup.server;
          const failingPort = serverSetup.port;

          failingClient = new MCPClient({
            servers: {
              failing: {
                url: new URL(`http://localhost:${failingPort}/api/mcp/${failingServer.id}/mcp`),
              },
            },
          });
        });

        afterAll(async () => {
          await failingClient?.disconnect();
          failingHttpServer?.close();
          await failingServer?.close();
        });

        it('should return error when tool execution fails', async () => {
          const tools = await failingClient.listTools();
          const failingTool = tools['failing_failingTool'];

          expect(failingTool).toBeDefined();

          const result = await failingTool.execute!({});

          expect(result).toBeDefined();
          expect(result.content).toBeInstanceOf(Array);
          expect(result.content.length).toBeGreaterThan(0);

          const errorOutput = result.content[0];
          expect(errorOutput.type).toBe('text');

          const errorData = JSON.parse(errorOutput.text);
          expect(errorData.message).toContain('Tool execution failed intentionally');
          expect(errorData.code).toBe('TOOL_EXECUTION_FAILED');
        });
      });
    });

    describe('SSE Transport (/api/mcp/:serverId/sse)', () => {
      describe('Error handling (raw HTTP)', () => {
        it('should return 404 for non-existent server on GET /sse', async () => {
          const res = await fetch(`http://localhost:${port}/api/mcp/non-existent/sse`);
          expect(res.status).toBe(404);
        });

        it('should return 404 for non-existent server on POST /messages', async () => {
          const res = await fetch(`http://localhost:${port}/api/mcp/non-existent/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              method: 'test',
              id: 1,
            }),
          });

          expect(res.status).toBe(404);
        });
      });

      describe('Protocol operations (MCPClient with SSE)', () => {
        let sseClient: MCPClient;

        beforeAll(async () => {
          sseClient = new MCPClient({
            servers: {
              server1: {
                url: new URL(`http://localhost:${port}/api/mcp/${mcpServer1.id}/sse`),
              },
            },
          });
        });

        afterAll(async () => {
          await sseClient?.disconnect();
        });

        it('should list tools via MCPClient over SSE', async () => {
          const tools = await sseClient.listTools();

          expect(tools['server1_getWeather']).toBeDefined();
          expect(tools['server1_calculate']).toBeDefined();
        });

        it('should execute tool via MCPClient over SSE', async () => {
          const tools = await sseClient.listTools();
          const calculateTool = tools['server1_calculate'];

          expect(calculateTool).toBeDefined();
          expect(calculateTool.execute).toBeDefined();

          const result = await calculateTool.execute!({ operation: 'add', a: 10, b: 5 });

          expect(result).toBeDefined();
          expect(result.content).toBeInstanceOf(Array);
          expect(result.content.length).toBeGreaterThan(0);

          const toolOutput = result.content[0];
          expect(toolOutput.type).toBe('text');
          const toolResult = JSON.parse(toolOutput.text);
          expect(toolResult.result).toBe(15);
        });

        it('should execute weather tool via MCPClient over SSE', async () => {
          const tools = await sseClient.listTools();
          const weatherToolInstance = tools['server1_getWeather'];

          expect(weatherToolInstance).toBeDefined();
          expect(weatherToolInstance.execute).toBeDefined();

          const result = await weatherToolInstance.execute!({ location: 'New York' });

          expect(result).toBeDefined();
          expect(result.content).toBeInstanceOf(Array);

          const toolOutput = result.content[0];
          expect(toolOutput.type).toBe('text');
          const toolResult = JSON.parse(toolOutput.text);
          expect(toolResult.temperature).toBe(72);
          expect(toolResult.condition).toBe('Sunny in New York');
        });
      });

      describe('Tool execution errors (MCPClient with SSE)', () => {
        let sseFailingClient: MCPClient;
        let sseFailingServer: MCPServer;
        let sseFailingMastra: Mastra;
        let sseFailingHttpServer: { close: () => void };

        beforeAll(async () => {
          const failingTool = createTool({
            id: 'failingTool',
            description: 'A tool that always throws an error',
            inputSchema: z.object({}),
            execute: async () => {
              throw new Error('SSE tool execution failed intentionally');
            },
          });

          sseFailingServer = new MCPServer({
            name: 'sseFailingServer',
            version: '1.0.0',
            tools: { failingTool },
          });

          sseFailingMastra = new Mastra({
            mcpServers: { 'sse-failing-server': sseFailingServer },
          });

          const serverSetup = await createServer(sseFailingMastra);
          sseFailingHttpServer = serverSetup.server;
          const sseFailingPort = serverSetup.port;

          sseFailingClient = new MCPClient({
            servers: {
              failing: {
                url: new URL(`http://localhost:${sseFailingPort}/api/mcp/${sseFailingServer.id}/sse`),
              },
            },
          });
        });

        afterAll(async () => {
          await sseFailingClient?.disconnect();
          sseFailingHttpServer?.close();
          await sseFailingServer?.close();
        });

        it('should return error when tool execution fails over SSE', async () => {
          const tools = await sseFailingClient.listTools();
          const failingTool = tools['failing_failingTool'];

          expect(failingTool).toBeDefined();

          const result = await failingTool.execute!({});

          expect(result).toBeDefined();
          expect(result.content).toBeInstanceOf(Array);
          expect(result.content.length).toBeGreaterThan(0);

          const errorOutput = result.content[0];
          expect(errorOutput.type).toBe('text');

          const errorData = JSON.parse(errorOutput.text);
          expect(errorData.message).toContain('SSE tool execution failed intentionally');
          expect(errorData.code).toBe('TOOL_EXECUTION_FAILED');
        });
      });
    });
  });
}
