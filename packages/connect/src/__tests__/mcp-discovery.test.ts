import { RequestContext } from '@mastra/core/request-context';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { platformMcpTransport, resolveClient } from '../client.js';
import { connect } from '../connect.js';
import { PROVIDERS, type ProviderRegistration } from '../registry.js';

const PLATFORM_TOKEN = 'platform-token';
const INTEGRATION_ID = 'catalog-mcp';
const CONNECTION_ID = 'mcp_01K2E7Q11BCDEFGHJKMNPQRSTV';
const MCP_PATH = `/v2/connections/${CONNECTION_ID}/mcp`;

function requestBody(init?: RequestInit): Record<string, unknown> {
  if (typeof init?.body === 'string') return JSON.parse(init.body) as Record<string, unknown>;
  if (init?.body instanceof Uint8Array) {
    return JSON.parse(new TextDecoder().decode(init.body)) as Record<string, unknown>;
  }
  throw new Error(`Unexpected MCP request body: ${String(init?.body)}`);
}

function createGatewayFetch(options: { connections?: Array<Record<string, unknown>> } = {}) {
  const protocolRequests: Array<{ body: Record<string, unknown>; headers: Headers; method: string }> = [];
  let initializeCount = 0;
  const connections = options.connections ?? [
    {
      id: CONNECTION_ID,
      integrationId: INTEGRATION_ID,
      status: 'active',
      connectedByUserId: 'user-1',
      connectedAt: '2026-09-13T00:00:00.000Z',
      createdAt: '2026-09-13T00:00:00.000Z',
      accountLabel: 'Catalog MCP test account',
    },
  ];
  const fetchMock = vi.fn<typeof fetch>().mockImplementation(async (input, init) => {
    const url = new URL(String(input));
    if (url.pathname === '/v2/integrations') {
      return Response.json({
        integrations: [
          { id: INTEGRATION_ID, capabilities: { mcp: true } },
          { id: 'http-only', capabilities: { mcp: false } },
        ],
      });
    }
    if (url.pathname === '/v2/projects/project-1/connections') {
      return Response.json({ connections });
    }
    if (url.pathname !== MCP_PATH) return new Response('not found', { status: 404 });
    if (init?.method === 'DELETE') return new Response(null, { status: 204 });

    const body = requestBody(init);
    const headers = new Headers(init?.headers);
    protocolRequests.push({ body, headers, method: init?.method ?? 'GET' });
    const method = body.method;
    if (method === 'initialize') {
      initializeCount += 1;
      const params = body.params as { protocolVersion?: string };
      return Response.json(
        {
          jsonrpc: '2.0',
          id: body.id,
          result: {
            protocolVersion: params.protocolVersion ?? '2025-06-18',
            capabilities: { tools: { listChanged: false } },
            serverInfo: { name: 'Catalog MCP Server', version: '1.0.0' },
          },
        },
        { headers: { 'mcp-session-id': 'catalog-session-1' } },
      );
    }
    if (method === 'notifications/initialized') return new Response(null, { status: 202 });
    if (method === 'tools/list') {
      return Response.json({
        jsonrpc: '2.0',
        id: body.id,
        result: {
          tools: [
            {
              name: 'list_records',
              description: 'List records',
              inputSchema: { type: 'object', properties: {}, additionalProperties: false },
              annotations: { readOnlyHint: true, destructiveHint: false },
            },
            {
              name: 'update_record',
              description: 'Update a record',
              inputSchema: {
                type: 'object',
                properties: { value: { type: 'string' } },
                required: ['value'],
                additionalProperties: false,
              },
              annotations: { readOnlyHint: false, destructiveHint: true },
            },
          ],
        },
      });
    }
    if (method === 'tools/call') {
      return Response.json({
        jsonrpc: '2.0',
        id: body.id,
        result: { content: [{ type: 'text', text: JSON.stringify({ updated: true }) }] },
      });
    }
    return new Response(null, { status: 202 });
  });
  return { fetchMock, protocolRequests, getInitializeCount: () => initializeCount };
}

const resolvers: Array<ReturnType<typeof connect>> = [];
afterEach(async () => {
  await Promise.all(resolvers.splice(0).map(resolver => resolver.disconnect()));
  delete process.env.MASTRA_CATALOG_MCP_CONNECTION_ID;
});

describe('catalog-backed MCP providers', () => {
  it('discovers and executes an MCP integration with no checked-in provider registration', async () => {
    expect(PROVIDERS.some(provider => provider.integrationId === INTEGRATION_ID)).toBe(false);
    const gateway = createGatewayFetch();
    const tools = connect({
      projectId: 'project-1',
      client: {
        accessToken: PLATFORM_TOKEN,
        baseUrl: 'https://integrations.example.test',
        fetch: gateway.fetchMock,
      },
    });
    resolvers.push(tools);

    const discovered = await tools();
    expect(Object.keys(discovered).sort()).toEqual(['catalog-mcp_list_records', 'catalog-mcp_update_record']);
    const updateRecord = discovered['catalog-mcp_update_record'] as (typeof discovered)[string] & {
      execute: (input: unknown, context: { requestContext: RequestContext }) => Promise<unknown>;
    };
    await updateRecord.execute({ value: 'updated' }, { requestContext: new RequestContext() });

    const methods = gateway.protocolRequests.map(request => request.body.method);
    expect(methods).toContain('initialize');
    expect(methods).toContain('tools/list');
    expect(methods).toContain('tools/call');
    const toolCall = gateway.protocolRequests.find(request => request.body.method === 'tools/call')!;
    expect(toolCall.body).toMatchObject({
      method: 'tools/call',
      params: { name: 'update_record', arguments: { value: 'updated' } },
    });
    for (const request of gateway.protocolRequests) {
      expect(request.headers.get('authorization')).toBe(`Bearer ${PLATFORM_TOKEN}`);
      expect(request.headers.get('accept')).toContain('application/json');
    }
    expect(
      gateway.protocolRequests.some(request => request.headers.get('mcp-session-id') === 'catalog-session-1'),
    ).toBe(true);
  });

  it('applies integration overrides and a derived connection-id environment variable', async () => {
    process.env.MASTRA_CATALOG_MCP_CONNECTION_ID = CONNECTION_ID;
    const gateway = createGatewayFetch({
      connections: [
        {
          id: CONNECTION_ID,
          integrationId: INTEGRATION_ID,
          status: 'active',
        },
        {
          id: 'mcp_01K2E7Q11BCDEFGHJKMNPQRSTW',
          integrationId: INTEGRATION_ID,
          status: 'active',
        },
      ],
    });
    const tools = connect({
      projectId: 'project-1',
      integrations: { [INTEGRATION_ID]: { allowTools: ['catalog-mcp_list_records'] } },
      client: {
        accessToken: PLATFORM_TOKEN,
        baseUrl: 'https://integrations.example.test',
        fetch: gateway.fetchMock,
      },
    });
    resolvers.push(tools);

    const discovered = await tools();
    expect(Object.keys(discovered)).toEqual(['catalog-mcp_list_records']);
  });

  it('prefers catalog MCP discovery over a checked-in HTTP registration', async () => {
    const createTools = vi.fn().mockReturnValue({ should_not_exist: { id: 'should_not_exist' } });
    const providers = PROVIDERS as ProviderRegistration[];
    providers.push({
      integrationId: INTEGRATION_ID,
      envVar: 'MASTRA_CATALOG_MCP_CONNECTION_ID',
      createTools: createTools as never,
    });
    try {
      const gateway = createGatewayFetch();
      const tools = connect({
        projectId: 'project-1',
        client: {
          accessToken: PLATFORM_TOKEN,
          baseUrl: 'https://integrations.example.test',
          fetch: gateway.fetchMock,
        },
      });
      resolvers.push(tools);

      const discovered = await tools();
      expect(discovered).toHaveProperty('catalog-mcp_list_records');
      expect(discovered).not.toHaveProperty('should_not_exist');
      expect(createTools).not.toHaveBeenCalled();
    } finally {
      providers.pop();
    }
  });

  it('reuses one MCP session across refreshes and closes it explicitly', async () => {
    const gateway = createGatewayFetch();
    const tools = connect({
      projectId: 'project-1',
      client: {
        accessToken: PLATFORM_TOKEN,
        baseUrl: 'https://integrations.example.test',
        fetch: gateway.fetchMock,
      },
    });
    resolvers.push(tools);

    await tools();
    await tools.refresh();
    expect(gateway.getInitializeCount()).toBe(1);
    await tools.disconnect();
    await tools();
    expect(gateway.getInitializeCount()).toBe(2);
  });

  it('locks the transport to its Platform connection URL and redacts token-bearing network errors', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockRejectedValue(new Error(`failed with ${PLATFORM_TOKEN}`));
    const client = resolveClient({
      accessToken: PLATFORM_TOKEN,
      baseUrl: 'https://integrations.example.test',
      fetch: fetchMock,
    });
    const transport = platformMcpTransport(client, CONNECTION_ID);

    await expect(transport.fetch('https://attacker.example/mcp')).rejects.toMatchObject({ code: 'invalid_options' });
    await expect(transport.fetch(transport.url)).rejects.toThrow('failed with [REDACTED]');
  });
});

describe('MCP tool approval', () => {
  type ApprovalTool = { requireApproval?: boolean; needsApprovalFn?: (args: unknown, ctx?: unknown) => unknown };
  const discover = async (integrations?: Record<string, { autoApproveTools?: string[] }>) => {
    const gateway = createGatewayFetch();
    const tools = connect({
      projectId: 'project-1',
      integrations,
      client: { accessToken: PLATFORM_TOKEN, baseUrl: 'https://integrations.example.test', fetch: gateway.fetchMock },
    });
    resolvers.push(tools);
    return (await tools()) as Record<string, ApprovalTool>;
  };

  it('requires approval for every discovered tool regardless of server annotations', async () => {
    const discovered = await discover();
    for (const key of ['catalog-mcp_list_records', 'catalog-mcp_update_record']) {
      expect(discovered[key]!.requireApproval).toBe(true);
      expect(await discovered[key]!.needsApprovalFn!({}, {})).toBe(true);
    }
  });

  it('skips approval only for tools in the local autoApproveTools list', async () => {
    const discovered = await discover({ [INTEGRATION_ID]: { autoApproveTools: ['catalog-mcp_list_records'] } });
    expect(await discovered['catalog-mcp_list_records']!.needsApprovalFn!({}, {})).toBe(false);
    expect(await discovered['catalog-mcp_update_record']!.needsApprovalFn!({}, {})).toBe(true);
  });

  it('skips the provider and warns when autoApproveTools names an unknown tool', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const discovered = await discover({ [INTEGRATION_ID]: { autoApproveTools: ['catalog-mcp_delete_everything'] } });
    expect(discovered).toEqual({});
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('autoApproveTools'));
    warnSpy.mockRestore();
  });
});
