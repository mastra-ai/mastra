import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import type { Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';

import { MastraMCPClient } from './client.js';

async function setupTestServer(withSessionManagement: boolean) {
  const httpServer: HttpServer = createServer();
  const mcpServer = new McpServer(
    { name: 'test-http-server', version: '1.0.0' },
    {
      capabilities: {
        logging: {},
        tools: {},
      },
    },
  );

  mcpServer.tool(
    'greet',
    'A simple greeting tool',
    {
      name: z.string().describe('Name to greet').default('World'),
    },
    async ({ name }): Promise<CallToolResult> => {
      return {
        content: [{ type: 'text', text: `Hello, ${name}!` }],
      };
    },
  );

  const serverTransport = new StreamableHTTPServerTransport({
    sessionIdGenerator: withSessionManagement ? () => randomUUID() : undefined,
  });

  await mcpServer.connect(serverTransport);

  httpServer.on('request', async (req, res) => {
    await serverTransport.handleRequest(req, res);
  });

  const baseUrl = await new Promise<URL>(resolve => {
    httpServer.listen(0, '127.0.0.1', () => {
      const addr = httpServer.address() as AddressInfo;
      resolve(new URL(`http://127.0.0.1:${addr.port}/mcp`));
    });
  });

  return { httpServer, mcpServer, serverTransport, baseUrl };
}

describe('MastraMCPClient with Streamable HTTP', () => {
  let testServer: {
    httpServer: HttpServer;
    mcpServer: McpServer;
    serverTransport: StreamableHTTPServerTransport;
    baseUrl: URL;
  };
  let client: MastraMCPClient;

  describe('Stateless Mode', () => {
    beforeEach(async () => {
      testServer = await setupTestServer(false);
      client = new MastraMCPClient({
        name: 'test-stateless-client',
        server: {
          url: testServer.baseUrl,
        },
      });
      await client.connect();
    });

    afterEach(async () => {
      await client?.disconnect().catch(() => {});
      await testServer?.mcpServer.close().catch(() => {});
      await testServer?.serverTransport.close().catch(() => {});
      testServer?.httpServer.close();
    });

    it('should connect and list tools', async () => {
      const tools = await client.tools();
      expect(tools).toHaveProperty('greet');
      expect(tools.greet.description).toBe('A simple greeting tool');
    });

    it('should call a tool', async () => {
      const tools = await client.tools();
      const result = await tools.greet.execute({ context: { name: 'Stateless' } });
      expect(result).toEqual({ content: [{ type: 'text', text: 'Hello, Stateless!' }] });
    });
  });

  describe('Stateful Mode', () => {
    beforeEach(async () => {
      testServer = await setupTestServer(true);
      client = new MastraMCPClient({
        name: 'test-stateful-client',
        server: {
          url: testServer.baseUrl,
        },
      });
      await client.connect();
    });

    afterEach(async () => {
      await client?.disconnect().catch(() => {});
      await testServer?.mcpServer.close().catch(() => {});
      await testServer?.serverTransport.close().catch(() => {});
      testServer?.httpServer.close();
    });

    it('should connect and list tools', async () => {
      const tools = await client.tools();
      expect(tools).toHaveProperty('greet');
    });

    it('should capture the session ID after connecting', async () => {
      // The setupTestServer(true) is configured for stateful mode
      // The client should capture the session ID from the server's response
      expect(client.sessionId).toBeDefined();
      expect(typeof client.sessionId).toBe('string');
      expect(client.sessionId?.length).toBeGreaterThan(0);
    });

    it('should call a tool', async () => {
      const tools = await client.tools();
      const result = await tools.greet.execute({ context: { name: 'Stateful' } });
      expect(result).toEqual({ content: [{ type: 'text', text: 'Hello, Stateful!' }] });
    });
  });
});
