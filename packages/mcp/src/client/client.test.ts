import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import { createServer } from 'node:http';
import type { Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { RequestContext } from '@mastra/core/di';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { z } from 'zod/v3';

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
      description: 'A simple greeting prompt',
      messages: [
        {
          role: 'assistant',
          content: { type: 'text', text: `Hello, World!` },
        },
      ],
    };
  });

  if (withSessionManagement) {
    const serverTransport = new StreamableHTTPServerTransport({
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

    return { httpServer, mcpServer, serverTransport, baseUrl };
  }

  // Stateless mode: SDK 1.27+ requires a new transport per request.
  // We must close the previous connection before reconnecting.
  httpServer.on('request', async (req, res) => {
    await mcpServer.close().catch(() => {});
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    await mcpServer.connect(transport);
    await transport.handleRequest(req, res);
  });

  const baseUrl = await new Promise<URL>(resolve => {
    httpServer.listen(0, '127.0.0.1', () => {
      const addr = httpServer.address() as AddressInfo;
      resolve(new URL(`http://127.0.0.1:${addr.port}/mcp`));
    });
  });

  return { httpServer, mcpServer, serverTransport: undefined as any, baseUrl };
}

describe('InternalMastraMCPClient - jsonSchemaValidator pass-through', () => {
  it('should forward jsonSchemaValidator to the underlying SDK Client', () => {
    const customValidator = {
      getValidator: vi.fn(() => (input: unknown) => ({
        valid: true as const,
        data: input,
        errorMessage: undefined,
      })),
    };

    const client = new InternalMastraMCPClient({
      name: 'validator-pass-through-client',
      server: {
        url: new URL('http://127.0.0.1:0/mcp'),
        jsonSchemaValidator: customValidator,
      },
    });

    // @ts-expect-error - accessing internal SDK property for testing
    const sdkClient = client.client as Client;

    // @ts-expect-error - accessing internal SDK property for testing
    expect(sdkClient._jsonSchemaValidator).toBe(customValidator);
  });

  it('should leave the SDK Client default validator in place when omitted', () => {
    const client = new InternalMastraMCPClient({
      name: 'default-validator-client',
      server: {
        url: new URL('http://127.0.0.1:0/mcp'),
      },
    });

    // @ts-expect-error - accessing internal SDK property for testing
    const sdkClient = client.client as Client;

    // SDK falls back to its built-in default (AJV) when nothing is forwarded
    // @ts-expect-error - accessing internal SDK property for testing
    expect(sdkClient._jsonSchemaValidator).not.toBeUndefined();
  });
});

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
      await testServer?.serverTransport?.close().catch(() => {});
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
      // Returns the full CallToolResult envelope
      expect(result).toEqual({
        content: [{ type: 'text', text: 'Hello, Stateless!' }],
      });
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
      const { description, messages } = result;
      expect(description).toBe('A simple greeting prompt');
      expect(messages).toBeDefined();
      const messageItem = messages[0];
      expect(messageItem.content.type === 'text' && messageItem.content.text).toBe('Hello, World!');
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
      await testServer?.serverTransport?.close().catch(() => {});
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
      // Returns the full CallToolResult envelope
      expect(result).toEqual({
        content: [{ type: 'text', text: 'Hello, Stateful!' }],
      });
    });
  });
});

describe('MastraMCPClient - outputSchema without structuredContent', () => {
  // When MCP servers (e.g. FastMCP) define outputSchema on a tool but don't
  // return structuredContent in the response, the full CallToolResult envelope
  // should be returned as-is. We don't pass outputSchema to createTool, so
  // Zod won't strip unrecognised keys. The MCP SDK validates structuredContent
  // against outputSchema internally via AJV.
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
    await testServer?.serverTransport?.close().catch(() => {});
    testServer?.httpServer.close();
  });

  it('should return the full CallToolResult envelope when structuredContent is absent', async () => {
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

    const callToolResult = {
      content: [{ type: 'text', text: JSON.stringify({ result: 2, expression: '1 + 1' }) }],
      isError: false,
    };

    vi.spyOn(sdkClient, 'callTool').mockResolvedValue(callToolResult);

    const tools = await client.tools();
    const calculateTool = tools['calculate'];
    expect(calculateTool).toBeDefined();

    const result = await calculateTool.execute?.({ expression: '1 + 1' });

    // The full CallToolResult envelope is returned — no extraction, no Zod stripping
    expect(result).toEqual(callToolResult);
  });

  it('should preserve recursive $ref input schemas when creating tools', async () => {
    const sdkClient = (client as any).client as Client;
    const recursiveInputSchema = {
      type: 'object' as const,
      properties: {
        root: { $ref: '#/$defs/node' },
      },
      required: ['root'],
      $defs: {
        node: {
          type: 'object' as const,
          properties: {
            name: { type: 'string' as const },
            children: {
              type: 'array' as const,
              items: { $ref: '#/$defs/node' },
            },
          },
          required: ['name'],
        },
      },
    };

    vi.spyOn(sdkClient, 'listTools').mockResolvedValue({
      tools: [
        {
          name: 'recursive_tool',
          description: 'Returns a recursive schema',
          inputSchema: recursiveInputSchema,
        },
      ],
    });

    const tools = await client.tools();
    const recursiveTool = tools['recursive_tool'];
    expect(recursiveTool).toBeDefined();

    const storedSchema = recursiveTool.inputSchema?.['~standard'].jsonSchema.input({ target: 'draft-07' }) as {
      properties?: { root?: { $ref?: string } };
      $defs?: {
        node?: {
          properties?: {
            children?: {
              items?: { $ref?: string };
            };
          };
        };
      };
    };

    expect(storedSchema.properties?.root?.$ref).toBe('#/$defs/node');
    expect(storedSchema.$defs?.node?.properties?.children?.items?.$ref).toBe('#/$defs/node');
  });
});

describe('MastraMCPClient - no outputSchema', () => {
  // MCP tools that do NOT declare an outputSchema return the full
  // CallToolResult envelope. We don't extract or transform the result.
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
      name: 'no-output-schema-test-client',
      server: { url: testServer.baseUrl },
    });
    await client.connect();
  });

  afterEach(async () => {
    await client?.disconnect().catch(() => {});
    await testServer?.mcpServer.close().catch(() => {});
    await testServer?.serverTransport?.close().catch(() => {});
    testServer?.httpServer.close();
  });

  it('should return the full CallToolResult envelope when no outputSchema', async () => {
    const sdkClient = (client as any).client as Client;

    vi.spyOn(sdkClient, 'listTools').mockResolvedValue({
      tools: [
        {
          name: 'get_patient',
          description: 'Get patient information',
          inputSchema: {
            type: 'object' as const,
            properties: { patientId: { type: 'string' } },
          },
          // No outputSchema defined
        },
      ],
    });

    const callToolResult = {
      content: [{ type: 'text', text: JSON.stringify({ success: true, patient: { id: '123' } }) }],
      isError: false,
    };

    vi.spyOn(sdkClient, 'callTool').mockResolvedValue(callToolResult);

    const tools = await client.tools();
    const getTool = tools['get_patient'];
    expect(getTool).toBeDefined();

    const result = await getTool.execute?.({ patientId: '123' });

    // Returns the full CallToolResult envelope — no content extraction
    expect(result).toEqual(callToolResult);
  });
});

describe('MastraMCPClient - outputSchema with structuredContent', () => {
  // When a tool has an outputSchema and returns structuredContent, the
  // structuredContent is returned directly. We don't pass outputSchema to
  // createTool so there's no Zod stripping — the MCP SDK validates via AJV.
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
      name: 'structured-content-test-client',
      server: { url: testServer.baseUrl },
    });
    await client.connect();
  });

  afterEach(async () => {
    await client?.disconnect().catch(() => {});
    await testServer?.mcpServer.close().catch(() => {});
    await testServer?.serverTransport?.close().catch(() => {});
    testServer?.httpServer.close();
  });

  it('should return structuredContent directly, preserving all fields', async () => {
    const sdkClient = (client as any).client as Client;

    vi.spyOn(sdkClient, 'listTools').mockResolvedValue({
      tools: [
        {
          name: 'calendar_search',
          description: 'Search calendar events',
          inputSchema: {
            type: 'object' as const,
            properties: {
              startdate: { type: 'string' },
              enddate: { type: 'string' },
            },
          },
          outputSchema: {
            type: 'object' as const,
            properties: {
              count: { type: 'number' },
              events: { type: 'array', items: { type: 'object' } },
            },
          },
        },
      ],
    });

    const fullResult = {
      success: true,
      events: [{ id: 1, title: 'Meeting' }],
      count: 1,
      message: 'Found 1 calendar event(s)',
      tool: 'microsoft_calendar_search',
    };

    vi.spyOn(sdkClient, 'callTool').mockResolvedValue({
      structuredContent: fullResult,
      content: [{ type: 'text', text: JSON.stringify(fullResult) }],
      isError: false,
    });

    const tools = await client.tools();
    const tool = tools['calendar_search'];
    const result = await tool.execute?.({
      startdate: '2026-02-27T00:00:00Z',
      enddate: '2026-02-27T23:59:59Z',
    });

    // structuredContent is returned directly — all fields preserved
    expect(result).toEqual(fullResult);
  });

  it('should return structuredContent even with generic object outputSchema', async () => {
    const sdkClient = (client as any).client as Client;

    vi.spyOn(sdkClient, 'listTools').mockResolvedValue({
      tools: [
        {
          name: 'generic_tool',
          description: 'A tool with generic output',
          inputSchema: {
            type: 'object' as const,
            properties: { query: { type: 'string' } },
          },
          outputSchema: {
            type: 'object' as const,
          },
        },
      ],
    });

    const fullResult = { data: 'hello', count: 42 };

    vi.spyOn(sdkClient, 'callTool').mockResolvedValue({
      structuredContent: fullResult,
      content: [{ type: 'text', text: JSON.stringify(fullResult) }],
      isError: false,
    });

    const tools = await client.tools();
    const tool = tools['generic_tool'];
    const result = await tool.execute?.({ query: 'test' });

    expect(result).toEqual(fullResult);
  });
});

describe('MastraMCPClient - tools without outputSchema preserve envelope', () => {
  // MCP tools without outputSchema return the full CallToolResult envelope.
  // We don't extract or transform content — callers get the standard MCP shape.
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
      name: 'no-output-schema-test',
      server: { url: testServer.baseUrl },
    });
    await client.connect();
  });

  afterEach(async () => {
    await client?.disconnect().catch(() => {});
    await testServer?.mcpServer.close().catch(() => {});
    await testServer?.serverTransport?.close().catch(() => {});
    testServer?.httpServer.close();
  });

  it('should return the full CallToolResult envelope', async () => {
    const sdkClient = (client as any).client as Client;

    vi.spyOn(sdkClient, 'listTools').mockResolvedValue({
      tools: [
        {
          name: 'simple_tool',
          description: 'A tool without outputSchema',
          inputSchema: {
            type: 'object' as const,
            properties: { query: { type: 'string' } },
          },
        },
      ],
    });

    const callToolResult = {
      content: [{ type: 'text', text: 'Hello, world!' }],
      isError: false,
    };

    vi.spyOn(sdkClient, 'callTool').mockResolvedValue(callToolResult);

    const tools = await client.tools();
    const tool = tools['simple_tool'];
    const result = await tool.execute?.({ query: 'test' });

    // Returns the full CallToolResult envelope
    expect(result).toEqual(callToolResult);
  });
});

describe('MastraMCPClient - AbortSignal forwarding', () => {
  let testServer: {
    httpServer: HttpServer;
    mcpServer: McpServer;
    serverTransport: StreamableHTTPServerTransport;
    baseUrl: URL;
  };
  let client: InternalMastraMCPClient;

  beforeEach(async () => {
    testServer = await setupTestServer(false);

    // Add a slow tool that takes 60s
    testServer.mcpServer.tool('slow_tool', 'A slow tool', { input: z.string() }, async () => {
      await new Promise(resolve => setTimeout(resolve, 60_000));
      return { content: [{ type: 'text' as const, text: 'done' }] };
    });

    client = new InternalMastraMCPClient({
      name: 'abort-signal-test-client',
      server: { url: testServer.baseUrl },
    });
    await client.connect();
  });

  afterEach(async () => {
    await client?.disconnect().catch(() => {});
    await testServer?.mcpServer.close().catch(() => {});
    await testServer?.serverTransport?.close().catch(() => {});
    testServer?.httpServer.close();
  });

  it('should forward abortSignal to callTool and reject when aborted', async () => {
    const tools = await client.tools();
    const slowTool = tools['slow_tool'];
    expect(slowTool).toBeDefined();

    const abortController = new AbortController();

    // Abort after 100ms
    const timeoutId = setTimeout(() => abortController.abort(), 100);

    const start = Date.now();
    try {
      await expect(slowTool.execute?.({ input: 'test' }, { abortSignal: abortController.signal })).rejects.toThrow();
    } finally {
      clearTimeout(timeoutId);
    }
    const elapsed = Date.now() - start;

    // Should abort quickly (< 5s), not wait the full 60s tool duration
    expect(elapsed).toBeLessThan(5_000);
  });

  it('should pass abortSignal through to the MCP SDK client', async () => {
    const sdkClient = (client as any).client as Client;
    const callToolSpy = vi.spyOn(sdkClient, 'callTool').mockResolvedValue({
      content: [{ type: 'text', text: 'ok' }],
      isError: false,
    });

    const tools = await client.tools();
    const slowTool = tools['slow_tool'];

    const abortController = new AbortController();
    await slowTool.execute?.({ input: 'test' }, { abortSignal: abortController.signal });

    expect(callToolSpy).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'slow_tool' }),
      expect.anything(),
      expect.objectContaining({ signal: abortController.signal }),
    );
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
    testServer = await setupTestServer(true);

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
    await testServer?.serverTransport?.close().catch(() => {});
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
    // Result is the full CallToolResult envelope
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.action).toBe('accept');
    expect(parsed.content).toEqual({
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
    // Result is the full CallToolResult envelope
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.action).toBe('decline');
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
    // Result is the full CallToolResult envelope
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.action).toBe('cancel');
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
    testServer = await setupTestServer(true);

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
    await testServer?.serverTransport?.close().catch(() => {});
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

describe('MastraMCPClient - Custom _meta', () => {
  let testServer: {
    httpServer: HttpServer;
    mcpServer: McpServer;
    serverTransport: StreamableHTTPServerTransport;
    baseUrl: URL;
  };
  let client: InternalMastraMCPClient;

  beforeEach(async () => {
    testServer = await setupTestServer(false);

    testServer.mcpServer.tool('echo', 'Echoes input', { msg: z.string() }, async ({ msg }) => {
      return { content: [{ type: 'text' as const, text: msg }] };
    });
  });

  afterEach(async () => {
    await client?.disconnect().catch(() => {});
    await testServer?.mcpServer.close().catch(() => {});
    await testServer?.serverTransport?.close().catch(() => {});
    testServer?.httpServer.close();
  });

  it('should forward custom _meta to callTool', async () => {
    client = new InternalMastraMCPClient({
      name: 'meta-client',
      server: { url: testServer.baseUrl, enableProgressTracking: false },
    });
    await client.connect();

    const sdkClient = (client as any).client as Client;
    const callToolSpy = vi.spyOn(sdkClient, 'callTool').mockResolvedValue({
      content: [{ type: 'text', text: 'ok' }],
      isError: false,
    });

    const tools = await client.tools();
    await tools['echo']?.execute?.({ msg: 'hi' }, { _meta: { traceId: 'trace-1', tenantId: 'org-5' } });

    expect(callToolSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'echo',
        _meta: { traceId: 'trace-1', tenantId: 'org-5' },
      }),
      expect.anything(),
      expect.anything(),
    );
  });

  it('should merge custom _meta with progressToken when progress tracking is enabled', async () => {
    client = new InternalMastraMCPClient({
      name: 'meta-progress-client',
      server: { url: testServer.baseUrl, enableProgressTracking: true },
    });
    await client.connect();

    const sdkClient = (client as any).client as Client;
    const callToolSpy = vi.spyOn(sdkClient, 'callTool').mockResolvedValue({
      content: [{ type: 'text', text: 'ok' }],
      isError: false,
    });

    const tools = await client.tools();
    await tools['echo']?.execute?.({ msg: 'hi' }, { runId: 'run-42', _meta: { traceId: 'trace-1' } });

    const callArgs = callToolSpy.mock.calls[0]![0] as any;
    expect(callArgs._meta.traceId).toBe('trace-1');
    expect(callArgs._meta.progressToken).toBe('run-42');
  });

  it('should give managed progressToken precedence over user-supplied progressToken in _meta', async () => {
    client = new InternalMastraMCPClient({
      name: 'meta-precedence-client',
      server: { url: testServer.baseUrl, enableProgressTracking: true },
    });
    await client.connect();

    const sdkClient = (client as any).client as Client;
    const callToolSpy = vi.spyOn(sdkClient, 'callTool').mockResolvedValue({
      content: [{ type: 'text', text: 'ok' }],
      isError: false,
    });

    const tools = await client.tools();
    await tools['echo']?.execute?.(
      { msg: 'hi' },
      { runId: 'run-42', _meta: { progressToken: 'user-token', traceId: 'trace-1' } },
    );

    const callArgs = callToolSpy.mock.calls[0]![0] as any;
    expect(callArgs._meta.progressToken).toBe('run-42');
    expect(callArgs._meta.traceId).toBe('trace-1');
  });

  it('should not include _meta when neither custom _meta nor progress tracking is provided', async () => {
    client = new InternalMastraMCPClient({
      name: 'no-meta-client',
      server: { url: testServer.baseUrl, enableProgressTracking: false },
    });
    await client.connect();

    const sdkClient = (client as any).client as Client;
    const callToolSpy = vi.spyOn(sdkClient, 'callTool').mockResolvedValue({
      content: [{ type: 'text', text: 'ok' }],
      isError: false,
    });

    const tools = await client.tools();
    await tools['echo']?.execute?.({ msg: 'hi' });

    const callArgs = callToolSpy.mock.calls[0]![0] as any;
    expect(callArgs._meta).toBeUndefined();
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
    await testServer?.serverTransport?.close().catch(() => {});
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
    await testServer?.serverTransport?.close().catch(() => {});
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
    await testServer?.serverTransport?.close().catch(() => {});
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

  it('should not accumulate SIGHUP listeners across multiple connect/disconnect cycles', async () => {
    const initialListenerCount = process.listenerCount('SIGHUP');

    for (let i = 0; i < 15; i++) {
      const client = new InternalMastraMCPClient({
        name: `sighup-cleanup-test-client-${i}`,
        server: {
          url: testServer.baseUrl,
        },
      });

      await client.connect();
      await client.disconnect();
    }

    const finalListenerCount = process.listenerCount('SIGHUP');

    expect(finalListenerCount).toBeLessThanOrEqual(initialListenerCount + 1);
  });

  it('should clean up SIGHUP listeners on disconnect', async () => {
    const initialListenerCount = process.listenerCount('SIGHUP');

    const client = new InternalMastraMCPClient({
      name: 'sighup-single-test-client',
      server: {
        url: testServer.baseUrl,
      },
    });

    await client.connect();

    const afterConnectCount = process.listenerCount('SIGHUP');
    expect(afterConnectCount).toBeLessThanOrEqual(initialListenerCount + 1);

    await client.disconnect();

    const afterDisconnectCount = process.listenerCount('SIGHUP');
    expect(afterDisconnectCount).toBe(initialListenerCount);
  });

  it('should not add duplicate SIGHUP listeners when connect is called multiple times on the same client', async () => {
    const initialListenerCount = process.listenerCount('SIGHUP');

    const client = new InternalMastraMCPClient({
      name: 'sighup-duplicate-connect-test-client',
      server: {
        url: testServer.baseUrl,
      },
    });

    await client.connect();
    await client.connect();
    await client.connect();

    const afterMultipleConnects = process.listenerCount('SIGHUP');

    expect(afterMultipleConnects).toBeLessThanOrEqual(initialListenerCount + 1);

    await client.disconnect();

    const afterDisconnectCount = process.listenerCount('SIGHUP');
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

    // Stateless mode: SDK 1.27+ requires a new transport per request
    httpServer.on('request', async (req, res) => {
      await mcpServer.close().catch(() => {});
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
      await mcpServer.connect(transport);
      await transport.handleRequest(req, res);
    });

    const baseUrl = await new Promise<URL>(resolve => {
      httpServer.listen(0, '127.0.0.1', () => {
        const addr = httpServer.address() as AddressInfo;
        resolve(new URL(`http://127.0.0.1:${addr.port}/mcp`));
      });
    });

    testServer = { httpServer, mcpServer, serverTransport: undefined as any, baseUrl };
  });

  afterEach(async () => {
    await testServer?.mcpServer.close().catch(() => {});
    await testServer?.serverTransport?.close().catch(() => {});
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

  it('should preserve custom elicitation capability fields', async () => {
    const customElicitationCapabilities = {
      supportedContentTypes: ['text/uri-list', 'application/vnd.mastra.form+json'],
    } as any;

    const client = new InternalMastraMCPClient({
      name: 'elicitation-capability-test-client',
      server: {
        url: testServer.baseUrl,
      },
      capabilities: {
        elicitation: customElicitationCapabilities,
      } as any,
    });

    const internalClient = (client as any).client;
    const capabilities = internalClient._options?.capabilities;

    expect(capabilities).toMatchObject({
      elicitation: customElicitationCapabilities,
    });

    await client.disconnect().catch(() => {});
  });

  it('should preserve custom elicitation fields while auto-enabling roots capability', async () => {
    const customElicitationCapabilities = {
      supportedContentTypes: ['text/uri-list'],
    } as any;

    const client = new InternalMastraMCPClient({
      name: 'elicitation-with-roots-test-client',
      server: {
        url: testServer.baseUrl,
        roots: [{ uri: 'file:///tmp', name: 'Temp Directory' }],
      },
      capabilities: {
        elicitation: customElicitationCapabilities,
      } as any,
    });

    const internalClient = (client as any).client;
    const capabilities = internalClient._options?.capabilities;

    expect(capabilities).toMatchObject({
      roots: { listChanged: true },
      elicitation: customElicitationCapabilities,
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
      let settled = false;
      let ready = false;

      const proc = spawn('npx', ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      proc.stderr.on('data', data => {
        const chunk = data.toString();
        stderrChunks.push(chunk);
        if (chunk.includes('Secure MCP Filesystem Server running on stdio')) {
          ready = true;
        }
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
                  settled = true;
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
          const finish = () => {
            settled = true;
            clearTimeout(timeout);
            proc.kill();
            resolve(stderrChunks.join(''));
          };
          if (ready) {
            setTimeout(finish, 1000);
          } else {
            setTimeout(finish, 3000);
          }
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
      proc.on('exit', () => {
        if (!settled) {
          clearTimeout(timeout);
          resolve(stderrChunks.join(''));
        }
      });

      // Timeout after 25 seconds
      const timeout = setTimeout(() => {
        settled = true;
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

describe('MastraMCPClient - mcpMetadata on tools', () => {
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
      name: 'metadata-test-client',
      server: {
        url: testServer.baseUrl,
      },
    });
    await client.connect();
  });

  afterEach(async () => {
    await client?.disconnect().catch(() => {});
    await testServer?.mcpServer.close().catch(() => {});
    await testServer?.serverTransport?.close().catch(() => {});
    testServer?.httpServer.close();
  });

  it('should set mcpMetadata.serverName on created tools', async () => {
    const tools = await client.tools();
    const greetTool = tools.greet;
    expect(greetTool).toBeDefined();
    expect(greetTool.mcpMetadata).toBeDefined();
    expect(greetTool.mcpMetadata!.serverName).toBe('metadata-test-client');
  });

  it('should set mcpMetadata.serverVersion after connection', async () => {
    const tools = await client.tools();
    const greetTool = tools.greet;
    expect(greetTool.mcpMetadata).toBeDefined();
    expect(greetTool.mcpMetadata!.serverVersion).toBe('1.0.0');
  });

  it('should preserve strict mode from MCP tool metadata', async () => {
    const sdkClient = (client as any).client as Client;

    vi.spyOn(sdkClient, 'listTools').mockResolvedValue({
      tools: [
        {
          name: 'strict_tool',
          description: 'A strict MCP tool',
          inputSchema: {
            type: 'object' as const,
            properties: { query: { type: 'string' } },
            required: ['query'],
            additionalProperties: false,
          },
          _meta: {
            mastra: {
              strict: true,
            },
          },
        },
      ],
    });

    const tools = await client.tools();
    expect(tools.strict_tool).toBeDefined();
    expect(tools.strict_tool.strict).toBe(true);
  });
});

describe('MastraMCPClient fetch with requestContext', () => {
  const datadogTracerTestSymbol = Symbol.for('mastra.mcp.dd-trace-test-tracer');
  let testServer: {
    httpServer: HttpServer;
    mcpServer: McpServer;
    serverTransport: StreamableHTTPServerTransport;
    baseUrl: URL;
  };
  let client: InternalMastraMCPClient;

  afterEach(async () => {
    await client?.disconnect().catch(() => {});
    await testServer?.mcpServer.close().catch(() => {});
    await testServer?.serverTransport?.close().catch(() => {});
    testServer?.httpServer.close();
    delete (globalThis as Record<PropertyKey, unknown>)[datadogTracerTestSymbol];
  });

  it('should pass requestContext to the custom fetch function during tool execution', async () => {
    testServer = await setupTestServer(false);
    const fetchSpy = vi.fn((url: string | URL, init?: RequestInit, _requestContext?: RequestContext | null) => {
      return fetch(url, init);
    });

    client = new InternalMastraMCPClient({
      name: 'fetch-context-test',
      server: {
        url: testServer.baseUrl,
        fetch: fetchSpy,
      },
    });

    await client.connect();
    const tools = await client.tools();
    const greetTool = tools['greet'];
    expect(greetTool).toBeDefined();

    type TestContext = { userId: string; authToken: string };
    const requestContext = new RequestContext<TestContext>();
    requestContext.set('userId', 'user-123');
    requestContext.set('authToken', 'bearer-abc');

    await greetTool.execute({ name: 'Test' }, { requestContext });

    // Find a fetch call that was made with the requestContext (during tool execution)
    const callsWithContext = fetchSpy.mock.calls.filter(call => {
      const ctx = call[2];
      return ctx && typeof ctx.get === 'function' && ctx.get('userId') === 'user-123';
    });

    expect(callsWithContext.length).toBeGreaterThan(0);
    const capturedContext = callsWithContext[0]![2]!;
    expect(capturedContext.get('userId')).toBe('user-123');
    expect(capturedContext.get('authToken')).toBe('bearer-abc');
  }, 15000);

  it('should pass different requestContexts for sequential tool calls', async () => {
    testServer = await setupTestServer(false);
    const fetchSpy = vi.fn((url: string | URL, init?: RequestInit, _requestContext?: RequestContext | null) => {
      return fetch(url, init);
    });

    client = new InternalMastraMCPClient({
      name: 'fetch-seq-context-test',
      server: {
        url: testServer.baseUrl,
        fetch: fetchSpy,
      },
    });

    await client.connect();
    const tools = await client.tools();
    const greetTool = tools['greet'];

    // First call with context A
    type ContextA = { sessionId: string };
    const contextA = new RequestContext<ContextA>();
    contextA.set('sessionId', 'session-A');
    await greetTool.execute({ name: 'Alice' }, { requestContext: contextA });

    const callsWithA = fetchSpy.mock.calls.filter(call => {
      const ctx = call[2];
      return ctx && typeof ctx.get === 'function' && ctx.get('sessionId') === 'session-A';
    });
    expect(callsWithA.length).toBeGreaterThan(0);

    fetchSpy.mockClear();

    // Second call with context B
    type ContextB = { sessionId: string };
    const contextB = new RequestContext<ContextB>();
    contextB.set('sessionId', 'session-B');
    await greetTool.execute({ name: 'Bob' }, { requestContext: contextB });

    const callsWithB = fetchSpy.mock.calls.filter(call => {
      const ctx = call[2];
      return ctx && typeof ctx.get === 'function' && ctx.get('sessionId') === 'session-B';
    });
    expect(callsWithB.length).toBeGreaterThan(0);

    // Ensure context A didn't leak into context B's calls
    const contextALeak = fetchSpy.mock.calls.some(call => {
      const ctx = call[2];
      return ctx && typeof ctx.get === 'function' && ctx.get('sessionId') === 'session-A';
    });
    expect(contextALeak).toBe(false);
  }, 15000);

  it('should pass requestContext to fetch even when an empty context is auto-created', async () => {
    testServer = await setupTestServer(false);
    const fetchSpy = vi.fn((url: string | URL, init?: RequestInit, _requestContext?: RequestContext | null) => {
      return fetch(url, init);
    });

    client = new InternalMastraMCPClient({
      name: 'fetch-no-context-test',
      server: {
        url: testServer.baseUrl,
        fetch: fetchSpy,
      },
    });

    await client.connect();

    // Clear fetch calls from the connection phase
    fetchSpy.mockClear();

    const tools = await client.tools();
    const greetTool = tools['greet'];

    // Call without explicit requestContext — the tool framework auto-creates an empty one
    await greetTool.execute({ name: 'NoContext' });

    // Fetch should still have been called with the third argument (requestContext)
    const callsDuringToolExec = fetchSpy.mock.calls;
    expect(callsDuringToolExec.length).toBeGreaterThan(0);
    // The third argument should be defined (either null or an empty RequestContext)
    const lastToolCallFetch = callsDuringToolExec[callsDuringToolExec.length - 1];
    expect(lastToolCallFetch!.length).toBeGreaterThanOrEqual(3);
  }, 15000);

  it('should detach streamable transport GET requests from the active Datadog span', async () => {
    testServer = await setupTestServer(true);
    const fetchSpy = vi.fn((url: string | URL, init?: RequestInit, _requestContext?: RequestContext | null) => {
      return fetch(url, init);
    });
    const activateSpy = vi.fn((_span: unknown, callback: () => unknown) => callback());

    (globalThis as Record<PropertyKey, unknown>)[datadogTracerTestSymbol] = {
      scope: () => ({
        activate: activateSpy,
      }),
    };

    client = new InternalMastraMCPClient({
      name: 'fetch-datadog-stream-test',
      server: {
        url: testServer.baseUrl,
        fetch: fetchSpy,
      },
    });

    await client.connect();

    const streamFetchCalls = fetchSpy.mock.calls.filter(([, init]) => (init?.method ?? 'GET').toUpperCase() === 'GET');

    expect(streamFetchCalls.length).toBeGreaterThan(0);
    expect(activateSpy).toHaveBeenCalledTimes(streamFetchCalls.length);
    expect(activateSpy).toHaveBeenNthCalledWith(1, null, expect.any(Function));

    activateSpy.mockClear();
    fetchSpy.mockClear();

    await client.tools();

    const postFetchCalls = fetchSpy.mock.calls.filter(([, init]) => (init?.method ?? 'GET').toUpperCase() === 'POST');
    expect(postFetchCalls.length).toBeGreaterThan(0);
    expect(activateSpy).not.toHaveBeenCalled();
  }, 15000);
});

describe('MastraMCPClient - Stdio stderr and cwd forwarding', () => {
  // Resolve the tsx CLI binary from the workspace instead of using npx -y,
  // which can be flaky in CI when tsx needs to be downloaded on-the-fly.
  const tsxCli = path.join(path.dirname(require.resolve('tsx/package.json')), 'dist', 'cli.mjs');

  it('should pipe stderr instead of inheriting it when stderr is set to "pipe"', async () => {
    const STDERR_MARKER = 'noisy-server: startup log';

    // Spy on parent process stderr to verify the marker does NOT appear
    const stderrSpy = vi.spyOn(process.stderr, 'write');

    const client = new InternalMastraMCPClient({
      name: 'noisy',
      server: {
        command: process.execPath,
        args: [tsxCli, path.join(__dirname, '..', '__fixtures__/noisy-server.ts')],
        stderr: 'pipe',
      },
    });

    await client.connect();
    const tools = await client.tools();
    expect(tools).toBeDefined();

    // Verify the child's stderr marker was NOT inherited to the parent's stderr
    const stderrOutput = stderrSpy.mock.calls.map(call => String(call[0])).join('');
    expect(stderrOutput).not.toContain(STDERR_MARKER);

    stderrSpy.mockRestore();
    await client.disconnect();
  }, 30000);

  it('should forward cwd option to the child process', async () => {
    const targetDir = fs.realpathSync(os.tmpdir());

    const client = new InternalMastraMCPClient({
      name: 'cwd-test',
      server: {
        command: process.execPath,
        args: [tsxCli, path.join(__dirname, '..', '__fixtures__/cwd-reporter.ts')],
        cwd: targetDir,
      },
    });

    await client.connect();
    const tools = await client.tools();
    const getCwdTool = tools['getCwd'];
    expect(getCwdTool).toBeDefined();

    // Execute the tool and verify the child process cwd matches
    const result = await getCwdTool!.execute({}, {});
    expect(result).toEqual({ content: [{ type: 'text', text: targetDir }] });

    await client.disconnect();
  }, 30000);
});

describe('MastraMCPClient - requireToolApproval', () => {
  let testServer: {
    httpServer: HttpServer;
    mcpServer: McpServer;
    serverTransport: StreamableHTTPServerTransport;
    baseUrl: URL;
  };
  let client: InternalMastraMCPClient;

  afterEach(async () => {
    await client?.disconnect().catch(() => {});
    await testServer?.mcpServer.close().catch(() => {});
    await testServer?.serverTransport?.close().catch(() => {});
    testServer?.httpServer.close();
  });

  it('should set requireApproval=true on all tools when requireToolApproval is true', async () => {
    testServer = await setupTestServer(false);
    client = new InternalMastraMCPClient({
      name: 'approval-bool-client',
      server: {
        url: testServer.baseUrl,
        requireToolApproval: true,
      },
    });
    await client.connect();
    const tools = await client.tools();
    const greetTool = tools.greet;
    expect(greetTool).toBeDefined();
    expect(greetTool.requireApproval).toBe(true);
    // No needsApprovalFn when boolean
    expect((greetTool as any).needsApprovalFn).toBeUndefined();
  });

  it('should not set requireApproval when requireToolApproval is false', async () => {
    testServer = await setupTestServer(false);
    client = new InternalMastraMCPClient({
      name: 'approval-false-client',
      server: {
        url: testServer.baseUrl,
        requireToolApproval: false,
      },
    });
    await client.connect();
    const tools = await client.tools();
    const greetTool = tools.greet;
    expect(greetTool).toBeDefined();
    expect(greetTool.requireApproval).toBe(false);
    expect((greetTool as any).needsApprovalFn).toBeUndefined();
  });

  it('should not set requireApproval when requireToolApproval is omitted', async () => {
    testServer = await setupTestServer(false);
    client = new InternalMastraMCPClient({
      name: 'approval-omitted-client',
      server: {
        url: testServer.baseUrl,
      },
    });
    await client.connect();
    const tools = await client.tools();
    const greetTool = tools.greet;
    expect(greetTool).toBeDefined();
    expect(greetTool.requireApproval).toBe(false);
    expect((greetTool as any).needsApprovalFn).toBeUndefined();
  });

  it('should set requireApproval=true and needsApprovalFn when requireToolApproval is a function', async () => {
    testServer = await setupTestServer(false);
    const approvalFn = vi.fn().mockReturnValue(true);
    client = new InternalMastraMCPClient({
      name: 'approval-fn-client',
      server: {
        url: testServer.baseUrl,
        requireToolApproval: approvalFn,
      },
    });
    await client.connect();
    const tools = await client.tools();
    const greetTool = tools.greet;
    expect(greetTool).toBeDefined();
    expect(greetTool.requireApproval).toBe(true);
    expect((greetTool as any).needsApprovalFn).toBeTypeOf('function');
  });

  it('should pass toolName and args to the wrapped needsApprovalFn', async () => {
    testServer = await setupTestServer(false);
    const approvalFn = vi.fn().mockReturnValue(false);
    client = new InternalMastraMCPClient({
      name: 'approval-fn-args-client',
      server: {
        url: testServer.baseUrl,
        requireToolApproval: approvalFn,
      },
    });
    await client.connect();
    const tools = await client.tools();
    const greetTool = tools.greet;

    // Call the wrapped needsApprovalFn directly
    const testArgs = { name: 'test' };
    const testCtx = { requestContext: { userId: '123' } };
    const result = await (greetTool as any).needsApprovalFn(testArgs, testCtx);

    expect(result).toBe(false);
    expect(approvalFn).toHaveBeenCalledWith({
      toolName: 'greet',
      args: testArgs,
      requestContext: { userId: '123' },
    });
  });

  it('should support async approval functions', async () => {
    testServer = await setupTestServer(false);
    const approvalFn = vi.fn().mockImplementation(async ({ toolName }) => {
      return toolName === 'greet';
    });
    client = new InternalMastraMCPClient({
      name: 'approval-async-client',
      server: {
        url: testServer.baseUrl,
        requireToolApproval: approvalFn,
      },
    });
    await client.connect();
    const tools = await client.tools();
    const greetTool = tools.greet;

    const result = await (greetTool as any).needsApprovalFn({ name: 'test' }, {});
    expect(result).toBe(true);
  });
});

describe('MastraMCPClient - custom fetch failure modes (auth-token loop)', () => {
  // This suite reproduces the reported symptom from the user:
  //   "servers[mcpUrl].fetch() retries indefinitely (about once per second)
  //    if `throw new Error('Failed to get auth token')` is triggered inside fetch.
  //    The loop stops if I instead pass an empty token through."
  //
  // The relevant code lives in @modelcontextprotocol/sdk's StreamableHTTPClientTransport:
  //  - After connect, the SDK opens a long-lived "standalone GET SSE listener" stream.
  //  - When that stream ends or errors, _scheduleReconnection({...}, 0) fires.
  //  - Reset-to-0 means whenever the GET round-trips successfully but the server then
  //    closes the SSE body (or the stream completes naturally), reconnection counter
  //    NEVER advances toward maxRetries=2 — so the SDK retries on a ~1Hz cadence forever.
  //  - Throwing from user fetch on a *reconnect* attempt does increment the counter
  //    (capped at maxRetries=2), but throwing on the *initial* fire-and-forget call is
  //    silently swallowed (no schedule).
  //
  // What we test below:
  //  1) Baseline: server closes the GET SSE stream cleanly => reconnects forever.
  //  2) User-fetch fix: short-circuit GETs with a synthetic 405 Response => loop stops.
  //  3) User-fetch fix: short-circuit GETs with a synthetic 401 Response (no authProvider)
  //     => loop stops because UnauthorizedError is thrown and swallowed.

  const VALID_TOKEN = 'valid-bearer-token';
  let httpServer: HttpServer;
  let baseUrl: URL;
  let getRequestCount = 0;
  let unauthorizedPostCount = 0;
  // Per-test toggle: when true, the server gates POSTs (other than
  // notifications/initialized) on a Bearer token. Defaults to false so the
  // baseline / 405 / 401 tests don't need to attach credentials.
  let requireAuth = false;

  // Minimal MCP server that:
  //  - accepts POST /mcp for handshake + tools/list + tools/call, gated on Bearer token
  //  - on GET /mcp returns 200 + immediately closes an empty SSE body (loop trigger)
  beforeEach(async () => {
    getRequestCount = 0;
    unauthorizedPostCount = 0;
    requireAuth = false;
    let sessionId: string | undefined;

    httpServer = createServer(async (req, res) => {
      if (req.method === 'GET') {
        getRequestCount++;
        res.writeHead(200, {
          'content-type': 'text/event-stream',
          'cache-control': 'no-cache',
          connection: 'keep-alive',
        });
        // Close the SSE body immediately. This triggers _handleSseStream's
        // "done: true" branch which calls _scheduleReconnection({}, 0).
        res.end();
        return;
      }

      if (req.method === 'POST') {
        const chunks: Buffer[] = [];
        for await (const chunk of req) chunks.push(chunk as Buffer);
        const bodyText = Buffer.concat(chunks).toString('utf8');
        let body: any;
        try {
          body = JSON.parse(bodyText);
        } catch {
          res.writeHead(400).end();
          return;
        }

        // notifications/initialized => 202, no body, no auth needed
        if (body?.method === 'notifications/initialized') {
          res.writeHead(202).end();
          return;
        }

        // Auth check (gated by per-test flag): require Bearer token.
        if (requireAuth) {
          const authHeader = req.headers['authorization'];
          if (authHeader !== `Bearer ${VALID_TOKEN}`) {
            unauthorizedPostCount++;
            res
              .writeHead(401, { 'content-type': 'application/json' })
              .end(
                JSON.stringify({
                  jsonrpc: '2.0',
                  id: body?.id ?? null,
                  error: { code: -32001, message: 'unauthorized' },
                }),
              );
            return;
          }
        }

        if (body?.method === 'initialize') {
          sessionId = randomUUID();
          res.writeHead(200, {
            'content-type': 'application/json',
            'mcp-session-id': sessionId,
          });
          res.end(
            JSON.stringify({
              jsonrpc: '2.0',
              id: body.id,
              result: {
                protocolVersion: body.params?.protocolVersion ?? '2024-11-05',
                capabilities: { tools: {} },
                serverInfo: { name: 'loop-repro-server', version: '0.0.1' },
              },
            }),
          );
          return;
        }

        if (body?.method === 'tools/list') {
          res.writeHead(200, { 'content-type': 'application/json' }).end(
            JSON.stringify({
              jsonrpc: '2.0',
              id: body.id,
              result: {
                tools: [
                  {
                    name: 'echo',
                    description: 'Echo a message back',
                    inputSchema: {
                      type: 'object',
                      properties: { message: { type: 'string' } },
                      required: ['message'],
                    },
                  },
                ],
              },
            }),
          );
          return;
        }

        if (body?.method === 'tools/call') {
          const message = body.params?.arguments?.message ?? '';
          res.writeHead(200, { 'content-type': 'application/json' }).end(
            JSON.stringify({
              jsonrpc: '2.0',
              id: body.id,
              result: { content: [{ type: 'text', text: `echo: ${message}` }] },
            }),
          );
          return;
        }

        // Default: 202 ack
        res.writeHead(202).end();
        return;
      }

      res.writeHead(405).end();
    });

    baseUrl = await new Promise<URL>(resolve => {
      httpServer.listen(0, '127.0.0.1', () => {
        const addr = httpServer.address() as AddressInfo;
        resolve(new URL(`http://127.0.0.1:${addr.port}/mcp`));
      });
    });
  });

  let client: InternalMastraMCPClient;
  afterEach(async () => {
    await client?.disconnect().catch(() => {});
    await new Promise<void>(resolve => httpServer.close(() => resolve()));
  });

  async function observeUserFetchGetCalls(
    onGet: (url: string | URL, init?: RequestInit) => Response | Promise<Response> | never,
    observationMs: number,
  ) {
    let userGetCallCount = 0;
    const userFetch = vi.fn(async (url: string | URL, init?: RequestInit) => {
      const method = (init?.method ?? 'GET').toUpperCase();
      if (method === 'GET') {
        userGetCallCount++;
        return await onGet(url, init);
      }
      return globalThis.fetch(url, init);
    });

    client = new InternalMastraMCPClient({
      name: 'fetch-failure-mode-test',
      server: { url: baseUrl, fetch: userFetch },
    });

    await client.connect();
    await client.tools();

    await new Promise(resolve => setTimeout(resolve, observationMs));
    return { userGetCallCount, userFetch };
  }

  it('baseline: server closes GET SSE => SDK retries the GET listener at ~1Hz forever', async () => {
    // No user fetch override here — measure raw server-side GETs with default fetch.
    client = new InternalMastraMCPClient({
      name: 'baseline-loop',
      server: { url: baseUrl },
    });
    await client.connect();
    await client.tools();
    await new Promise(resolve => setTimeout(resolve, 3500));

    // initial GET + reconnects at ~1s, ~2.5s (1.5x backoff) within 3.5s window
    // The reset-to-0 in _scheduleReconnection means it never gives up.
    expect(getRequestCount).toBeGreaterThanOrEqual(3);
  }, 20000);

  it('user fetch returning a synthetic 405 stops the GET listener loop', async () => {
    const { userGetCallCount } = await observeUserFetchGetCalls(
      () => new Response(null, { status: 405, statusText: 'Method Not Allowed' }),
      3500,
    );
    // 405 tells the SDK the server does not offer the standalone GET stream;
    // _startOrAuthSse returns without scheduling a reconnect.
    expect(userGetCallCount).toBe(1);
    // And the SDK must not have hit the real server's GET endpoint.
    expect(getRequestCount).toBe(0);
  }, 20000);

  it('user fetch returning a synthetic 401 (no authProvider) does not loop', async () => {
    const { userGetCallCount } = await observeUserFetchGetCalls(
      () => new Response('unauthorized', { status: 401, statusText: 'Unauthorized' }),
      3500,
    );
    // Without authProvider, 401 throws StreamableHTTPError. On the *initial*
    // fire-and-forget call it is swallowed (no schedule). It must not loop at 1Hz.
    expect(userGetCallCount).toBeLessThanOrEqual(1);
    expect(getRequestCount).toBe(0);
  }, 20000);

  it('recommended pattern: user fetch never throws, waits for token on POST, short-circuits GET with 405', async () => {
    requireAuth = true;
    // Simulates a deferred-token store: token starts unavailable, becomes available after 200ms.
    let currentToken: string | null = null;
    setTimeout(() => {
      currentToken = VALID_TOKEN;
    }, 200);

    const tokenWaiters: Array<() => void> = [];
    const waitForToken = async (timeoutMs: number): Promise<string | null> => {
      if (currentToken) return currentToken;
      return await new Promise<string | null>(resolve => {
        const timer = setTimeout(() => resolve(currentToken), timeoutMs);
        const tick = () => {
          if (currentToken) {
            clearTimeout(timer);
            resolve(currentToken);
          } else {
            setTimeout(tick, 25);
          }
        };
        tokenWaiters.push(() => clearTimeout(timer));
        tick();
      });
    };

    let userGetCallCount = 0;
    let userPostCallCount = 0;
    const userFetch = vi.fn(async (url: string | URL, init?: RequestInit) => {
      const method = (init?.method ?? 'GET').toUpperCase();

      // GET = standalone SSE listener. Don't throw, don't pass through —
      // signal "no GET stream supported" with a synthetic 405. SDK stops retrying.
      if (method === 'GET') {
        userGetCallCount++;
        return new Response(null, { status: 405, statusText: 'Method Not Allowed' });
      }

      userPostCallCount++;

      // POST: wait up to 5s for a token. If still missing, surface a 401
      // through a synthetic Response — never throw.
      const token = await waitForToken(5000);
      if (!token) {
        return new Response(JSON.stringify({ error: 'no token' }), {
          status: 401,
          headers: { 'content-type': 'application/json' },
        });
      }

      const headers = new Headers(init?.headers);
      headers.set('authorization', `Bearer ${token}`);
      return globalThis.fetch(url, { ...init, headers });
    });

    client = new InternalMastraMCPClient({
      name: 'recommended-pattern',
      server: { url: baseUrl, fetch: userFetch },
    });

    await client.connect();
    const tools = await client.tools();

    expect(Object.keys(tools)).toContain('echo');

    const echoTool = tools['echo'];
    const result = await echoTool!.execute({ message: 'hello world' }, {});
    expect(result).toEqual({ content: [{ type: 'text', text: 'echo: hello world' }] });

    // Confirm the auth-token wait actually happened: the token only became
    // available 200ms after init, so at least one POST had to wait for it.
    expect(userPostCallCount).toBeGreaterThan(0);

    // userFetch must never have thrown — every call either returned a Response
    // or resolved. Vitest's mock results expose 'throw' for thrown errors.
    const threw = userFetch.mock.results.some(r => r.type === 'throw');
    expect(threw).toBe(false);

    // No loop: only the initial GET listener attempt, short-circuited at the
    // user-fetch layer.
    await new Promise(resolve => setTimeout(resolve, 2000));
    expect(userGetCallCount).toBe(1);
    expect(getRequestCount).toBe(0);

    // The server never received an unauthorized POST: the wait-for-token
    // pattern means we only POSTed once we had auth, never with a stale/empty token.
    expect(unauthorizedPostCount).toBe(0);

    tokenWaiters.forEach(cancel => cancel());
  }, 20000);
});
