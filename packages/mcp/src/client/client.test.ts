import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import type { Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';

import { InternalMastraMCPClient } from './client.js';

async function setupTestServer(withSessionManagement: boolean) {
  const httpServer: HttpServer = createServer();
  const mcpServer = new McpServer(
    { name: 'test-http-server', version: '1.0.0' },
    {
      capabilities: {
        logging: {},
        tools: {},
        resources: {},
        prompts: {},
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

  mcpServer.resource('test-resource', 'resource://test', () => {
    return {
      contents: [
        {
          uri: 'resource://test',
          text: 'Hello, world!',
        },
      ],
    };
  });

  mcpServer.prompt(
    'greet',
    'A simple greeting prompt',
    () => {
      return {
        prompt: {
          name: 'greet',
          version: 'v1',
          description: 'A simple greeting prompt',
          mimeType: 'application/json',
        },
        messages: [
          {
            role: 'assistant',
            content: { type: 'text', text: `Hello, World!` }
          }
        ]
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
  let client: InternalMastraMCPClient;

  describe('Stateless Mode', () => {
    beforeEach(async () => {
      testServer = await setupTestServer(false);
      client = new InternalMastraMCPClient({
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

    it('should list resources', async () => {
      const resourcesResult = await client.listResources();
      const resources = resourcesResult.resources;
      expect(resources).toBeInstanceOf(Array);
      const testResource = resources.find((r) => r.uri === 'resource://test');
      expect(testResource).toBeDefined();
      expect(testResource!.name).toBe('test-resource');
      expect(testResource!.uri).toBe('resource://test');

      const readResult = await client.readResource('resource://test');
      expect(readResult.contents).toBeInstanceOf(Array);
      expect(readResult.contents.length).toBe(1);
      expect(readResult.contents[0].text).toBe('Hello, world!');
    });

    it('should list prompts', async () => {
      const {prompts} = await client.listPrompts();
      expect(prompts).toBeInstanceOf(Array);
      expect(prompts).toHaveLength(1);
      expect(prompts[0]).toHaveProperty('name');
      expect(prompts[0]).toHaveProperty('description');
      expect(prompts[0].description).toBe('A simple greeting prompt');
    });

    it('should get a specific prompt', async () => {
      const result = await client.getPrompt({name: 'greet'});
      const {prompt, messages} = result;
      expect(prompt).toBeDefined();
      expect(prompt).toMatchObject({
        name: 'greet',
        version: 'v1',
        description: expect.any(String),
        mimeType: 'application/json',
      });
      expect(messages).toBeDefined();
      const messageItem = messages[0];
      expect(messageItem.content.text).toBe('Hello, World!');
    });
  });

  describe('Stateful Mode', () => {
    beforeEach(async () => {
      testServer = await setupTestServer(true);
      client = new InternalMastraMCPClient({
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
