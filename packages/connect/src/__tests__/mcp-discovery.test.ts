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

function createGatewayFetch(
  options: {
    connections?: Array<Record<string, unknown>>;
    matchAnyConnectionMcpPath?: boolean;
    /**
     * Per-connection-id tool list overrides. Keys are raw connection ids
     * (matching `mcp_...` segments of the request path). When omitted for a
     * connection, the default two-tool catalog is served.
     */
    toolsByConnectionId?: Record<string, Array<Record<string, unknown>>>;
    /**
     * Mutable set of raw connection ids that should reject `tools/list` with
     * a JSON-RPC error. Tests can clear it between resolver calls to simulate
     * a transient failure that recovers on the next refresh.
     */
    failToolsListForConnectionIds?: Set<string>;
  } = {},
) {
  const protocolRequests: Array<{ body: Record<string, unknown>; headers: Headers; method: string }> = [];
  let initializeCount = 0;
  const initializeCountByConnectionId = new Map<string, number>();
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
    const isMcpPath = options.matchAnyConnectionMcpPath
      ? /^\/v2\/connections\/[^/]+\/mcp$/.test(url.pathname)
      : url.pathname === MCP_PATH;
    if (!isMcpPath) return new Response('not found', { status: 404 });
    if (init?.method === 'DELETE') return new Response(null, { status: 204 });

    const body = requestBody(init);
    const headers = new Headers(init?.headers);
    protocolRequests.push({ body, headers, method: init?.method ?? 'GET' });
    const method = body.method;
    if (method === 'initialize') {
      initializeCount += 1;
      const params = body.params as { protocolVersion?: string };
      // Derive the session id from the connection segment so multiple
      // simultaneous MCP clients (one per connection) don't collide on the
      // SDK's session bookkeeping.
      const match = url.pathname.match(/\/v2\/connections\/([^/]+)\/mcp/);
      if (match) {
        initializeCountByConnectionId.set(match[1]!, (initializeCountByConnectionId.get(match[1]!) ?? 0) + 1);
      }
      const sessionId = match ? `catalog-session-${match[1]}` : 'catalog-session-1';
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
        { headers: { 'mcp-session-id': sessionId } },
      );
    }
    if (method === 'notifications/initialized') return new Response(null, { status: 202 });
    if (method === 'tools/list') {
      // Resolve per-connection tool list by parsing the connection id from
      // the request URL. Falls back to the default two-tool catalog.
      const connectionIdMatch = url.pathname.match(/\/v2\/connections\/([^/]+)\/mcp/);
      const parsedConnectionId = connectionIdMatch?.[1];
      if (parsedConnectionId && options.failToolsListForConnectionIds?.has(parsedConnectionId)) {
        return Response.json({
          jsonrpc: '2.0',
          id: body.id,
          error: { code: -32000, message: `tools/list failed for ${parsedConnectionId}` },
        });
      }
      const perConnection = parsedConnectionId ? options.toolsByConnectionId?.[parsedConnectionId] : undefined;
      const defaultTools = [
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
      ];
      return Response.json({
        jsonrpc: '2.0',
        id: body.id,
        result: { tools: perConnection ?? defaultTools },
      });
    }
    if (method === 'tools/call') {
      return Response.json({
        jsonrpc: '2.0',
        id: body.id,
        result: { content: [{ type: 'text', text: JSON.stringify({ updated: true }) }] },
      });
    }
    if (body.id !== undefined) {
      // A pre-2026-07-28 server answers unknown requests (including the
      // client's server/discover probe) with method-not-found, which is what
      // tells the client to negotiate the legacy initialize handshake.
      return Response.json({
        jsonrpc: '2.0',
        id: body.id,
        error: { code: -32601, message: `Method not found: ${String(method)}` },
      });
    }
    return new Response(null, { status: 202 });
  });
  return {
    fetchMock,
    protocolRequests,
    getInitializeCount: () => initializeCount,
    getInitializeCountForConnection: (connectionId: string) => initializeCountByConnectionId.get(connectionId) ?? 0,
  };
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
      gateway.protocolRequests.some(request =>
        (request.headers.get('mcp-session-id') ?? '').startsWith('catalog-session-'),
      ),
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

describe('MCP tool approval — multi-connection wrappers', () => {
  type ApprovalTool = {
    requireApproval?: boolean;
    needsApprovalFn?: (args: unknown, ctx?: unknown) => unknown;
  };
  const TWO_CONNECTIONS = [
    {
      id: CONNECTION_ID,
      integrationId: INTEGRATION_ID,
      status: 'active',
      connectedByUserId: 'user-1',
      connectedAt: '2026-09-13T00:00:00.000Z',
      createdAt: '2026-09-13T00:00:00.000Z',
      accountLabel: 'Acme',
    },
    {
      id: 'mcp_01K2E7Q11BCDEFGHJKMNPQRSTW',
      integrationId: INTEGRATION_ID,
      status: 'active',
      connectedByUserId: 'user-1',
      connectedAt: '2026-09-13T00:00:00.000Z',
      createdAt: '2026-09-13T00:00:00.000Z',
      accountLabel: 'Globex',
    },
  ];

  const discover = async (integrations?: Record<string, { autoApproveTools?: string[] }>) => {
    const gateway = createGatewayFetch({ connections: TWO_CONNECTIONS, matchAnyConnectionMcpPath: true });
    const tools = connect({
      projectId: 'project-1',
      integrations,
      client: { accessToken: PLATFORM_TOKEN, baseUrl: 'https://integrations.example.test', fetch: gateway.fetchMock },
    });
    resolvers.push(tools);
    return (await tools()) as Record<string, ApprovalTool>;
  };

  it('preserves requireApproval and needsApprovalFn on wrapped multi-connection MCP tools', async () => {
    const discovered = await discover();
    for (const key of ['catalog-mcp_list_records', 'catalog-mcp_update_record']) {
      expect(discovered[key]!.requireApproval).toBe(true);
      // Fail-closed on missing connection_name so the approval prompt is
      // still triggered even when the caller has not selected a connection.
      expect(await discovered[key]!.needsApprovalFn!({}, {})).toBe(true);
      // The resolved inner connection still says approval is required.
      expect(await discovered[key]!.needsApprovalFn!({ connection_name: 'Acme' }, {})).toBe(true);
    }
    // The list_connections helper is auto-generated and must never gate the
    // agent behind an approval prompt.
    expect(discovered['catalog-mcp__list_connections']!.requireApproval).toBeFalsy();
  });

  it('does not require approval for a tool the caller placed in autoApproveTools, even through the wrapper', async () => {
    const discovered = await discover({
      [INTEGRATION_ID]: { autoApproveTools: ['catalog-mcp_list_records'] },
    });
    // list_records is auto-approved on every connection: the wrapper's
    // needsApprovalFn resolves to Acme's inner tool, which returns false.
    expect(await discovered['catalog-mcp_list_records']!.needsApprovalFn!({ connection_name: 'Acme' }, {})).toBe(false);
    // update_record still requires approval on every connection.
    expect(await discovered['catalog-mcp_update_record']!.needsApprovalFn!({ connection_name: 'Acme' }, {})).toBe(true);
    expect(await discovered['catalog-mcp_update_record']!.needsApprovalFn!({ connection_name: 'Globex' }, {})).toBe(
      true,
    );
  });

  it('fails closed when connection_name resolves to an unknown connection', async () => {
    const discovered = await discover();
    // Unknown / missing connection_name should require approval regardless of
    // the inner policy — a caller must never bypass approval by omitting the
    // routing input.
    expect(await discovered['catalog-mcp_update_record']!.needsApprovalFn!({ connection_name: 'Nope' }, {})).toBe(true);
    expect(await discovered['catalog-mcp_update_record']!.needsApprovalFn!({}, {})).toBe(true);
  });

  it('validates autoApproveTools against the union of MCP catalogs across connections', async () => {
    // Second connection exposes an extra tool the first does not. The union
    // must include it so autoApproveTools can reference it without being
    // rejected by an earlier connection's catalog.
    const gateway = createGatewayFetch({
      connections: TWO_CONNECTIONS,
      matchAnyConnectionMcpPath: true,
      toolsByConnectionId: {
        [TWO_CONNECTIONS[1]!.id as string]: [
          {
            name: 'list_records',
            description: 'List records',
            inputSchema: { type: 'object', properties: {}, additionalProperties: false },
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
          },
          {
            name: 'delete_record',
            description: 'Delete a record (only on Globex)',
            inputSchema: {
              type: 'object',
              properties: { id: { type: 'string' } },
              required: ['id'],
              additionalProperties: false,
            },
          },
        ],
      },
    });
    const tools = connect({
      projectId: 'project-1',
      integrations: { [INTEGRATION_ID]: { autoApproveTools: ['catalog-mcp_delete_record'] } },
      client: { accessToken: PLATFORM_TOKEN, baseUrl: 'https://integrations.example.test', fetch: gateway.fetchMock },
    });
    resolvers.push(tools);
    const discovered = (await tools()) as Record<string, ApprovalTool>;
    // delete_record surfaces via the key-union; auto-approved on Globex.
    expect(discovered).toHaveProperty('catalog-mcp_delete_record');
    expect(
      await discovered['catalog-mcp_delete_record']!.needsApprovalFn!({ id: 'r1', connection_name: 'Globex' }, {}),
    ).toBe(false);
  });

  it('accepts per-connection input differences at the wrapper (inner tool re-validates)', async () => {
    // Same tool key on both connections but with divergent input schemas.
    // The wrapper's inputSchema is passthrough, so a Globex-shaped call is
    // not rejected against Acme's stricter schema before dispatch.
    const gateway = createGatewayFetch({
      connections: TWO_CONNECTIONS,
      matchAnyConnectionMcpPath: true,
      toolsByConnectionId: {
        [TWO_CONNECTIONS[0]!.id as string]: [
          {
            name: 'update_record',
            description: 'Update a record',
            inputSchema: {
              type: 'object',
              properties: { value: { type: 'string' } },
              required: ['value'],
              additionalProperties: false,
            },
          },
        ],
        [TWO_CONNECTIONS[1]!.id as string]: [
          {
            name: 'update_record',
            description: 'Update a record (Globex takes an id too)',
            inputSchema: {
              type: 'object',
              properties: { value: { type: 'string' }, id: { type: 'string' } },
              required: ['value', 'id'],
              additionalProperties: false,
            },
          },
        ],
      },
    });
    const tools = connect({
      projectId: 'project-1',
      client: { accessToken: PLATFORM_TOKEN, baseUrl: 'https://integrations.example.test', fetch: gateway.fetchMock },
    });
    resolvers.push(tools);
    const discovered = (await tools()) as unknown as Record<
      string,
      ApprovalTool & { execute: (input: unknown, ctx: { requestContext: RequestContext }) => Promise<unknown> }
    >;
    // Would have thrown a ValidationError if the wrapper enforced Acme's
    // schema on this Globex-shaped call (Acme forbids `id`,
    // additionalProperties: false).
    await expect(
      discovered['catalog-mcp_update_record']!.execute(
        { value: 'x', id: 'r1', connection_name: 'Globex' },
        { requestContext: new RequestContext() },
      ),
    ).resolves.toBeDefined();
  });

  it('cleans up MCP clients cached by a failed multi-connection discovery so the next refresh reconnects', async () => {
    const acmeId = TWO_CONNECTIONS[0]!.id as string;
    const globexId = TWO_CONNECTIONS[1]!.id as string;
    // Second connection fails discovery on the first pass; both succeed on
    // the retry after the failure gate is lifted.
    const failing = new Set<string>([globexId]);
    const gateway = createGatewayFetch({
      connections: TWO_CONNECTIONS,
      matchAnyConnectionMcpPath: true,
      failToolsListForConnectionIds: failing,
    });
    const tools = connect({
      projectId: 'project-1',
      client: { accessToken: PLATFORM_TOKEN, baseUrl: 'https://integrations.example.test', fetch: gateway.fetchMock },
    });
    resolvers.push(tools);

    // First pass: `mapTools` warn-and-skips on any provider error, so the
    // resolver returns {} and logs a warning naming the failed integration.
    // The construction path still cached the Acme MCPClient before the
    // Globex `tools/list` throw; the try/catch inside
    // `buildMcpMultiConnectionTools` must evict and disconnect it.
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const firstPass = await tools();
    expect(firstPass).toEqual({});
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('MCP tool discovery failed for connection'));
    const acmeInitsAfterFailure = gateway.getInitializeCountForConnection(acmeId);
    expect(acmeInitsAfterFailure).toBeGreaterThanOrEqual(1);
    warnSpy.mockRestore();

    // Recovery: unblock Globex, invalidate the empty snapshot, and refresh.
    // If the mcpClients cache still held the first-pass Acme MCPClient, it
    // would be reused with no fresh `initialize`. The cleanup evicts +
    // disconnects Acme's client, so both connections re-initialize on the
    // retry. (`.invalidate()` clears only the snapshot cache, not the
    // MCPClient cache we are exercising here.)
    failing.clear();
    tools.invalidate();
    const discovered = (await tools()) as Record<string, unknown>;
    expect(discovered).toHaveProperty('catalog-mcp_update_record');
    expect(gateway.getInitializeCountForConnection(acmeId)).toBeGreaterThan(acmeInitsAfterFailure);
    expect(gateway.getInitializeCountForConnection(globexId)).toBeGreaterThanOrEqual(1);
  });
});
