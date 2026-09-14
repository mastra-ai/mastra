import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import type { Server as HttpServer } from 'node:http';
import { MastraError } from '@mastra/core/error';
import { NodeStreamableHTTPServerTransport } from '@modelcontextprotocol/node';
import { McpServer } from '@modelcontextprotocol/server';
import type { CallToolResult } from '@modelcontextprotocol/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { InternalMastraMCPClient } from './client.js';
import { MCPClient } from './configuration.js';

/**
 * Covers https://github.com/mastra-ai/mastra/issues/20527.
 *
 * The contract under test has two halves that are easy to get wrong independently:
 *   1. definitions must survive a JSON round trip with no loss of `tools/list` data, and
 *   2. a tool rebuilt from a definition must behave exactly like a discovered one, while
 *      opening no connection until it is first executed.
 *
 * These run against a real MCP server rather than mocks, so schema conversion, execution,
 * structured content and annotations are all exercised through the genuine code path.
 */

let port = 0;

async function setupTestServer(malformedCatalog = false) {
  const httpServer: HttpServer = createServer();
  const mcpServer = new McpServer(
    { name: 'test-definitions-server', version: '3.1.4' },
    { capabilities: { tools: {} }, instructions: 'Server level instructions.' },
  );

  mcpServer.registerTool(
    'greet',
    {
      description: 'A simple greeting tool',
      inputSchema: z.object({ name: z.string().describe('Name to greet').default('World') }),
      annotations: { title: 'Greeter', readOnlyHint: true },
    },
    async ({ name }): Promise<CallToolResult> => ({
      content: [{ type: 'text', text: `Hello, ${name}!` }],
    }),
  );

  // A tool with an output schema exercises the structured-content path, which is wired up
  // separately from the plain-text path and is easy to drop during hydration.
  mcpServer.registerTool(
    'measure',
    {
      description: 'Returns a structured measurement',
      inputSchema: z.object({ city: z.string() }),
      outputSchema: z.object({ celsius: z.number() }),
    },
    async ({ city }): Promise<CallToolResult> => ({
      content: [{ type: 'text', text: `measured ${city}` }],
      structuredContent: { celsius: 21 },
    }),
  );

  const listRequests = vi.fn();
  const httpRequests = vi.fn();
  if (malformedCatalog) {
    // Bypass Zod registration so the malformed schema reaches the client over the real transport.
    mcpServer.server.setRequestHandler('tools/list', async () => {
      listRequests();
      return {
        tools: [
          { name: 'greet', inputSchema: { type: 'object', properties: { name: { type: 'string' } } } },
          {
            name: 'get_l2_book',
            inputSchema: { type: 'object', properties: { coin: { type: 'string' }, required: ['coin'] } },
          },
          { name: 'measure', inputSchema: { type: 'object', properties: { city: { type: 'string' } } } },
        ],
      };
    });
  }

  // Stateless mode: SDK 1.27+ requires a new transport per request, and it lets several
  // clients talk to this server, which the cold-worker hydration test depends on.
  httpServer.on('request', async (req: any, res: any) => {
    httpRequests();
    await mcpServer.close().catch(() => {});
    const transport = new NodeStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    await mcpServer.connect(transport);
    await transport.handleRequest(req, res);
  });

  const baseUrl = await new Promise<URL>(resolve => {
    httpServer.listen(0, '127.0.0.1', () => {
      const addr = httpServer.address();
      port = typeof addr === 'object' && addr ? addr.port : 0;
      resolve(new URL(`http://127.0.0.1:${port}/mcp`));
    });
  });

  return { httpServer, mcpServer, baseUrl, listRequests, httpRequests };
}

describe('serializable MCP tool definitions (issue #20527)', () => {
  let testServer: Awaited<ReturnType<typeof setupTestServer>>;

  beforeEach(async () => {
    testServer = await setupTestServer();
  });

  afterEach(async () => {
    await testServer?.mcpServer.close().catch(() => {});
    testServer?.httpServer.close();
  });

  describe('InternalMastraMCPClient', () => {
    let client: InternalMastraMCPClient;

    beforeEach(async () => {
      client = new InternalMastraMCPClient({ name: 'defs', server: { url: testServer.baseUrl } });
      await client.connect();
    });

    afterEach(async () => {
      await client?.disconnect().catch(() => {});
    });

    it('exposes tools/list data as definitions that survive a JSON round trip', async () => {
      const definitions = await client.toolDefinitions();

      expect(Object.keys(definitions).sort()).toEqual(['greet', 'measure']);
      expect(definitions.greet.description).toBe('A simple greeting tool');
      expect(definitions.greet.annotations).toMatchObject({ title: 'Greeter', readOnlyHint: true });
      expect(definitions.measure.outputSchema).toBeDefined();

      // The whole point is cacheability: no functions, no client references.
      expect(JSON.parse(JSON.stringify(definitions))).toEqual(definitions);
    });

    it('captures server metadata that is otherwise only reachable from a live connection', async () => {
      const definitions = await client.toolDefinitions();

      // Without this, a hydrated tool would silently lose the server version and instructions
      // that a normally discovered tool carries.
      expect(definitions.greet.server).toEqual({
        name: 'defs',
        version: '3.1.4',
        instructions: 'Server level instructions.',
      });
    });

    it('rebuilds a tool that matches the discovered one and executes identically', async () => {
      const definitions = await client.toolDefinitions();
      const cached = JSON.parse(JSON.stringify(definitions));

      const discovered = (await client.tools()).greet;
      const hydrated = client.toolFromDefinition({ definition: cached.greet });

      expect(hydrated.id).toBe(discovered.id);
      expect(hydrated.description).toBe(discovered.description);
      // Schema wrappers compare by identity, so compare the schema they carry.
      expect(JSON.stringify(hydrated.inputSchema)).toEqual(JSON.stringify(discovered.inputSchema));
      expect((hydrated as any).mcp).toEqual((discovered as any).mcp);

      const fromDiscovered = await discovered.execute!({ name: 'Ada' } as any, {});
      const fromHydrated = await hydrated.execute!({ name: 'Ada' } as any, {});
      expect(fromHydrated).toEqual(fromDiscovered);
      expect(JSON.stringify(fromHydrated)).toContain('Hello, Ada!');
    });

    it('preserves structured content behavior for tools with an output schema', async () => {
      const definitions = await client.toolDefinitions();
      const hydrated = client.toolFromDefinition({ definition: JSON.parse(JSON.stringify(definitions.measure)) });

      expect(hydrated.outputSchema).toBeDefined();
      // `toModelOutput` is only attached for output-schema tools; losing it would silently
      // change how results are presented to the model.
      expect((hydrated as any).toModelOutput).toBeTypeOf('function');

      const result = await hydrated.execute!({ city: 'Berlin' } as any, {});
      expect(result).toMatchObject({ celsius: 21 });
    });

    it('validates structuredContent against outputSchema on the hydrated (cached-catalog) path (issue #22549)', async () => {
      const definitions = await client.toolDefinitions();
      const hydrated = client.toolFromDefinition({ definition: JSON.parse(JSON.stringify(definitions.measure)) });

      // A hydrated tool never calls tools/list, so the MCP SDK's own output-schema cache is
      // empty and its AJV check cannot fire. Mocking callTool simulates a misbehaving server
      // returning structuredContent that violates the advertised outputSchema.
      const sdkClient = (client as any).client;
      vi.spyOn(sdkClient, 'callTool').mockResolvedValue({
        content: [{ type: 'text', text: 'bad' }],
        structuredContent: { celsius: 'warm' },
        isError: false,
      });

      const invalid = await hydrated.execute!({ city: 'Berlin' } as any, {});
      expect(invalid).toMatchObject({ error: true });
      expect((invalid as any).message).toContain('Tool output validation failed for measure');
      expect((invalid as any).validationErrors).toBeDefined();

      vi.restoreAllMocks();
      const valid = await hydrated.execute!({ city: 'Berlin' } as any, {});
      expect(valid).toMatchObject({ celsius: 21 });
    });
  });

  describe('MCPClient', () => {
    let mcp: MCPClient;
    const clients: MCPClient[] = [];

    afterEach(async () => {
      await Promise.all(clients.map(client => client.disconnect().catch(() => {})));
      clients.length = 0;
    });

    function createClient(servers?: Record<string, any>) {
      mcp = new MCPClient({
        id: `defs-test-${randomUUID()}`,
        servers: servers ?? { weather: { url: testServer.baseUrl } },
      });
      clients.push(mcp);
      return mcp;
    }

    it('returns a catalog grouped by server and keyed by unnamespaced tool name', async () => {
      const definitions = await createClient().listToolDefinitions();

      expect(Object.keys(definitions)).toEqual(['weather']);
      expect(Object.keys(definitions.weather).sort()).toEqual(['greet', 'measure']);
      expect(JSON.parse(JSON.stringify(definitions))).toEqual(definitions);
    });

    it('reports per-server failures instead of silently caching a partial catalog', async () => {
      const client = createClient({
        weather: { url: testServer.baseUrl },
        broken: { url: new URL('http://127.0.0.1:1/mcp'), timeout: 500 },
      });

      const { definitions, errors } = await client.listToolDefinitionsWithErrors();

      expect(Object.keys(definitions)).toEqual(['weather']);
      expect(errors.broken).toBeDefined();
    });

    it('hydrates a whole catalog into a namespaced tool map without connecting', async () => {
      const definitions = await createClient().listToolDefinitions();
      const cached = JSON.parse(JSON.stringify(definitions));

      // A fresh client stands in for a cold worker process that has never talked to the server.
      const worker = createClient();
      const tools = await worker.toolsFromDefinitions({ definitions: cached });

      expect(Object.keys(tools).sort()).toEqual(['weather_greet', 'weather_measure']);
      // The whole tool map was rebuilt without opening a single connection.
      expect((worker as any).mcpClientsById.get('weather')?.isConnected).toBeFalsy();

      // Connection is deferred until the tool is actually used.
      const result = await tools.weather_greet.execute!({ name: 'Grace' } as any, {});
      expect(JSON.stringify(result)).toContain('Hello, Grace!');
      expect((worker as any).mcpClientsById.get('weather')?.isConnected).toBeTruthy();
    });

    it('skips cached definitions for servers that are no longer configured', async () => {
      const definitions = await createClient().listToolDefinitions();
      const cached = JSON.parse(JSON.stringify(definitions));
      cached.retired = { ghost: { ...cached.weather.greet, name: 'ghost' } };

      const tools = await mcp.toolsFromDefinitions({ definitions: cached });

      expect(Object.keys(tools).sort()).toEqual(['weather_greet', 'weather_measure']);
    });
  });
});

describe('malformed MCP tool catalogs (issue #23731)', () => {
  let testServer: Awaited<ReturnType<typeof setupTestServer>>;
  const clients: MCPClient[] = [];
  const logger = vi.fn();

  beforeEach(async () => {
    logger.mockClear();
    testServer = await setupTestServer(true);
  });

  afterEach(async () => {
    await Promise.all(clients.map(client => client.disconnect()));
    clients.length = 0;
    await testServer.mcpServer.close();
    await new Promise<void>((resolve, reject) => {
      testServer.httpServer.close(error => (error ? reject(error) : resolve()));
      testServer.httpServer.closeAllConnections();
    });
    vi.restoreAllMocks();
  });

  function createClient() {
    const client = new MCPClient({
      id: `malformed-defs-${randomUUID()}`,
      servers: { weather: { url: testServer.baseUrl, logger } },
    });
    clients.push(client);
    return client;
  }

  it.each(['listTools', 'listToolsets'] as const)(
    '%s filters a malformed HTTP tool between healthy siblings and executes a healthy tool',
    async method => {
      const client = createClient();
      const tools = method === 'listTools' ? await client.listTools() : (await client.listToolsets()).weather;
      const greetKey = method === 'listTools' ? 'weather_greet' : 'greet';
      const measureKey = method === 'listTools' ? 'weather_measure' : 'measure';

      expect(Object.keys(tools)).toEqual([greetKey, measureKey]);
      const warnings = logger.mock.calls.map(([entry]) => entry).filter(entry => entry.level === 'warning');
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toMatchObject({ serverName: 'weather' });
      expect(JSON.stringify(warnings[0])).toContain('get_l2_book');
      expect(JSON.stringify(warnings[0])).toContain('/properties/required');
      expect(tools[greetKey].inputSchema?.['~standard'].jsonSchema.input({ target: 'draft-07' })).toMatchObject({
        type: 'object',
        properties: { name: { type: 'string' } },
      });
      expect(tools[measureKey].inputSchema?.['~standard'].jsonSchema.input({ target: 'draft-07' })).toMatchObject({
        type: 'object',
        properties: { city: { type: 'string' } },
      });
      expect(await tools[greetKey].execute!({ name: 'Ada' }, {})).toMatchObject({
        content: [{ type: 'text', text: 'Hello, Ada!' }],
      });
    },
  );

  it('preserves the raw catalog but filters malformed cached definitions without connection or rediscovery', async () => {
    const definitions = await createClient().listToolDefinitions();
    expect(Object.keys(definitions.weather)).toEqual(['greet', 'get_l2_book', 'measure']);
    expect(definitions.weather.get_l2_book.inputSchema).toEqual({
      type: 'object',
      properties: { coin: { type: 'string' }, required: ['coin'] },
    });
    const cached = JSON.parse(JSON.stringify(definitions));
    const worker = createClient();
    testServer.httpRequests.mockClear();
    testServer.listRequests.mockClear();

    const tools = await worker.toolsFromDefinitions({ definitions: cached });

    expect(Object.keys(tools)).toEqual(['weather_greet', 'weather_measure']);
    const warnings = logger.mock.calls.map(([entry]) => entry).filter(entry => entry.level === 'warning');
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({ serverName: 'weather' });
    expect(JSON.stringify(warnings[0])).toContain('get_l2_book');
    expect(cached).toEqual(definitions);
    expect(testServer.httpRequests).not.toHaveBeenCalled();
    expect(testServer.listRequests).not.toHaveBeenCalled();
    expect(tools.weather_greet.inputSchema?.['~standard'].jsonSchema.input({ target: 'draft-07' })).toMatchObject({
      type: 'object',
      properties: { name: { type: 'string' } },
    });
    expect(await tools.weather_greet.execute!({ name: 'Grace' }, {})).toMatchObject({
      content: [{ type: 'text', text: 'Hello, Grace!' }],
    });
    expect(testServer.httpRequests).toHaveBeenCalled();
    expect(testServer.listRequests).not.toHaveBeenCalled();
  });

  it('returns no server error when every discovered tool is invalid', async () => {
    testServer.mcpServer.server.setRequestHandler('tools/list', async () => ({
      tools: [{ name: 'bad', inputSchema: { type: 'object', properties: { required: ['coin'] } } }],
    }));

    const result = await createClient().listToolsWithErrors();

    expect(result.tools).toEqual({});
    expect(result.errors).toEqual({});
    expect(result.errorDetails).toEqual({});
    expect(logger.mock.calls.filter(([entry]) => entry.level === 'warning')).toHaveLength(1);
  });

  it('continues bulk hydration across an all-invalid server and preserves wrapped healthy schemas', async () => {
    const definitions = await createClient().listToolDefinitions();
    const worker = new MCPClient({
      id: `multi-server-${randomUUID()}`,
      servers: {
        broken: { url: testServer.baseUrl, logger },
        healthy: { url: testServer.baseUrl, logger },
      },
    });
    clients.push(worker);
    const cached = JSON.parse(
      JSON.stringify({
        broken: { bad: definitions.weather.get_l2_book },
        healthy: {
          greet: {
            ...definitions.weather.greet,
            inputSchema: { jsonSchema: definitions.weather.greet.inputSchema },
          },
          bad: {
            ...definitions.weather.get_l2_book,
            inputSchema: { jsonSchema: definitions.weather.get_l2_book.inputSchema },
          },
          measure: definitions.weather.measure,
        },
      }),
    );
    testServer.httpRequests.mockClear();

    const tools = await worker.toolsFromDefinitions({ definitions: cached });

    expect(Object.keys(tools)).toEqual(['healthy_greet', 'healthy_measure']);
    expect(testServer.httpRequests).not.toHaveBeenCalled();
    expect(logger.mock.calls.filter(([entry]) => entry.level === 'warning')).toHaveLength(2);
  });

  it('does not swallow unrelated failures during bulk hydration', async () => {
    const definitions = await createClient().listToolDefinitions();
    const failure = new Error('unrelated hydration failure');
    vi.spyOn(InternalMastraMCPClient.prototype, 'toolFromDefinition').mockImplementationOnce(() => {
      throw failure;
    });

    await expect(createClient().toolsFromDefinitions({ definitions })).rejects.toBe(failure);
  });

  it('rejects explicit hydration with the dedicated error before connecting', async () => {
    const definitions = await createClient().listToolDefinitions();
    const worker = createClient();
    testServer.httpRequests.mockClear();

    const hydration = worker.toolFromDefinition({ serverName: 'weather', definition: definitions.weather.get_l2_book });
    await expect(hydration).rejects.toBeInstanceOf(MastraError);
    await expect(hydration).rejects.toMatchObject({ id: 'MCP_CLIENT_INVALID_TOOL_INPUT_SCHEMA' });
    expect(testServer.httpRequests).not.toHaveBeenCalled();
  });
});
