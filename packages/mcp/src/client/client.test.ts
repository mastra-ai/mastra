import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { createServer } from 'node:http';
import type { Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { RequestContext } from '@mastra/core/di';
import { toStandardSchema } from '@mastra/schema-compat';
import { Client, SdkErrorCode, SdkHttpError, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { toNodeHandler } from '@modelcontextprotocol/node';
import { McpServer, createMcpHandler } from '@modelcontextprotocol/server';
import type { CallToolResult } from '@modelcontextprotocol/server';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { z } from 'zod';

import { InternalMastraMCPClient, getMcpCallToolContent, getMcpCallToolMeta } from './client.js';

describe('InternalMastraMCPClient - server instructions', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mockSdkConnection(instructions: string | undefined) {
    vi.spyOn(Client.prototype, 'connect').mockResolvedValue(undefined as any);
    vi.spyOn(Client.prototype, 'getInstructions').mockReturnValue(instructions);
    vi.spyOn(StreamableHTTPClientTransport.prototype, 'close').mockResolvedValue(undefined as any);
  }

  it('retrieves instructions after connect', async () => {
    mockSdkConnection('Validate schemas before migrations.');

    const client = new InternalMastraMCPClient({
      name: 'db-tools',
      server: {
        url: new URL('http://localhost:1234/mcp'),
      },
    });

    await client.connect();

    expect(client.instructions).toBe('Validate schemas before migrations.');
    await client.disconnect();
  });

  it('refreshes instructions on forceReconnect', async () => {
    vi.spyOn(Client.prototype, 'connect').mockResolvedValue(undefined as any);
    vi.spyOn(Client.prototype, 'getInstructions')
      .mockReturnValueOnce('Use the old schema policy.')
      .mockReturnValueOnce('Use the new schema policy.');
    vi.spyOn(StreamableHTTPClientTransport.prototype, 'close').mockResolvedValue(undefined as any);

    const client = new InternalMastraMCPClient({
      name: 'db-tools',
      server: {
        url: new URL('http://localhost:1234/mcp'),
      },
    });

    await client.connect();
    expect(client.instructions).toBe('Use the old schema policy.');

    await client.forceReconnect();
    expect(client.instructions).toBe('Use the new schema policy.');

    await client.disconnect();
  });

  it('handles empty instructions', async () => {
    mockSdkConnection(undefined);

    const client = new InternalMastraMCPClient({
      name: 'empty-tools',
      server: {
        url: new URL('http://localhost:1234/mcp'),
      },
    });

    await client.connect();

    expect(client.instructions).toBeUndefined();
    await client.disconnect();
  });

  it('adds forwarding metadata to MCP tools', async () => {
    mockSdkConnection('Only run read-only checks.');
    vi.spyOn(Client.prototype, 'listTools').mockResolvedValue({
      tools: [
        {
          name: 'check',
          description: 'Check state',
          inputSchema: { type: 'object', properties: {} },
        },
      ],
    } as any);

    const client = new InternalMastraMCPClient({
      name: 'audit-tools',
      server: {
        url: new URL('http://localhost:1234/mcp'),
        forwardInstructions: false,
        instructionsMaxLength: 16,
      },
    });

    await client.connect();
    const tools = await client.tools();

    expect(tools.check.mcpMetadata).toMatchObject({
      serverName: 'audit-tools',
      serverInstructions: 'Only run read-only checks.',
      forwardInstructions: false,
      instructionsMaxLength: 16,
    });

    await client.disconnect();
  });

  it('defaults forwardInstructions to false (opt-in)', async () => {
    mockSdkConnection('Only run read-only checks.');
    vi.spyOn(Client.prototype, 'listTools').mockResolvedValue({
      tools: [
        {
          name: 'check',
          description: 'Check state',
          inputSchema: { type: 'object', properties: {} },
        },
      ],
    } as any);

    const client = new InternalMastraMCPClient({
      name: 'audit-tools',
      server: {
        url: new URL('http://localhost:1234/mcp'),
      },
    });

    await client.connect();
    const tools = await client.tools();

    expect(tools.check.mcpMetadata).toMatchObject({
      serverName: 'audit-tools',
      forwardInstructions: false,
    });

    await client.disconnect();
  });
});

type ModernTestServer = {
  httpServer: HttpServer;
  mcpServer: McpServer;
  baseUrl: URL;
};

function listen(httpServer: HttpServer): Promise<URL> {
  return new Promise<URL>(resolve => {
    httpServer.listen(0, '127.0.0.1', () => {
      const addr = httpServer.address() as AddressInfo;
      resolve(new URL(`http://127.0.0.1:${addr.port}/mcp`));
    });
  });
}

/**
 * Serves an SDK `McpServer` over the modern-only (2026-07-28) Streamable HTTP handler.
 * Legacy peers are rejected outright; every request is self-contained.
 */
function serveModern(httpServer: HttpServer, mcpServer: McpServer): void {
  const handler = toNodeHandler(createMcpHandler(() => mcpServer.server, { legacy: 'reject' }));
  httpServer.on('request', (req, res) => handler(req, res));
}

async function setupTestServer(): Promise<ModernTestServer> {
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

  mcpServer.registerTool(
    'greet',
    {
      description: 'A simple greeting tool',
      inputSchema: z.object({
        name: z.string().describe('Name to greet').default('World'),
      }),
    },
    async ({ name }): Promise<CallToolResult> => {
      return {
        content: [{ type: 'text', text: `Hello, ${name}!` }],
      };
    },
  );

  mcpServer.registerResource('test-resource', 'resource://test', {}, () => {
    return {
      contents: [
        {
          uri: 'resource://test',
          text: 'Hello, world!',
        },
      ],
    };
  });

  mcpServer.registerPrompt('greet', { description: 'A simple greeting prompt' }, () => {
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

  serveModern(httpServer, mcpServer);
  const baseUrl = await listen(httpServer);

  return { httpServer, mcpServer, baseUrl };
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
    baseUrl: URL;
  };
  let client: InternalMastraMCPClient;

  describe('Stateless Mode', () => {
    beforeEach(async () => {
      testServer = await setupTestServer();
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
      // Returns the full CallToolResult envelope (including SDK-stamped `_meta`)
      expect(result).toMatchObject({
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
});

describe('MastraMCPClient - outputSchema without structuredContent', () => {
  // When MCP servers (e.g. FastMCP) define outputSchema on a tool but don't
  // return structuredContent in the response, the full CallToolResult envelope
  // should be returned as-is. outputSchema is attached for documentation with a
  // no-op validator; the MCP client validates structuredContent via AJV.
  let testServer: {
    httpServer: HttpServer;
    mcpServer: McpServer;
    baseUrl: URL;
  };
  let client: InternalMastraMCPClient;

  beforeEach(async () => {
    testServer = await setupTestServer();
    client = new InternalMastraMCPClient({
      name: 'output-schema-test-client',
      server: { url: testServer.baseUrl },
    });
    await client.connect();
  });

  afterEach(async () => {
    await client?.disconnect().catch(() => {});
    await testServer?.mcpServer.close().catch(() => {});
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

  it('exposes output JSON schema for documentation while Mastra validation always succeeds', async () => {
    const sdkClient = (client as any).client as Client;
    const outputSchema = {
      type: 'object' as const,
      properties: {
        result: { type: 'number' },
        expression: { type: 'string' },
      },
      required: ['result'],
    };

    vi.spyOn(sdkClient, 'listTools').mockResolvedValue({
      tools: [
        {
          name: 'calculate',
          description: 'Calculates a math expression',
          inputSchema: {
            type: 'object' as const,
            properties: { expression: { type: 'string' } },
          },
          outputSchema,
        },
      ],
    });

    const tools = await client.tools();
    const calculateTool = tools['calculate'];
    expect(calculateTool).toBeDefined();

    const documentedSchema = calculateTool.outputSchema?.['~standard'].jsonSchema.output({ target: 'draft-07' });
    expect(documentedSchema).toMatchObject({
      type: 'object',
      properties: {
        result: { type: 'number' },
        expression: { type: 'string' },
      },
    });

    // The Tool-level validator stays a no-op so envelope returns (no structuredContent,
    // isError + onToolError: 'return') aren't validated against the outputSchema.
    // Enforcement happens inside the execute wrapper on the structuredContent path.
    const invalidOutput = { result: 'not-a-number', extraField: true };
    expect(calculateTool.outputSchema?.['~standard'].validate(invalidOutput)).toEqual({ value: invalidOutput });
    expect(toStandardSchema(outputSchema)['~standard'].validate(invalidOutput)).toHaveProperty('issues');

    const callToolResult = {
      content: [{ type: 'text', text: JSON.stringify({ result: 2, expression: '1 + 1' }) }],
      isError: false,
    };
    vi.spyOn(sdkClient, 'callTool').mockResolvedValue(callToolResult);
    await expect(calculateTool.execute?.({ expression: '1 + 1' })).resolves.toEqual(callToolResult);
  });

  it('validates structuredContent against outputSchema and returns a structured validation error on mismatch', async () => {
    const sdkClient = (client as any).client as Client;

    vi.spyOn(sdkClient, 'listTools').mockResolvedValue({
      tools: [
        {
          name: 'calculate',
          description: 'Calculates a math expression',
          inputSchema: { type: 'object' as const, properties: { expression: { type: 'string' } } },
          outputSchema: {
            type: 'object' as const,
            properties: { result: { type: 'number' } },
            required: ['result'],
          },
        },
      ],
    });

    const tools = await client.tools();
    const calculateTool = tools['calculate'];

    // Mocking callTool bypasses the MCP SDK's own AJV check, which is exactly the
    // situation on the cached-catalog path (the SDK output-schema cache is empty).
    vi.spyOn(sdkClient, 'callTool').mockResolvedValue({
      content: [{ type: 'text', text: 'nope' }],
      structuredContent: { result: 'not-a-number' },
      isError: false,
    });

    const result = await calculateTool.execute?.({ expression: '1 + 1' });
    expect(result).toMatchObject({ error: true });
    expect((result as any).message).toContain('Tool output validation failed for calculate');
    expect((result as any).validationErrors).toBeDefined();
  });

  it('passes valid structuredContent through unchanged with content metadata intact', async () => {
    const sdkClient = (client as any).client as Client;

    vi.spyOn(sdkClient, 'listTools').mockResolvedValue({
      tools: [
        {
          name: 'calculate',
          description: 'Calculates a math expression',
          inputSchema: { type: 'object' as const, properties: { expression: { type: 'string' } } },
          outputSchema: {
            type: 'object' as const,
            properties: { result: { type: 'number' } },
            required: ['result'],
          },
        },
      ],
    });

    const tools = await client.tools();
    const calculateTool = tools['calculate'];

    const content = [{ type: 'text', text: JSON.stringify({ result: 2 }) }];
    vi.spyOn(sdkClient, 'callTool').mockResolvedValue({
      content,
      structuredContent: { result: 2 },
      isError: false,
    });

    const result = await calculateTool.execute?.({ expression: '1 + 1' });
    expect(result).toEqual({ result: 2 });
    expect(getMcpCallToolContent(result)).toEqual(content);
  });

  it('does not schema-validate isError results when onToolError is "return"', async () => {
    const returnClient = new InternalMastraMCPClient({
      name: 'output-schema-test-client-return',
      server: { url: testServer.baseUrl, onToolError: 'return' },
    });
    await returnClient.connect();
    try {
      const sdkClient = (returnClient as any).client as Client;

      vi.spyOn(sdkClient, 'listTools').mockResolvedValue({
        tools: [
          {
            name: 'calculate',
            description: 'Calculates a math expression',
            inputSchema: { type: 'object' as const, properties: { expression: { type: 'string' } } },
            outputSchema: {
              type: 'object' as const,
              properties: { result: { type: 'number' } },
              required: ['result'],
            },
          },
        ],
      });

      const tools = await returnClient.tools();
      const calculateTool = tools['calculate'];

      // An error envelope with structuredContent that doesn't match the schema must not
      // be masked by a validation error — the isError path owns this result.
      const callToolResult = {
        content: [{ type: 'text', text: 'boom' }],
        structuredContent: { result: 'not-a-number' },
        isError: true,
      };
      vi.spyOn(sdkClient, 'callTool').mockResolvedValue(callToolResult);

      const result = await calculateTool.execute?.({ expression: '1 + 1' });
      expect(result).toEqual(callToolResult.structuredContent);
      expect((result as any).error).toBeUndefined();
    } finally {
      await returnClient.disconnect().catch(() => {});
    }
  });
});

describe('MastraMCPClient - isError handling', () => {
  // Per the MCP spec, tool execution failures are reported in-band as a normal
  // CallToolResult with `isError: true` and the failure text in `content`.
  // By default the client surfaces these on Mastra's failed-tool-call path by
  // throwing, so spans/chunks/scorers reflect the failure and the model can
  // self-correct.
  let testServer: {
    httpServer: HttpServer;
    mcpServer: McpServer;
    baseUrl: URL;
  };

  beforeEach(async () => {
    testServer = await setupTestServer();
  });

  afterEach(async () => {
    await testServer?.mcpServer.close().catch(() => {});
    testServer?.httpServer.close();
  });

  const failingResult = {
    content: [{ type: 'text', text: 'API key invalid' }],
    isError: true,
  };

  it('throws with the content text when a tool returns isError: true (default)', async () => {
    const client = new InternalMastraMCPClient({
      name: 'iserror-default-client',
      server: { url: testServer.baseUrl },
    });
    await client.connect();

    const sdkClient = (client as any).client as Client;
    vi.spyOn(sdkClient, 'listTools').mockResolvedValue({
      tools: [{ name: 'fetch', description: 'Fetches data', inputSchema: { type: 'object' as const } }],
    });
    vi.spyOn(sdkClient, 'callTool').mockResolvedValue(failingResult);

    const tools = await client.tools();
    await expect(tools['fetch'].execute?.({})).rejects.toThrow('API key invalid');

    await client.disconnect().catch(() => {});
  });

  it('throws the content text rather than dropping it for tools with an outputSchema', async () => {
    const client = new InternalMastraMCPClient({
      name: 'iserror-output-schema-client',
      server: { url: testServer.baseUrl },
    });
    await client.connect();

    const sdkClient = (client as any).client as Client;
    vi.spyOn(sdkClient, 'listTools').mockResolvedValue({
      tools: [
        {
          name: 'fetch',
          description: 'Fetches data',
          inputSchema: { type: 'object' as const },
          outputSchema: { type: 'object' as const, properties: { result: { type: 'number' } } },
        },
      ],
    });
    // Spec-compliant servers put the failure text in content (not structuredContent) when isError.
    vi.spyOn(sdkClient, 'callTool').mockResolvedValue(failingResult);

    const tools = await client.tools();
    await expect(tools['fetch'].execute?.({})).rejects.toThrow('API key invalid');

    await client.disconnect().catch(() => {});
  });

  it('returns the raw envelope when onToolError is "return" (legacy behaviour)', async () => {
    const client = new InternalMastraMCPClient({
      name: 'iserror-return-client',
      server: { url: testServer.baseUrl, onToolError: 'return' },
    });
    await client.connect();

    const sdkClient = (client as any).client as Client;
    vi.spyOn(sdkClient, 'listTools').mockResolvedValue({
      tools: [{ name: 'fetch', description: 'Fetches data', inputSchema: { type: 'object' as const } }],
    });
    vi.spyOn(sdkClient, 'callTool').mockResolvedValue(failingResult);

    const tools = await client.tools();
    const result = await tools['fetch'].execute?.({});
    expect(result).toEqual(failingResult);

    await client.disconnect().catch(() => {});
  });
});

describe('MastraMCPClient - tool-execution errors vs reconnection', () => {
  let testServer: {
    httpServer: HttpServer;
    mcpServer: McpServer;
    baseUrl: URL;
    toolCalls: string[];
    breakAfterToolCall: boolean;
  };

  beforeEach(async () => {
    const toolCalls: string[] = [];
    const httpServer: HttpServer = createServer();
    const mcpServer = new McpServer(
      { name: 'reconnect-test-server', version: '1.0.0' },
      { capabilities: { logging: {}, tools: {} } },
    );

    mcpServer.registerTool(
      'chargeCard',
      {
        description: 'Non-idempotent tool',
        inputSchema: z.object({ amount: z.number().default(1) }),
      },
      async ({ amount }) => {
        toolCalls.push(`charge:${amount}`);
        return { content: [{ type: 'text', text: 'Session expired for object 42' }], isError: true };
      },
    );

    let broken = false;
    const handler = toNodeHandler(createMcpHandler(() => mcpServer.server, { legacy: 'reject' }));
    httpServer.on('request', (req, res) => {
      if (broken) {
        req.socket.destroy();
        return;
      }
      res.on('finish', () => {
        if (testServer?.breakAfterToolCall && toolCalls.length > 0) broken = true;
      });
      handler(req, res);
    });

    const baseUrl = await listen(httpServer);

    testServer = { httpServer, mcpServer, baseUrl, toolCalls, breakAfterToolCall: false };
  });

  afterEach(async () => {
    await testServer?.mcpServer.close().catch(() => {});
    testServer?.httpServer.close();
  });

  it('does not retry tool-execution errors that contain reconnectable substrings', async () => {
    const client = new InternalMastraMCPClient({ name: 'no-retry-client', server: { url: testServer.baseUrl } });
    await client.connect();
    const tools = await client.tools();

    await expect(tools['chargeCard'].execute?.({ amount: 100 })).rejects.toThrow('Session expired for object 42');
    expect(testServer.toolCalls).toEqual(['charge:100']);

    await client.disconnect().catch(() => {});
  });

  it('surfaces the reconnect failure when reconnect fails, not the original error', async () => {
    const client = new InternalMastraMCPClient({ name: 'reconnect-fail-client', server: { url: testServer.baseUrl } });
    await client.connect();

    const sdkClient = (client as any).client as Client;
    vi.spyOn(sdkClient, 'listTools').mockResolvedValue({
      tools: [{ name: 'fetch', description: 'Fetches data', inputSchema: { type: 'object' as const } }],
    });

    const transportError = new Error('HTTP 404: session not found');
    const reconnectError = new Error('Could not reconnect');
    vi.spyOn(sdkClient, 'callTool').mockRejectedValueOnce(transportError);
    vi.spyOn(client as any, 'reconnectAfterTransportFailure').mockRejectedValue(reconnectError);

    const tools = await client.tools();

    await expect(tools['fetch'].execute?.({})).rejects.toThrow('Could not reconnect');

    await client.disconnect().catch(() => {});
  });

  it('surfaces the retry failure when reconnect succeeds but the retried call fails', async () => {
    const client = new InternalMastraMCPClient({ name: 'retry-fail-client', server: { url: testServer.baseUrl } });
    await client.connect();

    const sdkClient = (client as any).client as Client;
    vi.spyOn(sdkClient, 'listTools').mockResolvedValue({
      tools: [{ name: 'fetch', description: 'Fetches data', inputSchema: { type: 'object' as const } }],
    });

    const transportError = new Error('HTTP 404: session not found');
    const retryError = new Error('Retry failed after reconnect');
    vi.spyOn(sdkClient, 'callTool').mockRejectedValueOnce(transportError).mockRejectedValueOnce(retryError);
    vi.spyOn(client as any, 'reconnectAfterTransportFailure').mockResolvedValue(undefined);

    const tools = await client.tools();

    await expect(tools['fetch'].execute?.({})).rejects.toThrow('Retry failed after reconnect');

    await client.disconnect().catch(() => {});
  });
});

describe('MastraMCPClient - no outputSchema', () => {
  // MCP tools that do NOT declare an outputSchema return the full
  // CallToolResult envelope. We don't extract or transform the result.
  let testServer: {
    httpServer: HttpServer;
    mcpServer: McpServer;
    baseUrl: URL;
  };
  let client: InternalMastraMCPClient;

  beforeEach(async () => {
    testServer = await setupTestServer();
    client = new InternalMastraMCPClient({
      name: 'no-output-schema-test-client',
      server: { url: testServer.baseUrl },
    });
    await client.connect();
  });

  afterEach(async () => {
    await client?.disconnect().catch(() => {});
    await testServer?.mcpServer.close().catch(() => {});
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
  // When a tool has an outputSchema and returns structuredContent, execute() still
  // returns the structured object for callers/UI. toModelOutput maps MCP content
  // text for the LLM without changing the execute return shape.
  let testServer: {
    httpServer: HttpServer;
    mcpServer: McpServer;
    baseUrl: URL;
  };
  let client: InternalMastraMCPClient;

  beforeEach(async () => {
    testServer = await setupTestServer();
    client = new InternalMastraMCPClient({
      name: 'structured-content-test-client',
      server: { url: testServer.baseUrl },
    });
    await client.connect();
  });

  afterEach(async () => {
    await client?.disconnect().catch(() => {});
    await testServer?.mcpServer.close().catch(() => {});
    testServer?.httpServer.close();
  });

  it('should return content text for the model when structuredContent is also present', async () => {
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
      content: [{ type: 'text', text: 'Found 1 calendar event(s)' }],
      isError: false,
    });

    const tools = await client.tools();
    const tool = tools['calendar_search'];
    const result = await tool.execute?.({
      startdate: '2026-02-27T00:00:00Z',
      enddate: '2026-02-27T23:59:59Z',
    });

    expect(result).toEqual(fullResult);
    expect(tool.toModelOutput?.(result)).toEqual({
      type: 'text',
      value: 'Found 1 calendar event(s)',
    });
  });

  it('should fall back to json toModelOutput when content has no text blocks', async () => {
    const sdkClient = (client as any).client as Client;

    vi.spyOn(sdkClient, 'listTools').mockResolvedValue({
      tools: [
        {
          name: 'image_only_tool',
          description: 'Returns structured output without text content',
          inputSchema: {
            type: 'object' as const,
            properties: { query: { type: 'string' } },
          },
          outputSchema: {
            type: 'object' as const,
            properties: { count: { type: 'number' } },
          },
        },
      ],
    });

    const fullResult = { count: 3 };

    vi.spyOn(sdkClient, 'callTool').mockResolvedValue({
      structuredContent: fullResult,
      content: [{ type: 'image', data: 'abc', mimeType: 'image/png' }],
      isError: false,
    });

    const tools = await client.tools();
    const tool = tools['image_only_tool'];
    const result = await tool.execute?.({ query: 'test' });

    expect(result).toEqual(fullResult);
    expect(tool.toModelOutput?.(result)).toEqual({
      type: 'json',
      value: fullResult,
    });
  });

  it('should preserve result _meta (with serverId stamped into ui) on structured results', async () => {
    const sdkClient = (client as any).client as Client;

    vi.spyOn(sdkClient, 'listTools').mockResolvedValue({
      tools: [
        {
          name: 'ui_tool',
          description: 'Returns an MCP App resource',
          inputSchema: { type: 'object' as const, properties: {} },
          outputSchema: {
            type: 'object' as const,
            properties: { count: { type: 'number' } },
          },
        },
      ],
    });

    const structured = { count: 2 };
    const content = [{ type: 'text', text: 'Found 2 items' }];

    vi.spyOn(sdkClient, 'callTool').mockResolvedValue({
      structuredContent: structured,
      content,
      _meta: { ui: { resourceUri: 'ui://ui_tool/app.html' }, traceId: 'trace-9' },
      isError: false,
    });

    const tools = await client.tools();
    const result = await tools['ui_tool'].execute?.({});

    // execute() return shape is unchanged: enumerable keys are only the structured output
    expect(result).toEqual(structured);
    expect(Object.keys(result)).toEqual(['count']);
    expect(JSON.stringify(result)).toBe(JSON.stringify(structured));

    // Hidden channels expose the rest of the CallToolResult envelope
    expect(getMcpCallToolContent(result)).toEqual(content);
    expect(getMcpCallToolMeta(result)).toEqual({
      ui: { resourceUri: 'ui://ui_tool/app.html', serverId: 'structured-content-test-client' },
      traceId: 'trace-9',
    });
  });

  it('should return undefined from getMcpCallToolMeta when the result has no _meta', async () => {
    const sdkClient = (client as any).client as Client;

    vi.spyOn(sdkClient, 'listTools').mockResolvedValue({
      tools: [
        {
          name: 'plain_tool',
          description: 'No _meta',
          inputSchema: { type: 'object' as const, properties: {} },
          outputSchema: {
            type: 'object' as const,
            properties: { count: { type: 'number' } },
          },
        },
      ],
    });

    vi.spyOn(sdkClient, 'callTool').mockResolvedValue({
      structuredContent: { count: 0 },
      content: [{ type: 'text', text: 'none' }],
      isError: false,
    });

    const tools = await client.tools();
    const result = await tools['plain_tool'].execute?.({});

    expect(getMcpCallToolMeta(result)).toBeUndefined();
    expect(getMcpCallToolContent(result)).toEqual([{ type: 'text', text: 'none' }]);
  });

  it('should use JSON content text in toModelOutput when the server mirrors structuredContent in content', async () => {
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

    // execute() keeps returning structuredContent for callers
    expect(result).toEqual(fullResult);
    expect(tool.toModelOutput?.(result)).toEqual({
      type: 'text',
      value: JSON.stringify(fullResult),
    });
  });

  it('should use JSON content text in toModelOutput for generic object outputSchema', async () => {
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
    expect(tool.toModelOutput?.(result)).toEqual({
      type: 'text',
      value: JSON.stringify(fullResult),
    });
  });

  it('should use scalar structuredContent as JSON model output', async () => {
    const sdkClient = (client as any).client as Client;

    vi.spyOn(sdkClient, 'listTools').mockResolvedValue({
      tools: [
        {
          name: 'count_tool',
          description: 'Returns a scalar structured result',
          inputSchema: {
            type: 'object' as const,
            properties: { query: { type: 'string' } },
          },
          outputSchema: {
            type: 'number' as const,
          },
        },
      ],
    });

    vi.spyOn(sdkClient, 'callTool').mockResolvedValue({
      structuredContent: 0,
      content: [{ type: 'text', text: 'count is zero' }],
      isError: false,
    });

    const tools = await client.tools();
    const tool = tools['count_tool'];
    const result = await tool.execute?.({ query: 'test' });

    expect(result).toBe(0);
    expect(tool.toModelOutput?.(result)).toEqual({
      type: 'json',
      value: 0,
    });
  });

  it('should use null structuredContent as JSON model output', async () => {
    const sdkClient = (client as any).client as Client;

    vi.spyOn(sdkClient, 'listTools').mockResolvedValue({
      tools: [
        {
          name: 'nullable_tool',
          description: 'Returns null structured output',
          inputSchema: {
            type: 'object' as const,
            properties: { query: { type: 'string' } },
          },
          outputSchema: {
            type: 'null' as const,
          },
        },
      ],
    });

    vi.spyOn(sdkClient, 'callTool').mockResolvedValue({
      structuredContent: null,
      content: [{ type: 'text', text: 'no data available' }],
      isError: false,
    });

    const tools = await client.tools();
    const tool = tools['nullable_tool'];
    const result = await tool.execute?.({ query: 'test' });

    expect(result).toBeNull();
    expect(tool.toModelOutput?.(result)).toEqual({
      type: 'json',
      value: null,
    });
  });

  it('should not retain authored content from an earlier equal scalar result', async () => {
    const sdkClient = (client as any).client as Client;

    vi.spyOn(sdkClient, 'listTools').mockResolvedValue({
      tools: [
        {
          name: 'count_tool',
          description: 'Returns a scalar structured result',
          inputSchema: {
            type: 'object' as const,
            properties: { query: { type: 'string' } },
          },
          outputSchema: {
            type: 'number' as const,
          },
        },
      ],
    });

    vi.spyOn(sdkClient, 'callTool')
      .mockResolvedValueOnce({
        structuredContent: 0,
        content: [{ type: 'text', text: 'first zero' }],
        isError: false,
      })
      .mockResolvedValueOnce({
        structuredContent: 0,
        content: [{ type: 'text', text: 'second zero' }],
        isError: false,
      });

    const tools = await client.tools();
    const tool = tools['count_tool'];

    const first = await tool.execute?.({ query: 'first' });
    const second = await tool.execute?.({ query: 'second' });

    expect(first).toBe(0);
    expect(second).toBe(0);
    expect(tool.toModelOutput?.(second)).toEqual({ type: 'json', value: 0 });
    expect(tool.toModelOutput?.(first)).toEqual({ type: 'json', value: 0 });
  });

  it('should keep concurrent equal scalar results as JSON when calls resolve out of order', async () => {
    const sdkClient = (client as any).client as Client;

    vi.spyOn(sdkClient, 'listTools').mockResolvedValue({
      tools: [
        {
          name: 'count_tool',
          description: 'Returns a scalar structured result',
          inputSchema: {
            type: 'object' as const,
            properties: { query: { type: 'string' } },
          },
          outputSchema: { type: 'number' as const },
        },
      ],
    });

    vi.spyOn(sdkClient, 'callTool').mockImplementation(async request => {
      if (request.arguments?.query === 'first') {
        await new Promise(resolve => setTimeout(resolve, 20));
        return {
          structuredContent: 0,
          content: [{ type: 'text', text: 'first zero' }],
          isError: false,
        };
      }
      return {
        structuredContent: 0,
        content: [{ type: 'text', text: 'second zero' }],
        isError: false,
      };
    });

    const tools = await client.tools();
    const tool = tools['count_tool'];
    const [first, second] = await Promise.all([
      tool.execute?.({ query: 'first' }),
      tool.execute?.({ query: 'second' }),
    ]);

    expect(tool.toModelOutput?.(second)).toEqual({ type: 'json', value: 0 });
    expect(tool.toModelOutput?.(first)).toEqual({ type: 'json', value: 0 });
  });
});

describe('MastraMCPClient - tools without outputSchema preserve envelope', () => {
  // MCP tools without outputSchema return the full CallToolResult envelope.
  // We don't extract or transform content — callers get the standard MCP shape.
  let testServer: {
    httpServer: HttpServer;
    mcpServer: McpServer;
    baseUrl: URL;
  };
  let client: InternalMastraMCPClient;

  beforeEach(async () => {
    testServer = await setupTestServer();
    client = new InternalMastraMCPClient({
      name: 'no-output-schema-test',
      server: { url: testServer.baseUrl },
    });
    await client.connect();
  });

  afterEach(async () => {
    await client?.disconnect().catch(() => {});
    await testServer?.mcpServer.close().catch(() => {});
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

describe('MastraMCPClient - multimodal content', () => {
  let testServer: {
    httpServer: HttpServer;
    mcpServer: McpServer;
    baseUrl: URL;
  };
  let client: InternalMastraMCPClient;

  beforeEach(async () => {
    testServer = await setupTestServer();
    client = new InternalMastraMCPClient({
      name: 'multimodal-test',
      server: { url: testServer.baseUrl },
    });
    await client.connect();
  });

  afterEach(async () => {
    await client?.disconnect().catch(() => {});
    await testServer?.mcpServer.close().catch(() => {});
    testServer?.httpServer.close();
  });

  it('should not attach toModelOutput that duplicates MCP image content into providerMetadata', async () => {
    const sdkClient = (client as any).client as Client;

    vi.spyOn(sdkClient, 'listTools').mockResolvedValue({
      tools: [
        {
          name: 'screenshot',
          description: 'Takes a screenshot',
          inputSchema: { type: 'object' as const, properties: {} },
        },
      ],
    });

    const tools = await client.tools();
    const tool = tools['screenshot'];
    expect(tool).toBeDefined();
    expect((tool as any).toModelOutput).toBeUndefined();
  });
});

describe('MastraMCPClient - AbortSignal forwarding', () => {
  let testServer: {
    httpServer: HttpServer;
    mcpServer: McpServer;
    baseUrl: URL;
  };
  let client: InternalMastraMCPClient;

  beforeEach(async () => {
    testServer = await setupTestServer();

    // Add a slow tool that takes 60s
    testServer.mcpServer.registerTool(
      'slow_tool',
      { description: 'A slow tool', inputSchema: z.object({ input: z.string() }) },
      async () => {
        await new Promise(resolve => setTimeout(resolve, 60_000));
        return { content: [{ type: 'text' as const, text: 'done' }] };
      },
    );

    client = new InternalMastraMCPClient({
      name: 'abort-signal-test-client',
      server: { url: testServer.baseUrl },
    });
    await client.connect();
  });

  afterEach(async () => {
    await client?.disconnect().catch(() => {});
    await testServer?.mcpServer.close().catch(() => {});
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

  it('should pass abortSignal through to the MCP client', async () => {
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
      expect.objectContaining({ signal: abortController.signal }),
    );
  });
});

describe('MastraMCPClient - Progress Tests', () => {
  let testServer: {
    httpServer: HttpServer;
    mcpServer: McpServer;
    baseUrl: URL;
  };
  let client: InternalMastraMCPClient;

  beforeEach(async () => {
    testServer = await setupTestServer();

    // Add a tool that emits progress notifications while running
    testServer.mcpServer.registerTool(
      'longTask',
      {
        description: 'Emits progress notifications during execution',
        inputSchema: z.object({
          count: z.number().describe('Number of notifications').default(3),
          delayMs: z.number().describe('Delay between notifications (ms)').default(1),
        }),
      },
      async ({ count, delayMs }, ctx): Promise<CallToolResult> => {
        const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

        for (let i = 1; i <= count; i++) {
          if (ctx.mcpReq._meta?.progressToken) {
            await ctx.mcpReq.notify({
              method: 'notifications/progress',
              params: {
                progress: i,
                total: count,
                message: `Long task progress ${i}/${count}`,
                progressToken: ctx.mcpReq._meta.progressToken,
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
    baseUrl: URL;
  };
  let client: InternalMastraMCPClient;

  beforeEach(async () => {
    testServer = await setupTestServer();

    testServer.mcpServer.registerTool(
      'echo',
      { description: 'Echoes input', inputSchema: z.object({ msg: z.string() }) },
      async ({ msg }) => {
        return { content: [{ type: 'text' as const, text: msg }] };
      },
    );
  });

  afterEach(async () => {
    await client?.disconnect().catch(() => {});
    await testServer?.mcpServer.close().catch(() => {});
    testServer?.httpServer.close();
  });

  it('should forward custom _meta to callTool', async () => {
    client = new InternalMastraMCPClient({
      name: 'meta-client',
      server: { url: testServer.baseUrl, enableProgressTracking: false, enableServerLogs: false },
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

  it('should attach the per-request log-level opt-in by default', async () => {
    client = new InternalMastraMCPClient({
      name: 'log-meta-client',
      server: { url: testServer.baseUrl, enableProgressTracking: false, serverLogLevel: 'warning' },
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
    expect(callArgs._meta).toEqual({ 'io.modelcontextprotocol/logLevel': 'warning' });
  });

  it('should not include _meta when neither custom _meta, server logs nor progress tracking is enabled', async () => {
    client = new InternalMastraMCPClient({
      name: 'no-meta-client',
      server: { url: testServer.baseUrl, enableProgressTracking: false, enableServerLogs: false },
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
    baseUrl: URL;
  };
  let client: InternalMastraMCPClient;

  beforeEach(async () => {
    testServer = await setupTestServer();
  });

  afterEach(async () => {
    await client?.disconnect().catch(() => {});
    await testServer?.mcpServer.close().catch(() => {});
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
    baseUrl: URL;
  };
  let client: InternalMastraMCPClient;

  beforeEach(async () => {
    testServer = await setupTestServer();
  });

  afterEach(async () => {
    await client?.disconnect().catch(() => {});
    await testServer?.mcpServer.close().catch(() => {});
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

    // Access the internal MCP client to spy on listTools
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

describe('MastraMCPClient - Resource Cleanup Tests', () => {
  let testServer: {
    httpServer: HttpServer;
    mcpServer: McpServer;
    baseUrl: URL;
  };

  beforeEach(async () => {
    testServer = await setupTestServer();
  });

  afterEach(async () => {
    await testServer?.mcpServer.close().catch(() => {});
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

describe('MastraMCPClient - mcpMetadata on tools', () => {
  let testServer: {
    httpServer: HttpServer;
    mcpServer: McpServer;
    baseUrl: URL;
  };
  let client: InternalMastraMCPClient;

  beforeEach(async () => {
    testServer = await setupTestServer();
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
    baseUrl: URL;
  };
  let client: InternalMastraMCPClient;

  afterEach(async () => {
    await client?.disconnect().catch(() => {});
    await testServer?.mcpServer.close().catch(() => {});
    testServer?.httpServer.close();
    delete (globalThis as Record<PropertyKey, unknown>)[datadogTracerTestSymbol];
  });

  it('should pass requestContext to the custom fetch function during tool execution', async () => {
    testServer = await setupTestServer();
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
    testServer = await setupTestServer();
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
    testServer = await setupTestServer();
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

  it('should detach the subscriptions/listen stream from the active Datadog span', async () => {
    testServer = await setupTestServer();
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
    await client.listen({ toolsListChanged: true });

    // Only the long-lived subscriptions/listen request is detached from the active span.
    const listenCalls = fetchSpy.mock.calls.filter(
      ([, init]) => typeof init?.body === 'string' && init.body.includes('subscriptions/listen'),
    );
    expect(listenCalls.length).toBe(1);
    expect(activateSpy).toHaveBeenCalledTimes(1);
    expect(activateSpy).toHaveBeenNthCalledWith(1, null, expect.any(Function));

    activateSpy.mockClear();
    fetchSpy.mockClear();

    await client.tools();

    expect(fetchSpy.mock.calls.length).toBeGreaterThan(0);
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
    expect(result).toMatchObject({ content: [{ type: 'text', text: targetDir }] });

    await client.disconnect();
  }, 30000);
});

describe('MastraMCPClient - requireToolApproval', () => {
  let testServer: {
    httpServer: HttpServer;
    mcpServer: McpServer;
    baseUrl: URL;
  };
  let client: InternalMastraMCPClient;

  afterEach(async () => {
    await client?.disconnect().catch(() => {});
    await testServer?.mcpServer.close().catch(() => {});
    testServer?.httpServer.close();
  });

  it('should set requireApproval=true on all tools when requireToolApproval is true', async () => {
    testServer = await setupTestServer();
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
    testServer = await setupTestServer();
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
    testServer = await setupTestServer();
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
    testServer = await setupTestServer();
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
    testServer = await setupTestServer();
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
      annotations: undefined,
      requestContext: { userId: '123' },
    });
  });

  it('should forward MCP tool annotations to the requireToolApproval callback', async () => {
    testServer = await setupTestServer();
    // Register a tool with annotations on the test server
    testServer.mcpServer.registerTool(
      'delete_repo',
      {
        description: 'Delete a repo',
        inputSchema: z.object({ repo: z.string() }),
        annotations: {
          title: 'Delete Repository',
          readOnlyHint: false,
          destructiveHint: true,
          idempotentHint: false,
          openWorldHint: false,
        },
      },
      async (): Promise<CallToolResult> => ({ content: [{ type: 'text', text: 'ok' }] }),
    );

    const approvalFn = vi.fn().mockImplementation(({ annotations }) => Boolean(annotations?.destructiveHint));
    client = new InternalMastraMCPClient({
      name: 'approval-annotations-client',
      server: {
        url: testServer.baseUrl,
        requireToolApproval: approvalFn,
      },
    });
    await client.connect();
    const tools = await client.tools();
    const destructiveTool = tools.delete_repo;
    expect(destructiveTool).toBeDefined();

    const result = await (destructiveTool as any).needsApprovalFn({ repo: 'foo' }, {});
    expect(result).toBe(true);
    expect(approvalFn).toHaveBeenCalledWith({
      toolName: 'delete_repo',
      args: { repo: 'foo' },
      annotations: expect.objectContaining({
        title: 'Delete Repository',
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
      }),
    });
  });

  it('should expose MCP tool annotations on the Mastra tool (mcp.annotations)', async () => {
    testServer = await setupTestServer();
    testServer.mcpServer.registerTool(
      'list_repos',
      {
        description: 'List repos',
        inputSchema: z.object({ owner: z.string() }),
        annotations: {
          title: 'List Repositories',
          readOnlyHint: true,
          destructiveHint: false,
        },
      },
      async (): Promise<CallToolResult> => ({ content: [{ type: 'text', text: 'ok' }] }),
    );

    client = new InternalMastraMCPClient({
      name: 'annotations-exposure-client',
      server: { url: testServer.baseUrl },
    });
    await client.connect();
    const tools = await client.tools();
    const readTool = tools.list_repos as any;
    expect(readTool).toBeDefined();
    expect(readTool.mcp?.annotations).toMatchObject({
      title: 'List Repositories',
      readOnlyHint: true,
      destructiveHint: false,
    });

    // Tool without annotations should not have `annotations` populated
    const greetTool = tools.greet as any;
    expect(greetTool.mcp?.annotations).toBeUndefined();
  });

  it('should support async approval functions', async () => {
    testServer = await setupTestServer();
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

describe('InternalMastraMCPClient - transport cleanup on close (issue #16693)', () => {
  let testServer: Awaited<ReturnType<typeof setupTestServer>>;
  let client: InternalMastraMCPClient;

  beforeEach(async () => {
    testServer = await setupTestServer();
    client = new InternalMastraMCPClient({
      name: 'test-close-cleanup-client',
      server: { url: testServer.baseUrl },
    });
    await client.connect();
  });

  afterEach(async () => {
    await client?.disconnect().catch(() => {});
    await testServer?.mcpServer.close().catch(() => {});
    testServer?.httpServer.close();
  });

  it('closes and clears the stale transport when the connection closes', async () => {
    const staleTransport = (client as any).transport;
    expect(staleTransport).toBeDefined();
    const closeSpy = vi.spyOn(staleTransport, 'close');

    // Simulate a server-initiated close firing the SDK client's onclose handler.
    (client as any).client.onclose?.();

    expect((client as any).transport).toBeUndefined();
    expect((client as any).isConnected).toBeNull();
    expect(closeSpy).toHaveBeenCalledTimes(1);

    // Let the fire-and-forget close settle.
    await new Promise(resolve => setTimeout(resolve, 0));
  });

  it('does not throw when the stale transport close rejects', async () => {
    const staleTransport = (client as any).transport;
    vi.spyOn(staleTransport, 'close').mockRejectedValueOnce(new Error('already closed'));

    expect(() => (client as any).client.onclose?.()).not.toThrow();
    expect((client as any).transport).toBeUndefined();
    expect((client as any).isConnected).toBeNull();
    await new Promise(resolve => setTimeout(resolve, 0));
  });
});

describe('InternalMastraMCPClient - stale SDK transport detach (issue #19862)', () => {
  // Modern-only server behind a flaky front door. While `failing` is true every
  // request gets a 404 — like a load balancer with no healthy backend during a
  // redeploy.
  let httpServer: HttpServer;
  let mcpServer: McpServer;
  let baseUrl: URL;
  let failing = false;
  let discoverCount = 0;
  let dropConcurrentToolCalls = false;
  let pendingToolCallSockets: Array<{ destroy(): void }> = [];
  let client: InternalMastraMCPClient;

  beforeEach(async () => {
    failing = false;
    discoverCount = 0;
    dropConcurrentToolCalls = false;
    pendingToolCallSockets = [];
    mcpServer = new McpServer({ name: 'wedge-repro-server', version: '0.0.1' }, { capabilities: { tools: {} } });
    mcpServer.registerTool('ping', { description: 'ping', inputSchema: z.object({}) }, async () => ({
      content: [{ type: 'text', text: 'pong' }],
    }));
    const handler = toNodeHandler(createMcpHandler(() => mcpServer.server, { legacy: 'reject' }));

    httpServer = createServer(async (req, res) => {
      if (failing) {
        res.writeHead(404).end();
        return;
      }
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(chunk as Buffer);
      let body: any;
      try {
        body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      } catch {
        res.writeHead(400).end();
        return;
      }
      if (body?.method === 'server/discover') discoverCount++;
      if (body?.method === 'tools/call' && dropConcurrentToolCalls) {
        pendingToolCallSockets.push(req.socket);
        if (pendingToolCallSockets.length === 2) {
          dropConcurrentToolCalls = false;
          pendingToolCallSockets.forEach(socket => socket.destroy());
        }
        return;
      }
      handler(req, res, body);
    });
    baseUrl = await listen(httpServer);
  });

  afterEach(async () => {
    await client?.disconnect().catch(() => {});
    await mcpServer.close().catch(() => {});
    httpServer.closeAllConnections();
    await new Promise<void>(resolve => httpServer.close(() => resolve()));
  });

  it('clears the SDK client transport when severing the attached transport', async () => {
    client = new InternalMastraMCPClient({
      name: 'wedge-sdk-transport-match',
      server: { url: baseUrl },
    });
    await client.connect();

    const attachedTransport = (client as any).client.transport;
    expect(attachedTransport).toBeDefined();

    (client as any).severClientTransportLink(attachedTransport);

    expect((client as any).client.transport).toBeUndefined();
    expect(attachedTransport.onclose).toBeUndefined();
    expect(attachedTransport.onerror).toBeUndefined();
    expect(attachedTransport.onmessage).toBeUndefined();
  });

  it('keeps the SDK client transport when severing a different transport', async () => {
    client = new InternalMastraMCPClient({
      name: 'wedge-sdk-transport-mismatch',
      server: { url: baseUrl },
    });
    await client.connect();

    const attachedTransport = (client as any).client.transport;
    const unrelatedTransport = {
      onclose: vi.fn(),
      onerror: vi.fn(),
      onmessage: vi.fn(),
    };

    (client as any).severClientTransportLink(unrelatedTransport);

    expect((client as any).client.transport).toBe(attachedTransport);
    expect(unrelatedTransport.onclose).toBeUndefined();
    expect(unrelatedTransport.onerror).toBeUndefined();
    expect(unrelatedTransport.onmessage).toBeUndefined();
  });

  it('connect() succeeds after an earlier connect attempt failed during an outage', async () => {
    // First-ever connect during the outage: the discover POST gets 404 and the
    // SDK leaves that never-started transport attached to its Client.
    failing = true;
    client = new InternalMastraMCPClient({
      name: 'wedge-fresh-connect',
      server: { url: baseUrl },
    });
    await expect(client.connect()).rejects.toThrow();

    // Server healthy again. Before the fix this threw "Already connected to a
    // transport" forever.
    failing = false;
    await client.connect();
    const tools = await client.tools();
    expect(Object.keys(tools)).toContain('ping');
  }, 20000);

  it('forceReconnect() recovers once the server is healthy after a failed reconnect', async () => {
    client = new InternalMastraMCPClient({
      name: 'wedge-force-reconnect',
      server: { url: baseUrl },
    });
    await client.connect();
    expect(Object.keys(await client.tools())).toContain('ping');

    // Reconnect attempt during the outage fails and used to poison the SDK client.
    failing = true;
    httpServer.closeAllConnections();
    await expect(client.forceReconnect()).rejects.toThrow();

    failing = false;
    await client.forceReconnect();
    expect(Object.keys(await client.tools())).toContain('ping');
  }, 20000);

  it('prevents a closed transport from clearing a replacement connection', async () => {
    client = new InternalMastraMCPClient({
      name: 'wedge-stale-onclose',
      server: { url: baseUrl },
    });
    const baseOnClose = vi.fn();
    (client as any).client.onclose = baseOnClose;
    await client.connect();

    const staleTransport = (client as any).transport;
    const staleConnectionOnClose = (client as any).client.onclose;

    await client.forceReconnect();
    await client.forceReconnect();

    const replacementTransport = (client as any).transport;
    const replacementConnection = (client as any).isConnected;
    expect((client as any).clientBaseOnClose).toBe(baseOnClose);
    expect((client as any).client.onclose).not.toBe(staleConnectionOnClose);
    expect(replacementTransport).not.toBe(staleTransport);
    expect(staleTransport.onclose).toBeUndefined();
    expect(staleTransport.onerror).toBeUndefined();
    expect(staleTransport.onmessage).toBeUndefined();

    // A previously installed Mastra close wrapper may still be referenced by
    // caller code. It must not reset state belonging to the replacement or
    // delegate through wrappers from every prior connection.
    baseOnClose.mockClear();
    staleConnectionOnClose();
    expect(baseOnClose).toHaveBeenCalledOnce();
    expect((client as any).transport).toBe(replacementTransport);
    expect((client as any).isConnected).toBe(replacementConnection);
  });

  it('a tool instance handed out before the outage works again after the server heals', async () => {
    client = new InternalMastraMCPClient({
      name: 'wedge-old-tool',
      server: { url: baseUrl },
    });
    await client.connect();
    const tools = await client.tools();
    expect(await tools['ping'].execute!({ context: {} })).toMatchObject({
      content: [{ type: 'text', text: 'pong' }],
    });

    // Outage drops the connection mid-flight; the tool wrapper's retry calls
    // forceReconnect, which fails while the server is still down.
    failing = true;
    httpServer.closeAllConnections();
    await expect(tools['ping'].execute!({ context: {} })).rejects.toThrow();

    // Once healthy, the same tool instance must recover on its retry path
    // instead of failing with "Not connected" forever.
    failing = false;
    expect(await tools['ping'].execute!({ context: {} })).toMatchObject({
      content: [{ type: 'text', text: 'pong' }],
    });
  }, 20000);

  it('shares one real HTTP reconnect when concurrent tool calls lose the same transport', async () => {
    client = new InternalMastraMCPClient({
      name: 'concurrent-http-reconnect',
      server: { url: baseUrl },
    });
    await client.connect();
    const tools = await client.tools();

    dropConcurrentToolCalls = true;
    const results = await Promise.all([
      tools['ping'].execute!({ context: {} }),
      tools['ping'].execute!({ context: {} }),
    ]);

    expect(results).toMatchObject([
      { content: [{ type: 'text', text: 'pong' }] },
      { content: [{ type: 'text', text: 'pong' }] },
    ]);
    expect(discoverCount).toBe(2);
  }, 20000);
});

describe('InternalMastraMCPClient - concurrent tool reconnects', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function createToolClient() {
    const client = new InternalMastraMCPClient({
      name: 'concurrent-reconnect-client',
      server: { url: new URL('http://localhost:1234/mcp') },
    });
    const sdkClient = (client as any).client as Client;
    vi.spyOn(sdkClient, 'listTools').mockResolvedValue({
      tools: [{ name: 'ping', description: 'ping', inputSchema: { type: 'object' as const } }],
    });
    return { client, sdkClient };
  }

  it('shares one reconnect when concurrent calls fail on the same transport', async () => {
    const { client, sdkClient } = createToolClient();
    const staleTransport = { close: vi.fn().mockResolvedValue(undefined) };
    const replacementTransport = { close: vi.fn().mockResolvedValue(undefined) };
    (client as any).transport = staleTransport;

    let rejectFirst!: (error: Error) => void;
    let rejectSecond!: (error: Error) => void;
    const callTool = vi
      .spyOn(sdkClient, 'callTool')
      .mockImplementationOnce(
        () => new Promise((_, reject) => (rejectFirst = reject)) as ReturnType<Client['callTool']>,
      )
      .mockImplementationOnce(
        () => new Promise((_, reject) => (rejectSecond = reject)) as ReturnType<Client['callTool']>,
      )
      .mockResolvedValue({ content: [{ type: 'text', text: 'pong' }] });
    const connect = vi.spyOn(client, 'connect').mockImplementation(async () => {
      (client as any).transport = replacementTransport;
      return true;
    });

    const tool = (await client.tools())['ping'];
    const firstCall = tool.execute?.({});
    const secondCall = tool.execute?.({});
    await vi.waitFor(() => expect(callTool).toHaveBeenCalledTimes(2));

    rejectFirst(new Error('Connection closed'));
    rejectSecond(new Error('Connection closed'));

    await expect(Promise.all([firstCall, secondCall])).resolves.toEqual([
      { content: [{ type: 'text', text: 'pong' }] },
      { content: [{ type: 'text', text: 'pong' }] },
    ]);
    expect(staleTransport.close).toHaveBeenCalledOnce();
    expect(connect).toHaveBeenCalledOnce();
    expect((client as any).transport).toBe(replacementTransport);
  });

  it('does not replace a healthy transport after a late failure from an older one', async () => {
    const { client, sdkClient } = createToolClient();
    const staleTransport = { close: vi.fn().mockResolvedValue(undefined) };
    const replacementTransport = { close: vi.fn().mockResolvedValue(undefined) };
    (client as any).transport = staleTransport;

    let rejectToolCall!: (error: Error) => void;
    const callTool = vi
      .spyOn(sdkClient, 'callTool')
      .mockImplementationOnce(
        () => new Promise((_, reject) => (rejectToolCall = reject)) as ReturnType<Client['callTool']>,
      )
      .mockResolvedValue({ content: [{ type: 'text', text: 'pong' }] });
    const connect = vi.spyOn(client, 'connect').mockResolvedValue(true);

    const tool = (await client.tools())['ping'];
    const result = tool.execute?.({});
    await vi.waitFor(() => expect(callTool).toHaveBeenCalledOnce());

    (client as any).transport = replacementTransport;
    rejectToolCall(new Error('Connection closed'));

    await expect(result).resolves.toEqual({ content: [{ type: 'text', text: 'pong' }] });
    expect(staleTransport.close).not.toHaveBeenCalled();
    expect(replacementTransport.close).not.toHaveBeenCalled();
    expect(connect).not.toHaveBeenCalled();
    expect((client as any).transport).toBe(replacementTransport);
  });

  it('reconnects again when the replacement transport fails while an earlier reconnect is settling', async () => {
    const { client, sdkClient } = createToolClient();
    const firstTransport = { close: vi.fn().mockResolvedValue(undefined) };
    const secondTransport = { close: vi.fn().mockResolvedValue(undefined) };
    const thirdTransport = { close: vi.fn().mockResolvedValue(undefined) };
    (client as any).transport = firstTransport;

    let replacementPublished!: () => void;
    const replacementWasPublished = new Promise<void>(resolve => (replacementPublished = resolve));
    let finishFirstReconnect!: () => void;
    const firstReconnectCanFinish = new Promise<void>(resolve => (finishFirstReconnect = resolve));
    const connect = vi
      .spyOn(client, 'connect')
      .mockImplementationOnce(async () => {
        (client as any).transport = secondTransport;
        replacementPublished();
        await firstReconnectCanFinish;
        return true;
      })
      .mockImplementationOnce(async () => {
        (client as any).transport = thirdTransport;
        return true;
      });
    const callTool = vi
      .spyOn(sdkClient, 'callTool')
      .mockRejectedValueOnce(new Error('Connection closed'))
      .mockRejectedValueOnce(new Error('Connection closed'))
      .mockResolvedValue({ content: [{ type: 'text', text: 'pong' }] });

    const tool = (await client.tools())['ping'];
    const firstCall = tool.execute?.({});
    await replacementWasPublished;

    const secondCall = tool.execute?.({});
    await vi.waitFor(() => expect(callTool).toHaveBeenCalledTimes(2));
    finishFirstReconnect();

    await expect(Promise.all([firstCall, secondCall])).resolves.toEqual([
      { content: [{ type: 'text', text: 'pong' }] },
      { content: [{ type: 'text', text: 'pong' }] },
    ]);
    expect(connect).toHaveBeenCalledTimes(2);
    expect(firstTransport.close).toHaveBeenCalledOnce();
    expect(secondTransport.close).toHaveBeenCalledOnce();
    expect((client as any).transport).toBe(thirdTransport);
  });

  it('does not leave a replacement transport connected when disconnect starts during reconnect', async () => {
    const { client } = createToolClient();
    const firstTransport = { close: vi.fn().mockResolvedValue(undefined) };
    const replacementTransport = { close: vi.fn().mockResolvedValue(undefined) };
    (client as any).transport = firstTransport;

    let finishConnect!: () => void;
    const connectCanFinish = new Promise<void>(resolve => (finishConnect = resolve));
    const connect = vi.spyOn(client, 'connect').mockImplementation(async () => {
      (client as any).transport = replacementTransport;
      await connectCanFinish;
      return true;
    });

    const reconnect = client.forceReconnect();
    await vi.waitFor(() => expect(connect).toHaveBeenCalledOnce());
    const disconnect = client.disconnect();
    finishConnect();

    await expect(reconnect).resolves.toBeUndefined();
    await expect(disconnect).resolves.toBeUndefined();
    expect(firstTransport.close).toHaveBeenCalledOnce();
    expect(replacementTransport.close).toHaveBeenCalledOnce();
    expect((client as any).transport).toBeUndefined();
  });

  it('does not reconnect a tool call that fails after an explicit disconnect', async () => {
    const { client, sdkClient } = createToolClient();
    const transport = { close: vi.fn().mockResolvedValue(undefined) };
    (client as any).transport = transport;

    let rejectToolCall!: (error: Error) => void;
    const callTool = vi
      .spyOn(sdkClient, 'callTool')
      .mockImplementationOnce(
        () => new Promise((_, reject) => (rejectToolCall = reject)) as ReturnType<Client['callTool']>,
      );
    const connect = vi.spyOn(client, 'connect');
    const tool = (await client.tools())['ping'];
    const result = tool.execute?.({});
    await vi.waitFor(() => expect(callTool).toHaveBeenCalledOnce());

    await client.disconnect();
    rejectToolCall(new Error('Connection closed'));

    await expect(result).rejects.toThrow('MCP client was disconnected while recovering the failed transport');
    expect(connect).not.toHaveBeenCalled();
    expect(transport.close).toHaveBeenCalledOnce();
  });
});
