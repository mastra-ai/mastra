import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import type { Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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

  mcpServer.prompt('greet', 'A simple greeting prompt', () => {
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
          content: { type: 'text', text: `Hello, World!` },
        },
      ],
    };
  });

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
      const testResource = resources.find(r => r.uri === 'resource://test');
      expect(testResource).toBeDefined();
      expect(testResource!.name).toBe('test-resource');
      expect(testResource!.uri).toBe('resource://test');

      const readResult = await client.readResource('resource://test');
      expect(readResult.contents).toBeInstanceOf(Array);
      expect(readResult.contents.length).toBe(1);
      expect(readResult.contents[0].text).toBe('Hello, world!');
    });

    it('should list prompts', async () => {
      const { prompts } = await client.listPrompts();
      expect(prompts).toBeInstanceOf(Array);
      expect(prompts).toHaveLength(1);
      expect(prompts[0]).toHaveProperty('name');
      expect(prompts[0]).toHaveProperty('description');
      expect(prompts[0].description).toBe('A simple greeting prompt');
    });

    it('should get a specific prompt', async () => {
      const result = await client.getPrompt({ name: 'greet' });
      const { prompt, messages } = result;
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

describe('MastraMCPClient - Elicitation Tests', () => {
  let testServer: {
    httpServer: HttpServer;
    mcpServer: McpServer;
    serverTransport: StreamableHTTPServerTransport;
    baseUrl: URL;
  };
  let client: InternalMastraMCPClient;

  beforeEach(async () => {
    testServer = await setupTestServer(false);

    // Add elicitation-enabled tools to the test server
    testServer.mcpServer.tool(
      'collectUserInfo',
      'Collects user information through elicitation',
      {
        message: z.string().describe('Message to show to user').default('Please provide your information'),
      },
      async ({ message }): Promise<CallToolResult> => {
        const result = await testServer.mcpServer.server.elicitInput({
          message: message,
          requestedSchema: {
            type: 'object',
            properties: {
              name: { type: 'string', title: 'Name' },
              email: { type: 'string', title: 'Email', format: 'email' },
            },
            required: ['name'],
          },
        });

        return {
          content: [{ type: 'text', text: JSON.stringify(result) }],
        };
      },
    );

    testServer.mcpServer.tool(
      'collectSensitiveInfo',
      'Collects sensitive information that might be rejected',
      {
        message: z.string().describe('Message to show to user').default('Please provide sensitive information'),
      },
      async ({ message }): Promise<CallToolResult> => {
        const result = await testServer.mcpServer.server.elicitInput({
          message: message,
          requestedSchema: {
            type: 'object',
            properties: {
              ssn: { type: 'string', title: 'Social Security Number' },
              creditCard: { type: 'string', title: 'Credit Card Number' },
            },
            required: ['ssn'],
          },
        });

        return {
          content: [{ type: 'text', text: JSON.stringify(result) }],
        };
      },
    );

    testServer.mcpServer.tool(
      'collectOptionalInfo',
      'Collects optional information that might be cancelled',
      {
        message: z.string().describe('Message to show to user').default('Optional information request'),
      },
      async ({ message }): Promise<CallToolResult> => {
        const result = await testServer.mcpServer.server.elicitInput({
          message: message,
          requestedSchema: {
            type: 'object',
            properties: {
              feedback: { type: 'string', title: 'Feedback' },
              rating: { type: 'number', title: 'Rating', minimum: 1, maximum: 5 },
            },
          },
        });

        return {
          content: [{ type: 'text', text: JSON.stringify(result) }],
        };
      },
    );
  });

  afterEach(async () => {
    await client?.disconnect().catch(() => {});
    await testServer?.mcpServer.close().catch(() => {});
    await testServer?.serverTransport.close().catch(() => {});
    testServer?.httpServer.close();
  });

  it('should handle elicitation request with accept response', async () => {
    const mockHandler = vi.fn(async request => {
      expect(request.message).toBe('Please provide your information');
      expect(request.requestedSchema).toBeDefined();
      expect(request.requestedSchema.properties.name).toBeDefined();
      expect(request.requestedSchema.properties.email).toBeDefined();

      return {
        action: 'accept' as const,
        content: {
          name: 'John Doe',
          email: 'john@example.com',
        },
      };
    });

    client = new InternalMastraMCPClient({
      name: 'elicitation-accept-client',
      server: {
        url: testServer.baseUrl,
      },
    });
    client.elicitation.onRequest(mockHandler);
    await client.connect();

    // Get the tools and call the elicitation tool
    const tools = await client.tools();
    const collectUserInfoTool = tools['collectUserInfo'];
    expect(collectUserInfoTool).toBeDefined();

    // Call the tool which will trigger elicitation
    const result = await collectUserInfoTool.execute({
      context: { message: 'Please provide your information' },
    });

    console.log('result', result);

    expect(mockHandler).toHaveBeenCalledTimes(1);
    expect(result.content).toBeDefined();
    expect(result.content[0].type).toBe('text');

    const elicitationResult = JSON.parse(result.content[0].text);
    expect(elicitationResult.action).toBe('accept');
    expect(elicitationResult.content).toEqual({
      name: 'John Doe',
      email: 'john@example.com',
    });
  });

  it('should handle elicitation request with reject response', async () => {
    const mockHandler = vi.fn(async request => {
      expect(request.message).toBe('Please provide sensitive information');
      return { action: 'decline' as const };
    });

    client = new InternalMastraMCPClient({
      name: 'elicitation-reject-client',
      server: {
        url: testServer.baseUrl,
      },
    });
    client.elicitation.onRequest(mockHandler);
    await client.connect();

    // Get the tools and call the sensitive info tool
    const tools = await client.tools();
    const collectSensitiveInfoTool = tools['collectSensitiveInfo'];
    expect(collectSensitiveInfoTool).toBeDefined();

    // Call the tool which will trigger elicitation
    const result = await collectSensitiveInfoTool.execute({
      context: { message: 'Please provide sensitive information' },
    });

    expect(mockHandler).toHaveBeenCalledTimes(1);
    expect(result.content).toBeDefined();
    expect(result.content[0].type).toBe('text');

    const elicitationResult = JSON.parse(result.content[0].text);
    expect(elicitationResult.action).toBe('decline');
  });

  it('should handle elicitation request with cancel response', async () => {
    const mockHandler = vi.fn(async _request => {
      return { action: 'cancel' as const };
    });

    client = new InternalMastraMCPClient({
      name: 'elicitation-cancel-client',
      server: {
        url: testServer.baseUrl,
      },
    });
    client.elicitation.onRequest(mockHandler);
    await client.connect();

    // Get the tools and call the optional info tool
    const tools = await client.tools();
    const collectOptionalInfoTool = tools['collectOptionalInfo'];
    expect(collectOptionalInfoTool).toBeDefined();

    // Call the tool which will trigger elicitation
    const result = await collectOptionalInfoTool.execute({
      context: { message: 'Optional information request' },
    });

    expect(mockHandler).toHaveBeenCalledTimes(1);
    expect(result.content).toBeDefined();
    expect(result.content[0].type).toBe('text');

    const elicitationResult = JSON.parse(result.content[0].text);
    expect(elicitationResult.action).toBe('cancel');
  });

  it('should return an error when elicitation handler throws error', async () => {
    const mockHandler = vi.fn(async _request => {
      throw new Error('Handler failed');
    });

    client = new InternalMastraMCPClient({
      name: 'elicitation-error-client',
      server: {
        url: testServer.baseUrl,
      },
    });
    client.elicitation.onRequest(mockHandler);
    await client.connect();

    // Get the tools and call a tool that will trigger elicitation
    const tools = await client.tools();
    const collectUserInfoTool = tools['collectUserInfo'];
    expect(collectUserInfoTool).toBeDefined();

    // Call the tool which will trigger elicitation, handler will throw error
    const result = await collectUserInfoTool.execute({
      context: { message: 'This will cause handler to throw' },
    });

    expect(mockHandler).toHaveBeenCalledTimes(1);
    expect(result.content).toBeDefined();

    expect(result.isError).toBe(true);
  });

  it('should return an error when client has no elicitation handler', async () => {
    client = new InternalMastraMCPClient({
      name: 'no-elicitation-client',
      server: {
        url: testServer.baseUrl,
        // No elicitationHandler provided
      },
    });
    await client.connect();

    // Get the tools and call a tool that will trigger elicitation
    const tools = await client.tools();
    const collectUserInfoTool = tools['collectUserInfo'];
    expect(collectUserInfoTool).toBeDefined();

    // Call the tool which will trigger elicitation, should fail gracefully
    const result = await collectUserInfoTool.execute({
      context: { message: 'This should fail gracefully' },
    });

    expect(result.content).toBeDefined();
    expect(result.isError).toBe(true);
  });

  it('should validate elicitation request schema structure', async () => {
    const mockHandler = vi.fn(async request => {
      // Verify the request has the expected structure
      expect(request).toHaveProperty('message');
      expect(request).toHaveProperty('requestedSchema');
      expect(typeof request.message).toBe('string');
      expect(typeof request.requestedSchema).toBe('object');
      expect(request.requestedSchema).toHaveProperty('type', 'object');
      expect(request.requestedSchema).toHaveProperty('properties');

      return {
        action: 'accept' as const,
        content: { validated: true },
      };
    });

    client = new InternalMastraMCPClient({
      name: 'schema-validation-client',
      server: {
        url: testServer.baseUrl,
      },
    });
    client.elicitation.onRequest(mockHandler);
    await client.connect();

    // Get the tools and call a tool that will trigger elicitation
    const tools = await client.tools();
    const collectUserInfoTool = tools['collectUserInfo'];
    expect(collectUserInfoTool).toBeDefined();

    // Call the tool which will trigger elicitation with schema validation
    const result = await collectUserInfoTool.execute({
      context: { message: 'Schema validation test' },
    });

    console.log('result', result);

    expect(mockHandler).toHaveBeenCalledTimes(1);
    expect(result.content).toBeDefined();
    expect(result.content[0].type).toBe('text');

    const elicitationResultText = result.content[0].text;
    expect(elicitationResultText).toContain('Elicitation response content does not match requested schema');
  });
});

describe('MastraMCPClient - AuthProvider Tests', () => {
  let testServer: {
    httpServer: HttpServer;
    mcpServer: McpServer;
    serverTransport: StreamableHTTPServerTransport;
    baseUrl: URL;
  };
  let client: InternalMastraMCPClient;

  beforeEach(async () => {
    testServer = await setupTestServer(false);
  });

  afterEach(async () => {
    await client?.disconnect().catch(() => {});
    await testServer?.mcpServer.close().catch(() => {});
    await testServer?.serverTransport.close().catch(() => {});
    testServer?.httpServer.close();
  });

  it('should accept authProvider field in HTTP server configuration', async () => {
    const mockAuthProvider = { test: 'authProvider' } as any;

    client = new InternalMastraMCPClient({
      name: 'auth-config-test',
      server: {
        url: testServer.baseUrl,
        authProvider: mockAuthProvider,
      },
    });

    const serverConfig = (client as any).serverConfig;
    expect(serverConfig.authProvider).toBe(mockAuthProvider);
    expect(client).toBeDefined();
    expect(typeof client).toBe('object');
  });

  it('should handle undefined authProvider gracefully', async () => {
    client = new InternalMastraMCPClient({
      name: 'auth-undefined-test',
      server: {
        url: testServer.baseUrl,
        authProvider: undefined,
      },
    });

    await client.connect();
    const tools = await client.tools();
    expect(tools).toHaveProperty('greet');
  });

  it('should work without authProvider for HTTP transport (backward compatibility)', async () => {
    client = new InternalMastraMCPClient({
      name: 'no-auth-http-client',
      server: {
        url: testServer.baseUrl,
      },
    });

    await client.connect();
    const tools = await client.tools();
    expect(tools).toHaveProperty('greet');
  });
});
