/**
 *
 * This test verifies that MCP tool annotations (annotations, _meta) are properly
 * supported in Mastra tools and exposed via the MCP protocol.
 *
 * The MCP SDK ToolSchema supports:
 * - annotations: { title, readOnlyHint, destructiveHint, idempotentHint, openWorldHint }
 * - _meta: arbitrary metadata passthrough
 *
 * These fields are now supported in Mastra's ToolAction interface and MCPServer.
 */
import http from 'node:http';
import { createTool } from '@mastra/core/tools';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { z } from 'zod';
import { MCPServer } from './server';

vi.setConfig({ testTimeout: 20000, hookTimeout: 20000 });

describe('MCPServer Tool Annotations (Issue #9859)', () => {
  let server: MCPServer;
  let httpServer: http.Server;
  let rawMcpClient: Client;
  const PORT = 9800 + Math.floor(Math.random() * 100);

  beforeAll(async () => {
    // Create a tool with MCP annotations metadata (Issue #9859)
    const annotatedTool = createTool({
      id: 'annotated-tool',
      description: 'A tool with MCP annotations for OpenAI Apps SDK compatibility',
      inputSchema: z.object({
        query: z.string().describe('The query to process'),
      }),
      annotations: {
        title: 'Annotated Query Tool',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: {
        customField: 'custom-value',
        version: '1.0.0',
      },
      execute: async ({ query }) => {
        return { result: `Processed: ${query}` };
      },
    });

    server = new MCPServer({
      name: 'AnnotationsTestServer',
      version: '1.0.0',
      tools: {
        annotatedTool,
      },
    });

    // Start HTTP server
    httpServer = http.createServer(async (req: http.IncomingMessage, res: http.ServerResponse) => {
      const url = new URL(req.url || '', `http://localhost:${PORT}`);
      await server.startHTTP({
        url,
        httpPath: '/http',
        req,
        res,
        options: {
          sessionIdGenerator: undefined,
        },
      });
    });

    await new Promise<void>(resolve => {
      httpServer.listen(PORT, resolve);
    });

    // Create raw MCP client to access unprocessed listTools response
    rawMcpClient = new Client({ name: 'test-client', version: '1.0.0' }, { capabilities: {} });

    const transport = new StreamableHTTPClientTransport(new URL(`http://localhost:${PORT}/http`));

    await rawMcpClient.connect(transport);
  });

  afterAll(async () => {
    await rawMcpClient?.close();
    await server?.close();
    await new Promise<void>((resolve, reject) => {
      httpServer?.close((err?: Error) => (err ? reject(err) : resolve()));
    });
  });

  it('should expose tool annotations.title in MCP listTools response', async () => {
    const { tools } = await rawMcpClient.listTools({});

    const annotatedTool = tools.find(t => t.name === 'annotatedTool');
    expect(annotatedTool).toBeDefined();

    // Verify that annotations.title is properly exposed via MCP
    expect(annotatedTool!.annotations?.title).toBe('Annotated Query Tool');
  });

  it('should expose tool annotations hints in MCP listTools response', async () => {
    const { tools } = await rawMcpClient.listTools({});

    const annotatedTool = tools.find(t => t.name === 'annotatedTool');
    expect(annotatedTool).toBeDefined();

    // Verify that all annotation hints are properly exposed via MCP
    expect(annotatedTool!.annotations).toBeDefined();
    expect(annotatedTool!.annotations?.readOnlyHint).toBe(true);
    expect(annotatedTool!.annotations?.destructiveHint).toBe(false);
    expect(annotatedTool!.annotations?.idempotentHint).toBe(true);
    expect(annotatedTool!.annotations?.openWorldHint).toBe(false);
  });

  it('should expose tool _meta in MCP listTools response', async () => {
    const { tools } = await rawMcpClient.listTools({});

    const annotatedTool = tools.find(t => t.name === 'annotatedTool');
    expect(annotatedTool).toBeDefined();

    // Verify that _meta is properly exposed via MCP
    expect((annotatedTool as any)._meta).toBeDefined();
    expect((annotatedTool as any)._meta?.customField).toBe('custom-value');
    expect((annotatedTool as any)._meta?.version).toBe('1.0.0');
  });
});
