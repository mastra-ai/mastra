import { MASTRA_AUTH_TOKEN_KEY, RequestContext } from '@mastra/core/request-context';
import { describe, expect, it, vi } from 'vitest';

import { makeMockExtra } from './__tests__/mock-extra';
import { MastraApiMCPServer } from './mastra-api-mcp-server';
import { MASTRA_API_OPERATIONS } from './mastra-api-operations.generated';

type ManifestRoute = {
  method: string;
  path: string;
  pathParamSchema?: Record<string, unknown>;
  queryParamSchema?: Record<string, unknown>;
  bodySchema?: Record<string, unknown>;
};

const objectSchema = (properties: Record<string, unknown>, required: string[] = []) => ({
  type: 'object',
  properties,
  required,
  additionalProperties: false,
});

const manifestResponse = (routes: ManifestRoute[]) =>
  new Response(JSON.stringify({ version: 1, routes }), {
    headers: { 'content-type': 'application/json' },
  });

const callTool = async (
  server: MastraApiMCPServer,
  name: string,
  args: Record<string, unknown>,
  authInfo?: Record<string, unknown>,
  signal?: AbortSignal,
) => {
  const sdkServer = server.getServer();
  // @ts-expect-error Access the SDK handler to test the complete MCP execution context.
  const handler = sdkServer._requestHandlers.get('tools/call');
  expect(handler).toBeDefined();
  const extra = makeMockExtra({ authInfo });
  if (signal) {
    extra.signal = signal;
    extra.mcpReq.signal = signal;
  }
  return handler!(
    {
      jsonrpc: '2.0' as const,
      id: 'test-call',
      method: 'tools/call' as const,
      params: { name, arguments: args },
    },
    extra,
  );
};

const listTools = async (server: MastraApiMCPServer) => {
  const sdkServer = server.getServer();
  // @ts-expect-error Access the SDK handler to inspect the tools exposed to MCP clients.
  const handler = sdkServer._requestHandlers.get('tools/list');
  expect(handler).toBeDefined();
  return handler!(
    { jsonrpc: '2.0' as const, id: 'test-list', method: 'tools/list' as const, params: {} },
    makeMockExtra(),
  );
};

describe('MastraApiMCPServer', () => {
  it('loads the API manifest and exposes only curated operations', async () => {
    const fetch = vi.fn(async () =>
      manifestResponse([
        { method: 'GET', path: '/agents', queryParamSchema: objectSchema({ limit: { type: 'number' } }) },
        {
          method: 'POST',
          path: '/agents/:agentId/generate',
          pathParamSchema: objectSchema({ agentId: { type: 'string' } }, ['agentId']),
          bodySchema: objectSchema({ messages: { type: 'array' } }, ['messages']),
        },
        { method: 'DELETE', path: '/agents/:agentId' },
        { method: 'POST', path: '/unapproved-operation', bodySchema: objectSchema({}) },
      ]),
    );

    const server = await MastraApiMCPServer.create({ url: 'https://mastra.example', fetch });
    const result = await listTools(server);

    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch.mock.calls[0]?.[0].toString()).toBe('https://mastra.example/api/system/api-schema');
    expect(result.tools.map((tool: { name: string }) => tool.name)).toEqual(['agent_list', 'agent_run']);
    expect(result.tools[0].inputSchema).toMatchObject({
      type: 'object',
      properties: { limit: { type: 'number' } },
    });
    expect(result.tools[0].annotations).toMatchObject({
      title: 'List available agents',
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    });
    expect(result.tools[1].annotations).toMatchObject({
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    });
    expect((server as unknown as { protocolVersion: string }).protocolVersion).toBe('2026-07-28');
  });

  it('matches every command in the generated Mastra API CLI catalog', async () => {
    const routes = MASTRA_API_OPERATIONS.map(operation => ({ method: operation.method, path: operation.path }));
    const fetch = vi.fn(async () => manifestResponse(routes));
    const server = await MastraApiMCPServer.create({ url: 'https://mastra.example', fetch });

    const result = await listTools(server);

    expect(MASTRA_API_OPERATIONS).toHaveLength(60);
    expect(result.tools.map((tool: { name: string }) => tool.name)).toEqual(
      MASTRA_API_OPERATIONS.map(operation => operation.name),
    );
  });

  it('uses the full observability route when verbose output is requested', async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(
        manifestResponse([
          {
            method: 'GET',
            path: '/observability/traces/light',
            queryParamSchema: objectSchema({ limit: { type: 'number' } }),
          },
          {
            method: 'GET',
            path: '/observability/traces',
            queryParamSchema: objectSchema({ limit: { type: 'number' } }),
          },
        ]),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ spans: [] })));
    const server = await MastraApiMCPServer.create({ url: 'https://mastra.example', fetch });
    const tools = await listTools(server);

    expect(tools.tools[0].inputSchema.properties).toMatchObject({
      verbose: { type: 'boolean', default: false },
    });

    await callTool(server, 'trace_list', { limit: 10, verbose: true });

    const [requestUrl] = fetch.mock.calls[1]!;
    const url = new URL(requestUrl.toString());
    expect(url.pathname).toBe('/api/observability/traces');
    expect(url.searchParams.get('limit')).toBe('10');
    expect(url.searchParams.has('verbose')).toBe(false);
  });

  it('uses the full observability route when the lightweight route is unavailable', async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(
        manifestResponse([
          {
            method: 'GET',
            path: '/observability/traces',
            queryParamSchema: objectSchema({ limit: { type: 'number' } }),
          },
        ]),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ spans: [] })));
    const server = await MastraApiMCPServer.create({ url: 'https://mastra.example', fetch });

    const tools = await listTools(server);
    expect(tools.tools.map((tool: { name: string }) => tool.name)).toEqual(['trace_list']);
    expect(tools.tools[0].inputSchema.properties).not.toHaveProperty('verbose');

    await callTool(server, 'trace_list', { limit: 10 });

    const [requestUrl] = fetch.mock.calls[1]!;
    expect(new URL(requestUrl.toString()).pathname).toBe('/api/observability/traces');
  });

  it('marks delete and cancel commands as destructive', async () => {
    const fetch = vi.fn(async () =>
      manifestResponse([
        {
          method: 'DELETE',
          path: '/memory/threads/:threadId',
          pathParamSchema: objectSchema({ threadId: { type: 'string' } }, ['threadId']),
        },
        {
          method: 'POST',
          path: '/workflows/:workflowId/runs/:runId/cancel',
          pathParamSchema: objectSchema(
            { workflowId: { type: 'string' }, runId: { type: 'string' } },
            ['workflowId', 'runId'],
          ),
        },
      ]),
    );
    const server = await MastraApiMCPServer.create({ url: 'https://mastra.example', fetch });

    const result = await listTools(server);

    expect(result.tools).toHaveLength(2);
    for (const tool of result.tools) {
      expect(tool.annotations).toMatchObject({ readOnlyHint: false, destructiveHint: true, openWorldHint: true });
    }
  });

  it('encodes path arguments and splits query and body arguments', async () => {
    const route: ManifestRoute = {
      method: 'POST',
      path: '/tools/:toolId/execute',
      pathParamSchema: objectSchema({ toolId: { type: 'string' } }, ['toolId']),
      queryParamSchema: objectSchema({ runId: { type: 'string' } }),
      bodySchema: objectSchema({ data: { type: 'object' }, requestContext: { type: 'object' } }, ['data']),
    };
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(manifestResponse([route]))
      .mockResolvedValueOnce(new Response(JSON.stringify({ result: 'ok' })));
    const server = await MastraApiMCPServer.create({
      url: 'https://mastra.example/',
      headers: { Authorization: 'Bearer configured-token', 'x-tenant': 'acme' },
      fetch,
    });

    const result = await callTool(
      server,
      'tool_execute',
      {
        toolId: 'weather/local',
        runId: 'run 1',
        data: { city: 'Paris' },
        requestContext: { locale: 'fr' },
      },
      { token: 'caller-token' },
    );

    expect(result.isError).toBe(false);
    expect(fetch).toHaveBeenCalledTimes(2);
    const [requestUrl, requestInit] = fetch.mock.calls[1]!;
    const url = new URL(requestUrl.toString());
    expect(url.pathname).toBe('/api/tools/weather%2Flocal/execute');
    expect(url.searchParams.get('runId')).toBe('run 1');
    expect(url.searchParams.has('toolId')).toBe(false);
    expect(requestInit?.method).toBe('POST');
    expect(JSON.parse(String(requestInit?.body))).toEqual({
      data: { city: 'Paris' },
      requestContext: { locale: 'fr' },
    });
    const headers = new Headers(requestInit?.headers);
    expect(headers.get('authorization')).toBe('Bearer caller-token');
    expect(headers.get('x-tenant')).toBe('acme');
    expect(headers.get('content-type')).toBe('application/json');
  });

  it('sends GET arguments as query parameters and uses configured authorization', async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(
        manifestResponse([
          {
            method: 'GET',
            path: '/agents',
            queryParamSchema: objectSchema({ limit: { type: 'number' }, tags: { type: 'array' } }),
          },
        ]),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: 'agent-1' }])));
    const server = await MastraApiMCPServer.create({
      url: 'https://mastra.example/api',
      headers: { Authorization: 'Bearer configured-token' },
      fetch,
    });
    expect(new Headers(fetch.mock.calls[0]?.[1]?.headers).get('authorization')).toBe('Bearer configured-token');

    await callTool(server, 'agent_list', { limit: 5, tags: ['public', 'stable'] });

    const [requestUrl, requestInit] = fetch.mock.calls[1]!;
    const url = new URL(requestUrl.toString());
    expect(url.pathname).toBe('/api/agents');
    expect(url.searchParams.get('limit')).toBe('5');
    expect(url.searchParams.get('tags')).toBe('["public","stable"]');
    expect(new Headers(requestInit?.headers).get('authorization')).toBe('Bearer configured-token');
    expect(requestInit?.body).toBeUndefined();
  });

  it('forwards request authentication when the tool runs through the Mastra API', async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(manifestResponse([{ method: 'GET', path: '/agents' }]))
      .mockResolvedValueOnce(new Response(JSON.stringify([])));
    const server = await MastraApiMCPServer.create({
      url: 'https://mastra.example',
      headers: { Authorization: 'Bearer configured-token' },
      fetch,
    });
    const requestContext = new RequestContext();
    requestContext.set(MASTRA_AUTH_TOKEN_KEY, 'request-token');

    await server.executeTool('agent_list', {}, { requestContext });

    const requestHeaders = new Headers(fetch.mock.calls[1]?.[1]?.headers);
    expect(requestHeaders.get('authorization')).toBe('Bearer request-token');
  });

  it('returns a clear API error and does not retry a failed mutation', async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(
        manifestResponse([
          {
            method: 'POST',
            path: '/agents/:agentId/generate',
            pathParamSchema: objectSchema({ agentId: { type: 'string' } }, ['agentId']),
            bodySchema: objectSchema({ messages: { type: 'array' } }, ['messages']),
          },
        ]),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: 'Agent is unavailable' } }), { status: 503 }),
      );
    const server = await MastraApiMCPServer.create({ url: 'https://mastra.example', fetch });

    const result = await callTool(server, 'agent_run', { agentId: 'support', messages: [] });

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain(
      'Mastra API request POST /agents/:agentId/generate failed with status 503: Agent is unavailable',
    );
  });

  it('does not send an API request after the MCP call is canceled', async () => {
    const route: ManifestRoute = {
      method: 'GET',
      path: '/agents',
      queryParamSchema: objectSchema({}),
    };
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(manifestResponse([route]))
      .mockImplementationOnce(async (_url, init) => {
        expect(init?.signal?.aborted).toBe(true);
        throw new DOMException('The operation was aborted.', 'AbortError');
      });
    const server = await MastraApiMCPServer.create({ url: 'https://mastra.example', fetch });
    const controller = new AbortController();
    controller.abort();

    const result = await callTool(server, 'agent_list', {}, undefined, controller.signal);

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Mastra API request GET /agents was canceled.');
  });

  it('rejects invalid targets and manifests', async () => {
    await expect(MastraApiMCPServer.create({ url: 'not a URL' })).rejects.toThrow(
      'The Mastra server URL must be a valid absolute URL.',
    );
    await expect(MastraApiMCPServer.create({ url: 'file:///tmp/mastra' })).rejects.toThrow(
      'The Mastra server URL must use HTTP or HTTPS.',
    );
    await expect(MastraApiMCPServer.create({ url: 'https://user:secret@mastra.example' })).rejects.toThrow(
      'The Mastra server URL cannot contain credentials.',
    );
    await expect(MastraApiMCPServer.create({ url: 'https://mastra.example', timeoutMs: 0 })).rejects.toThrow(
      'The request timeout must be a positive integer in milliseconds.',
    );

    const fetch = vi.fn(async () => new Response(JSON.stringify({ version: 2, routes: [] })));
    await expect(MastraApiMCPServer.create({ url: 'https://mastra.example', fetch })).rejects.toThrow(
      'The Mastra server returned an invalid API schema manifest.',
    );
  });

  it('rejects manifests without supported operations', async () => {
    const fetch = vi.fn(async () => manifestResponse([{ method: 'GET', path: '/logs' }]));

    await expect(MastraApiMCPServer.create({ url: 'https://mastra.example', fetch })).rejects.toThrow(
      'The target Mastra server does not support any of the MCP server operations.',
    );
  });
});
