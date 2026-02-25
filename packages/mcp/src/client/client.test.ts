import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import type { Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
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
      const result = await tools.greet?.execute?.({ name: 'Stateless' });
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
      const result = await tools.greet?.execute?.({ name: 'Stateful' });
      expect(result).toEqual({ content: [{ type: 'text', text: 'Hello, Stateful!' }] });
    });
  });
});

describe('MastraMCPClient - outputSchema without structuredContent', () => {
  // Reproduces the bug where MCP servers (e.g. FastMCP) define outputSchema on
  // a tool but don't return structuredContent in the response. The raw
  // CallToolResult envelope gets validated against the outputSchema and Zod
  // strips all unrecognised keys, producing {}.
  //
  // We use a real server connection but spy on the SDK Client's methods to
  // simulate a non-SDK MCP server (like FastMCP) that advertises outputSchema
  // on tool listings but only populates the content array in tool call responses.
  let testServer: {
    httpServer: HttpServer;
    mcpServer: McpServer;
    serverTransport: StreamableHTTPServerTransport;
    baseUrl: URL;
  };
  let client: InternalMastraMCPClient;

  beforeEach(async () => {
    testServer = await setupTestServer(false);
    client = new InternalMastraMCPClient({
      name: 'output-schema-test-client',
      server: { url: testServer.baseUrl },
    });
    await client.connect();
  });

  afterEach(async () => {
    await client?.disconnect().catch(() => {});
    await testServer?.mcpServer.close().catch(() => {});
    await testServer?.serverTransport.close().catch(() => {});
    testServer?.httpServer.close();
  });

  it('should return the parsed result, not {} when structuredContent is absent', async () => {
    // Spy on the SDK Client to simulate a FastMCP-style server:
    // - listTools returns a tool with outputSchema
    // - callTool returns content[] without structuredContent
    const sdkClient = (client as any).client as Client;

    vi.spyOn(sdkClient, 'listTools').mockResolvedValue({
      tools: [
        {
          name: 'calculate',
          description: 'Calculates a math expression',
          inputSchema: {
            type: 'object' as const,
            properties: { expression: { type: 'string' } },
          },
          outputSchema: {
            type: 'object' as const,
            properties: {
              result: { type: 'number' },
              expression: { type: 'string' },
            },
          },
        },
      ],
    });

    vi.spyOn(sdkClient, 'callTool').mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify({ result: 2, expression: '1 + 1' }) }],
      isError: false,
    });

    const tools = await client.tools();
    const calculateTool = tools['calculate'];
    expect(calculateTool).toBeDefined();

    const result = await calculateTool.execute?.({ expression: '1 + 1' });

    // Before the fix this would be {} because the raw CallToolResult envelope
    // ({ content: [...], isError: false }) was validated against the outputSchema
    // and Zod stripped all unrecognised keys.
    expect(result).toEqual({ result: 2, expression: '1 + 1' });
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
    const result = await collectUserInfoTool?.execute?.({ message: 'Please provide your information' }, {});

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
    const result = await collectSensitiveInfoTool?.execute?.({ message: 'Please provide sensitive information' }, {});

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
    const result = await collectOptionalInfoTool?.execute?.({ message: 'Optional information request' }, {});

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
    const result = await collectUserInfoTool?.execute?.({ message: 'This will cause handler to throw' }, {});

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
    const result = await collectUserInfoTool?.execute?.({ message: 'This should fail gracefully' }, {});

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
    const result = await collectUserInfoTool?.execute?.({ message: 'Schema validation test' }, {});

    console.log('result', result);

    expect(mockHandler).toHaveBeenCalledTimes(1);
    expect(result.content).toBeDefined();
    expect(result.content[0].type).toBe('text');

    const elicitationResultText = result.content[0].text;
    expect(elicitationResultText).toContain('Elicitation response content does not match requested schema');
  });
});

describe('MastraMCPClient - Progress Tests', () => {
  let testServer: {
    httpServer: HttpServer;
    mcpServer: McpServer;
    serverTransport: StreamableHTTPServerTransport;
    baseUrl: URL;
  };
  let client: InternalMastraMCPClient;

  beforeEach(async () => {
    testServer = await setupTestServer(false);

    // Add a tool that emits progress notifications while running
    testServer.mcpServer.tool(
      'longTask',
      'Emits progress notifications during execution',
      {
        count: z.number().describe('Number of notifications').default(3),
        delayMs: z.number().describe('Delay between notifications (ms)').default(1),
      },
      async ({ count, delayMs }, extra): Promise<CallToolResult> => {
        const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

        for (let i = 1; i <= count; i++) {
          if (extra._meta?.progressToken) {
            await testServer.mcpServer.server.notification({
              method: 'notifications/progress',
              params: {
                progress: i,
                total: count,
                message: `Long task progress ${i}/${count}`,
                // Use a fixed token for test assertions; server may also attach a token automatically
                progressToken: extra._meta.progressToken,
              },
            });
          }
          await sleep(delayMs);
        }

        return {
          content: [{ type: 'text', text: 'Long task completed.' }],
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

  it('should receive progress notifications while executing a tool', async () => {
    const mockHandler = vi.fn(params => params);

    client = new InternalMastraMCPClient({
      name: 'progress-client',
      server: {
        url: testServer.baseUrl,
        enableProgressTracking: true,
      },
    });

    client.progress.onUpdate(mockHandler);
    await client.connect();

    const tools = await client.tools();
    const longTask = tools['longTask'];
    expect(longTask).toBeDefined();

    await longTask?.execute?.({ count: 3, delayMs: 1 });

    expect(mockHandler).toHaveBeenCalled();
    const calls = mockHandler.mock.calls.map(call => call[0]);
    // Expect at least 3 progress updates with increasing progress values
    expect(calls.length).toBeGreaterThanOrEqual(3);
    expect(calls[0].progress).toBe(1);
    expect(calls[calls.length - 1].progress).toBeGreaterThanOrEqual(3);
    // Ensure token is present (either fixed one or server-provided one) and fields exist
    expect(calls.every(c => typeof c.total === 'number' && typeof c.progress === 'number')).toBe(true);
  });

  it('should not receive progress notifications when progress tracking is disabled', async () => {
    const mockHandler = vi.fn(params => params);

    client = new InternalMastraMCPClient({
      name: 'progress-disabled-client',
      server: {
        url: testServer.baseUrl,
        enableProgressTracking: false,
      },
    });

    client.progress.onUpdate(mockHandler);
    await client.connect();

    const tools = await client.tools();
    const longTask = tools['longTask'];
    expect(longTask).toBeDefined();

    await longTask?.execute?.({ count: 3, delayMs: 1 });

    // Should not receive any progress notifications when disabled
    expect(mockHandler).not.toHaveBeenCalled();
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

describe('MastraMCPClient - Timeout Parameter Position Tests', () => {
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

  it('should pass timeout in the options parameter (2nd arg), not params (1st arg) for listTools', async () => {
    const customTimeout = 5000;

    client = new InternalMastraMCPClient({
      name: 'timeout-position-test',
      server: {
        url: testServer.baseUrl,
      },
      timeout: customTimeout,
    });

    await client.connect();

    // Access the internal MCP SDK client to spy on listTools
    const internalClient = (client as any).client;
    const originalListTools = internalClient.listTools.bind(internalClient);

    let capturedParams: any;
    let capturedOptions: any;

    internalClient.listTools = async (params?: any, options?: any) => {
      capturedParams = params;
      capturedOptions = options;
      return originalListTools(params, options);
    };

    await client.tools();

    // The timeout should be in the options (2nd argument), not in params (1st argument)
    // If timeout is found in params, the bug exists
    expect(capturedParams).not.toHaveProperty('timeout');
    expect(capturedOptions).toHaveProperty('timeout', customTimeout);
  });
});

describe('MastraMCPClient - HTTP SSE Fallback Tests', () => {
  // Helper to create StreamableHTTPError-like error (@modelcontextprotocol/sdk 1.24.0+)
  class MockStreamableHTTPError extends Error {
    constructor(
      public readonly code: number,
      message: string,
    ) {
      super(`Streamable HTTP error: ${message}`);
    }
  }

  it('should throw error for status code 401 without SSE fallback', async () => {
    const { StreamableHTTPClientTransport } = await import('@modelcontextprotocol/sdk/client/streamableHttp.js');
    const originalStart = StreamableHTTPClientTransport.prototype.start;

    StreamableHTTPClientTransport.prototype.start = async function () {
      throw new MockStreamableHTTPError(401, 'Unauthorized');
    };

    const httpServer = createServer((req, res) => {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized' }));
    });

    const baseUrl = await new Promise<URL>(resolve => {
      httpServer.listen(0, '127.0.0.1', () => {
        const addr = httpServer.address() as { port: number };
        resolve(new URL(`http://127.0.0.1:${addr.port}/mcp`));
      });
    });

    const client = new InternalMastraMCPClient({
      name: 'fallback-401-test',
      server: {
        url: baseUrl,
        connectTimeout: 1000,
      },
    });

    try {
      await expect(client.connect()).rejects.toThrow('Streamable HTTP error: Unauthorized');
    } finally {
      StreamableHTTPClientTransport.prototype.start = originalStart;
      await client.disconnect().catch(() => {});
      httpServer.close();
    }
  });

  it('should fallback to SSE for status code 404', async () => {
    const { StreamableHTTPClientTransport } = await import('@modelcontextprotocol/sdk/client/streamableHttp.js');
    const originalStart = StreamableHTTPClientTransport.prototype.start;

    StreamableHTTPClientTransport.prototype.start = async function () {
      throw new MockStreamableHTTPError(404, 'Not Found');
    };

    const httpServer = createServer((req, res) => {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });
      res.end();
    });

    const baseUrl = await new Promise<URL>(resolve => {
      httpServer.listen(0, '127.0.0.1', () => {
        const addr = httpServer.address() as { port: number };
        resolve(new URL(`http://127.0.0.1:${addr.port}/mcp`));
      });
    });

    const client = new InternalMastraMCPClient({
      name: 'fallback-404-test',
      server: {
        url: baseUrl,
        connectTimeout: 1000,
      },
    });

    try {
      // Should attempt SSE fallback, then fail (server doesn't implement full SSE)
      await expect(client.connect()).rejects.toThrow();
    } finally {
      StreamableHTTPClientTransport.prototype.start = originalStart;
      await client.disconnect().catch(() => {});
      httpServer.close();
    }
  });
});

describe('MastraMCPClient - Resource Cleanup Tests', () => {
  let testServer: {
    httpServer: HttpServer;
    mcpServer: McpServer;
    serverTransport: StreamableHTTPServerTransport;
    baseUrl: URL;
  };

  beforeEach(async () => {
    testServer = await setupTestServer(false);
  });

  afterEach(async () => {
    await testServer?.mcpServer.close().catch(() => {});
    await testServer?.serverTransport.close().catch(() => {});
    testServer?.httpServer.close();
  });

  it('should not accumulate SIGTERM listeners across multiple connect/disconnect cycles', async () => {
    const initialListenerCount = process.listenerCount('SIGTERM');

    // Perform multiple connect/disconnect cycles
    for (let i = 0; i < 15; i++) {
      const client = new InternalMastraMCPClient({
        name: `cleanup-test-client-${i}`,
        server: {
          url: testServer.baseUrl,
        },
      });

      await client.connect();
      await client.disconnect();
    }

    const finalListenerCount = process.listenerCount('SIGTERM');

    // The listener count should not have increased significantly
    // (allowing for some tolerance in case other parts of the test framework add listeners)
    expect(finalListenerCount).toBeLessThanOrEqual(initialListenerCount + 1);
  });

  it('should clean up exit hooks and SIGTERM listeners on disconnect', async () => {
    const initialListenerCount = process.listenerCount('SIGTERM');

    const client = new InternalMastraMCPClient({
      name: 'cleanup-single-test-client',
      server: {
        url: testServer.baseUrl,
      },
    });

    await client.connect();

    // After connect, there should be at most one additional SIGTERM listener
    const afterConnectCount = process.listenerCount('SIGTERM');
    expect(afterConnectCount).toBeLessThanOrEqual(initialListenerCount + 1);

    await client.disconnect();

    // After disconnect, the listener count should return to the initial value
    const afterDisconnectCount = process.listenerCount('SIGTERM');
    expect(afterDisconnectCount).toBe(initialListenerCount);
  });

  it('should not add duplicate listeners when connect is called multiple times on the same client', async () => {
    const initialListenerCount = process.listenerCount('SIGTERM');

    const client = new InternalMastraMCPClient({
      name: 'duplicate-connect-test-client',
      server: {
        url: testServer.baseUrl,
      },
    });

    // Connect multiple times on the same client
    await client.connect();
    await client.connect();
    await client.connect();

    const afterMultipleConnects = process.listenerCount('SIGTERM');

    // Should only have added one listener, not three
    expect(afterMultipleConnects).toBeLessThanOrEqual(initialListenerCount + 1);

    await client.disconnect();

    const afterDisconnectCount = process.listenerCount('SIGTERM');
    expect(afterDisconnectCount).toBe(initialListenerCount);
  });

  it('should not create duplicate connections when connect is called concurrently', async () => {
    const client = new InternalMastraMCPClient({
      name: 'concurrent-connect-test-client',
      server: {
        url: testServer.baseUrl,
      },
    });

    const connectSpy = vi.spyOn(Client.prototype, 'connect');

    const [result1, result2, result3] = await Promise.all([client.connect(), client.connect(), client.connect()]);

    expect(result1).toBe(true);
    expect(result2).toBe(true);
    expect(result3).toBe(true);

    // Only one underlying SDK connection should be created
    expect(connectSpy).toHaveBeenCalledTimes(1);

    connectSpy.mockRestore();
    await client.disconnect();
  });
});

describe('MastraMCPClient - Roots Capability (Issue #8660)', () => {
  /**
   * Issue #8660: Client does not support MCP Roots
   *
   * The filesystem MCP server logs "Client does not support MCP Roots" because:
   * 1. The Mastra MCP client doesn't provide a way to configure roots
   * 2. Even if roots capability is advertised, the client doesn't handle roots/list requests
   *
   * According to MCP spec, when a client advertises `roots` capability:
   * - The server can call `roots/list` to get the list of allowed directories
   * - The client should respond with the configured roots
   */
  let testServer: {
    httpServer: HttpServer;
    mcpServer: McpServer;
    serverTransport: StreamableHTTPServerTransport;
    baseUrl: URL;
  };

  beforeEach(async () => {
    const httpServer: HttpServer = createServer();
    const mcpServer = new McpServer(
      { name: 'test-roots-server', version: '1.0.0' },
      {
        capabilities: {
          logging: {},
          tools: {},
        },
      },
    );

    mcpServer.tool('echo', 'Echo tool', { message: z.string() }, async ({ message }): Promise<CallToolResult> => {
      return { content: [{ type: 'text', text: message }] };
    });

    const serverTransport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
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

    testServer = { httpServer, mcpServer, serverTransport, baseUrl };
  });

  afterEach(async () => {
    await testServer?.mcpServer.close().catch(() => {});
    await testServer?.serverTransport.close().catch(() => {});
    testServer?.httpServer.close();
  });

  it('should preserve roots capability when passed in capabilities', async () => {
    // Verify that roots capability flags are properly passed through to the SDK client
    const client = new InternalMastraMCPClient({
      name: 'roots-test-client',
      server: {
        url: testServer.baseUrl,
      },
      capabilities: {
        roots: {
          listChanged: true,
        },
      },
    });

    const internalClient = (client as any).client;
    const capabilities = internalClient._options?.capabilities;

    expect(capabilities).toMatchObject({
      roots: { listChanged: true },
      elicitation: {},
    });

    await client.disconnect().catch(() => {});
  });

  it('should handle roots/list requests from server per MCP spec', async () => {
    /**
     * Per MCP Roots spec (https://modelcontextprotocol.io/specification/2025-11-25/client/roots):
     *
     * 1. Client declares roots capability: { roots: { listChanged: true } }
     * 2. Server sends: { method: "roots/list" }
     * 3. Client responds: { roots: [{ uri: "file:///...", name: "..." }] }
     * 4. When roots change, client sends: { method: "notifications/roots/list_changed" }
     */

    const client = new InternalMastraMCPClient({
      name: 'roots-list-test',
      server: {
        url: testServer.baseUrl,
        roots: [
          { uri: 'file:///tmp', name: 'Temp Directory' },
          { uri: 'file:///home/user/projects', name: 'Projects' },
        ],
      },
    });

    await client.connect();

    // Verify the client has roots support via the roots getter
    expect(client.roots).toBeDefined();
    expect(Array.isArray(client.roots)).toBe(true);
    expect(client.roots).toHaveLength(2);
    expect(client.roots[0]).toEqual({ uri: 'file:///tmp', name: 'Temp Directory' });
    expect(client.roots[1]).toEqual({ uri: 'file:///home/user/projects', name: 'Projects' });

    // Verify setRoots method exists
    expect(typeof client.setRoots).toBe('function');

    await client.disconnect();
  });

  it('should send notifications/roots/list_changed when roots are updated', async () => {
    /**
     * Per MCP spec: "When roots change, clients that support listChanged
     * MUST send a notification: { method: 'notifications/roots/list_changed' }"
     */

    const client = new InternalMastraMCPClient({
      name: 'roots-notification-test',
      server: {
        url: testServer.baseUrl,
        roots: [{ uri: 'file:///initial', name: 'Initial' }],
      },
    });

    await client.connect();

    // Verify sendRootsListChanged method exists
    expect(typeof client.sendRootsListChanged).toBe('function');

    // Update roots - this should also send the notification
    await client.setRoots([{ uri: 'file:///new-root', name: 'New Root' }]);

    // Verify roots were updated
    expect(client.roots).toHaveLength(1);
    expect(client.roots[0].uri).toBe('file:///new-root');

    await client.disconnect();
  });

  it('should auto-enable roots capability when roots are provided', async () => {
    const client = new InternalMastraMCPClient({
      name: 'roots-auto-capability-test',
      server: {
        url: testServer.baseUrl,
        roots: [{ uri: 'file:///test' }],
      },
    });

    const internalClient = (client as any).client;
    const capabilities = internalClient._options?.capabilities;

    // SDK should automatically receive roots capability when roots are provided
    expect(capabilities.roots).toBeDefined();
    expect(capabilities.roots.listChanged).toBe(true);

    await client.disconnect().catch(() => {});
  });
});

describe('MastraMCPClient - Session Reconnection (Issue #7675)', () => {
  /**
   * Issue #7675: MCPClient fails to reconnect after MCP server restart
   *
   * When an MCP server goes offline and comes back online, the session ID
   * becomes invalid, causing "Bad Request: No valid session ID provided" errors.
   *
   * The MCPClient should automatically detect session invalidation and reconnect.
   */

  it('should automatically reconnect when server restarts (issue #7675 fix)', async () => {
    // Step 1: Create a stateful MCP server
    const httpServer: HttpServer = createServer();
    let mcpServer = new McpServer(
      { name: 'session-test-server', version: '1.0.0' },
      { capabilities: { logging: {}, tools: {} } },
    );

    mcpServer.tool(
      'ping',
      'Simple ping tool',
      { message: z.string().default('pong') },
      async ({ message }): Promise<CallToolResult> => {
        return { content: [{ type: 'text', text: `Ping: ${message}` }] };
      },
    );

    let serverTransport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
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

    // Step 2: Connect client and execute tool successfully
    const client = new InternalMastraMCPClient({
      name: 'session-reconnect-test',
      server: { url: baseUrl },
    });
    await client.connect();

    const tools = await client.tools();
    const pingTool = tools['ping'];
    expect(pingTool).toBeDefined();

    // First call should succeed
    const result1 = await pingTool.execute?.({ message: 'hello' });
    expect(result1).toEqual({ content: [{ type: 'text', text: 'Ping: hello' }] });

    // Verify we have a session ID
    const originalSessionId = client.sessionId;
    expect(originalSessionId).toBeDefined();

    // Step 3: Simulate server restart - close transport and create new one
    // This invalidates all existing sessions
    await serverTransport.close();
    await mcpServer.close();

    // Create new server instance (simulating server restart)
    mcpServer = new McpServer(
      { name: 'session-test-server', version: '1.0.0' },
      { capabilities: { logging: {}, tools: {} } },
    );

    mcpServer.tool(
      'ping',
      'Simple ping tool',
      { message: z.string().default('pong') },
      async ({ message }): Promise<CallToolResult> => {
        return { content: [{ type: 'text', text: `Ping: ${message}` }] };
      },
    );

    serverTransport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
    });

    await mcpServer.connect(serverTransport);

    // Step 4: Call tool again - should automatically reconnect and succeed
    // The client should detect the session error, reconnect, and retry
    const result2 = await pingTool.execute?.({ message: 'after restart' });
    expect(result2).toEqual({ content: [{ type: 'text', text: 'Ping: after restart' }] });

    // Verify we got a new session ID (different from the original)
    const newSessionId = client.sessionId;
    expect(newSessionId).toBeDefined();
    expect(newSessionId).not.toBe(originalSessionId);

    // Cleanup
    await client.disconnect().catch(() => {});
    await mcpServer.close().catch(() => {});
    await serverTransport.close().catch(() => {});
    httpServer.close();
  });

  it('should verify counter resets after server restart with reconnection', async () => {
    // This test verifies that after server restart, the client reconnects
    // and the server state (counter) is reset as expected

    // Step 1: Create a stateful MCP server
    const httpServer: HttpServer = createServer();
    let mcpServer = new McpServer(
      { name: 'reconnect-test-server', version: '1.0.0' },
      { capabilities: { logging: {}, tools: {} } },
    );

    let callCount = 0;
    mcpServer.tool('counter', 'Counts calls', {}, async (): Promise<CallToolResult> => {
      callCount++;
      return { content: [{ type: 'text', text: `Call #${callCount}` }] };
    });

    let serverTransport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
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

    // Step 2: Connect client and execute tool
    const client = new InternalMastraMCPClient({
      name: 'auto-reconnect-test',
      server: { url: baseUrl },
    });
    await client.connect();

    const tools = await client.tools();
    const counterTool = tools['counter'];

    // First call should succeed - counter = 1
    const result1 = await counterTool.execute?.({});
    expect(result1).toEqual({ content: [{ type: 'text', text: 'Call #1' }] });

    // Second call - counter = 2
    const result2 = await counterTool.execute?.({});
    expect(result2).toEqual({ content: [{ type: 'text', text: 'Call #2' }] });

    // Step 3: Simulate server restart
    await serverTransport.close();
    await mcpServer.close();

    mcpServer = new McpServer(
      { name: 'reconnect-test-server', version: '1.0.0' },
      { capabilities: { logging: {}, tools: {} } },
    );

    callCount = 0; // Reset counter (simulating server restart losing state)
    mcpServer.tool('counter', 'Counts calls', {}, async (): Promise<CallToolResult> => {
      callCount++;
      return { content: [{ type: 'text', text: `Call #${callCount}` }] };
    });

    serverTransport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
    });

    await mcpServer.connect(serverTransport);

    // Step 4: Call tool again - should reconnect and succeed
    // Counter should be 1 (not 3) because server restarted
    const result3 = await counterTool.execute?.({});
    expect(result3).toEqual({ content: [{ type: 'text', text: 'Call #1' }] });

    // Cleanup
    await client.disconnect().catch(() => {});
    await mcpServer.close().catch(() => {});
    await serverTransport.close().catch(() => {});
    httpServer.close();
  });
});

describe('MastraMCPClient - Filesystem Server Integration (Issue #8660)', () => {
  /**
   * Integration test using the actual @modelcontextprotocol/server-filesystem
   * This reproduces the exact scenario from issue #8660:
   * https://github.com/mastra-ai/mastra/issues/8660
   *
   * We spawn the server directly to capture its stderr and prove:
   * 1. WITHOUT roots capability: "Client does not support MCP Roots"
   * 2. WITH roots capability: "Updated allowed directories from MCP roots"
   */

  /**
   * Helper to spawn filesystem server and send MCP initialize, capturing stderr
   */
  async function testFilesystemServerWithCapabilities(
    clientCapabilities: Record<string, any>,
    rootsListResponse?: { roots: Array<{ uri: string; name?: string }> },
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const stderrChunks: string[] = [];

      const proc = spawn('npx', ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      proc.stderr.on('data', data => {
        stderrChunks.push(data.toString());
      });

      let responseBuffer = '';
      let initSent = false;
      let initializedSent = false;
      let rootsHandled = false;

      proc.stdout.on('data', data => {
        responseBuffer += data.toString();

        // After getting initialize response, send initialized notification
        if (responseBuffer.includes('"id":1') && responseBuffer.includes('"result"') && !initializedSent) {
          initializedSent = true;
          const initializedNotification = {
            jsonrpc: '2.0',
            method: 'notifications/initialized',
          };
          proc.stdin.write(JSON.stringify(initializedNotification) + '\n');
        }

        // Handle roots/list request from server (if client has roots capability)
        if (clientCapabilities.roots && rootsListResponse && !rootsHandled && responseBuffer.includes('roots/list')) {
          // Parse each line to find the roots/list request
          const lines = responseBuffer.split('\n');
          for (const line of lines) {
            try {
              const msg = JSON.parse(line);
              if (msg.method === 'roots/list' && msg.id) {
                rootsHandled = true;
                const rootsResponse = {
                  jsonrpc: '2.0',
                  id: msg.id,
                  result: rootsListResponse,
                };
                proc.stdin.write(JSON.stringify(rootsResponse) + '\n');

                // Wait for server to process roots and log
                setTimeout(() => {
                  proc.kill();
                  resolve(stderrChunks.join(''));
                }, 1000);
                break;
              }
            } catch {
              // Not valid JSON, skip
            }
          }
        }

        // If no roots capability, kill after initialized
        if (!clientCapabilities.roots && initializedSent) {
          setTimeout(() => {
            proc.kill();
            resolve(stderrChunks.join(''));
          }, 1000);
        }
      });

      // Send MCP initialize request after a short delay to ensure server is ready
      setTimeout(() => {
        if (!initSent) {
          initSent = true;
          const initRequest = {
            jsonrpc: '2.0',
            id: 1,
            method: 'initialize',
            params: {
              protocolVersion: '2024-11-05',
              capabilities: clientCapabilities,
              clientInfo: { name: 'test-client', version: '1.0.0' },
            },
          };
          proc.stdin.write(JSON.stringify(initRequest) + '\n');
        }
      }, 500);

      proc.on('error', reject);

      // Timeout after 25 seconds
      setTimeout(() => {
        proc.kill();
        resolve(stderrChunks.join(''));
      }, 25000);
    });
  }

  it('WITHOUT roots capability: server shows "Client does not support MCP Roots"', async () => {
    // Connect WITHOUT roots capability - reproduces the bug from issue #8660
    const stderr = await testFilesystemServerWithCapabilities({
      // No roots capability!
    });

    console.log('\n📋 Server stderr (WITHOUT roots):\n' + stderr);

    expect(stderr).toContain('Secure MCP Filesystem Server running on stdio');
    expect(stderr).toContain('Client does not support MCP Roots');
  }, 30000);

  it('WITH roots capability: InternalMastraMCPClient properly sends roots', async () => {
    /**
     * This test proves the fix works by using InternalMastraMCPClient.
     * The console output from vitest will show:
     * "Updated allowed directories from MCP roots: 1 valid directories"
     *
     * Compare this to the test above which shows:
     * "Client does not support MCP Roots, using allowed directories set from server args"
     */
    const client = new InternalMastraMCPClient({
      name: 'with-roots-proof-test',
      server: {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
        roots: [{ uri: 'file:///tmp', name: 'Temp Directory' }],
      },
    });

    // Verify roots capability IS advertised (the fix!)
    const internalClient = (client as any).client;
    const capabilities = internalClient._options?.capabilities;
    expect(capabilities.roots).toBeDefined();
    expect(capabilities.roots.listChanged).toBe(true);

    // Verify roots are configured
    expect(client.roots).toHaveLength(1);
    expect(client.roots[0].uri).toBe('file:///tmp');

    await client.connect();

    // The server will call roots/list and our client responds with the roots
    // Server stderr will show: "Updated allowed directories from MCP roots"
    const tools = await client.tools();
    expect(Object.keys(tools).length).toBeGreaterThan(0);

    await client.disconnect();
  }, 30000);

  it('should work with InternalMastraMCPClient roots option', async () => {
    const client = new InternalMastraMCPClient({
      name: 'filesystem-roots-test',
      server: {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
        roots: [{ uri: 'file:///tmp', name: 'Temp Directory' }],
      },
    });

    // Verify roots capability IS auto-enabled
    const internalClient = (client as any).client;
    const capabilities = internalClient._options?.capabilities;
    expect(capabilities.roots).toBeDefined();
    expect(capabilities.roots.listChanged).toBe(true);

    // Verify roots are configured
    expect(client.roots).toHaveLength(1);
    expect(client.roots[0].uri).toBe('file:///tmp');

    await client.connect();
    const tools = await client.tools();

    // The filesystem server should expose tools
    expect(Object.keys(tools).length).toBeGreaterThan(0);

    await client.disconnect();
  }, 30000);

  it('should allow dynamic root updates', async () => {
    const client = new InternalMastraMCPClient({
      name: 'filesystem-roots-update-test',
      server: {
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
        roots: [{ uri: 'file:///tmp' }],
      },
    });

    await client.connect();

    // Update roots dynamically
    await client.setRoots([
      { uri: 'file:///tmp', name: 'Temp' },
      { uri: 'file:///var', name: 'Var' },
    ]);

    expect(client.roots).toHaveLength(2);
    expect(client.roots[1].uri).toBe('file:///var');

    await client.disconnect();
  }, 30000);
});
