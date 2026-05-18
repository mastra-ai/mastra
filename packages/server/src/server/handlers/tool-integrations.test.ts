import type { IMastraEditor } from '@mastra/core/editor';
import { MASTRA_RESOURCE_ID_KEY, RequestContext } from '@mastra/core/request-context';
import { UnknownIntegrationError } from '@mastra/core/tool-integration';
import type { ToolIntegration } from '@mastra/core/tool-integration';
import { describe, it, expect, vi } from 'vitest';

import { MASTRA_USER_KEY, MASTRA_USER_PERMISSIONS_KEY } from '../constants';
import { HTTPException } from '../http-exception';
import {
  AUTHORIZE_TOOL_INTEGRATION_ROUTE,
  GET_TOOL_INTEGRATION_AUTH_STATUS_ROUTE,
  GET_TOOL_INTEGRATION_HEALTH_ROUTE,
  LIST_TOOL_INTEGRATION_CONNECTION_FIELDS_ROUTE,
  LIST_TOOL_INTEGRATION_CONNECTIONS_ROUTE,
  LIST_TOOL_INTEGRATION_TOOLS_ROUTE,
  LIST_TOOL_INTEGRATIONS_ROUTE,
  LIST_TOOL_SERVICES_ROUTE,
  DISCONNECT_TOOL_INTEGRATION_CONNECTION_ROUTE,
  GET_TOOL_INTEGRATION_CONNECTION_USAGE_ROUTE,
  TOOL_INTEGRATION_CONNECTION_STATUS_ROUTE,
} from './tool-integrations';

function makeMastra(editor?: Partial<IMastraEditor> | undefined) {
  return {
    getEditor: () => editor,
  } as any;
}

function makeToolConnectionsStore(
  initialRows: Array<{
    authorId: string;
    providerId: string;
    toolService: string;
    connectionId: string;
    label?: string | null;
  }> = [],
) {
  const rows = new Map<
    string,
    { authorId: string; providerId: string; toolService: string; connectionId: string; label: string | null }
  >();
  for (const r of initialRows) {
    const key = `${r.authorId}::${r.providerId}::${r.connectionId}`;
    rows.set(key, { ...r, label: r.label ?? null });
  }
  return {
    rows,
    upsert: vi.fn(
      async (row: {
        authorId: string;
        providerId: string;
        toolService: string;
        connectionId: string;
        label: string | null;
      }) => {
        const key = `${row.authorId}::${row.providerId}::${row.connectionId}`;
        rows.set(key, { ...row });
        return rows.get(key)!;
      },
    ),
    list: vi.fn(
      async ({
        authorId,
        providerId,
        toolService,
      }: {
        authorId?: string;
        providerId?: string;
        toolService?: string;
      }) => {
        return Array.from(rows.values()).filter(
          r =>
            (authorId ? r.authorId === authorId : true) &&
            (providerId ? r.providerId === providerId : true) &&
            (toolService ? r.toolService === toolService : true),
        );
      },
    ),
    get: vi.fn(
      async ({
        authorId,
        providerId,
        connectionId,
      }: {
        authorId: string;
        providerId: string;
        connectionId: string;
      }) => {
        const key = `${authorId}::${providerId}::${connectionId}`;
        return rows.get(key) ?? null;
      },
    ),
    delete: vi.fn(
      async ({
        authorId,
        providerId,
        connectionId,
      }: {
        authorId: string;
        providerId: string;
        connectionId: string;
      }) => {
        const key = `${authorId}::${providerId}::${connectionId}`;
        rows.delete(key);
      },
    ),
  };
}

function makeAgentsStore(
  agents: Array<{
    id: string;
    name?: string;
    toolIntegrations?: Record<string, { connections?: Record<string, Array<{ connectionId: string }>> }>;
  }>,
) {
  return {
    listResolved: vi.fn(async () => ({ agents, total: agents.length, hasMore: false, page: 0, perPage: 100 })),
  };
}

function makeMastraWithStorageAndAgents(
  editor: Partial<IMastraEditor> | undefined,
  toolConnections: ReturnType<typeof makeToolConnectionsStore> | undefined,
  agentsStore?: ReturnType<typeof makeAgentsStore>,
) {
  return {
    getEditor: () => editor,
    getStorage: () => ({
      getStore: async (name: string) => {
        if (name === 'toolConnections') return toolConnections;
        if (name === 'agents') return agentsStore;
        return undefined;
      },
    }),
    getLogger: () => ({ warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() }),
  } as any;
}

function makeMastraWithStorage(
  editor: Partial<IMastraEditor> | undefined,
  toolConnections: ReturnType<typeof makeToolConnectionsStore> | undefined,
) {
  return {
    getEditor: () => editor,
    getStorage: () => ({
      getStore: async (name: string) => (name === 'toolConnections' ? toolConnections : undefined),
    }),
    getLogger: () => ({ warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() }),
  } as any;
}

function makeIntegration(overrides: Partial<ToolIntegration> = {}): ToolIntegration {
  return {
    id: 'composio',
    displayName: 'Composio',
    capabilities: {
      multipleConnectionsPerService: true,
      batchConnectionStatus: true,
      reauthorizeReusesConnectionId: true,
    },
    listToolServices: vi.fn().mockResolvedValue({ data: [] }),
    listTools: vi.fn().mockResolvedValue({ data: [], pagination: { page: 1, hasMore: false } }),
    listConnections: vi.fn().mockResolvedValue({ items: [] }),
    listConnectionFields: vi.fn().mockResolvedValue([]),
    resolveTools: vi.fn(),
    authorize: vi.fn(),
    getAuthStatus: vi.fn(),
    getConnectionStatus: vi.fn(),
    getHealth: vi.fn().mockResolvedValue({ ok: true }),
    ...overrides,
  } as ToolIntegration;
}

function makeEditor(integration?: ToolIntegration): Partial<IMastraEditor> {
  return {
    getToolIntegrations: () => (integration ? [integration] : []),
    getToolIntegrationOrThrow: (id: string) => {
      if (integration && integration.id === id) return integration;
      throw new UnknownIntegrationError(id, integration ? [integration.id] : []);
    },
  };
}

describe('LIST_TOOL_INTEGRATIONS_ROUTE', () => {
  it('returns 500 when editor is not configured', async () => {
    const mastra = makeMastra(undefined);
    await expect(LIST_TOOL_INTEGRATIONS_ROUTE.handler({ mastra } as any)).rejects.toThrow(HTTPException);
  });

  it('returns registered integrations with capabilities', async () => {
    const integration = makeIntegration();
    const editor = makeEditor(integration);
    const result = await LIST_TOOL_INTEGRATIONS_ROUTE.handler({ mastra: makeMastra(editor) } as any);
    expect(result).toEqual({
      integrations: [
        {
          id: 'composio',
          displayName: 'Composio',
          capabilities: integration.capabilities,
        },
      ],
    });
  });
});

describe('LIST_TOOL_SERVICES_ROUTE', () => {
  it('returns 404 for unknown integration id', async () => {
    const editor = makeEditor();
    await expect(
      LIST_TOOL_SERVICES_ROUTE.handler({ mastra: makeMastra(editor), integrationId: 'missing' } as any),
    ).rejects.toThrow(HTTPException);
  });

  it('returns tool services for the integration', async () => {
    const integration = makeIntegration({
      listToolServices: vi.fn().mockResolvedValue({ data: [{ slug: 'gmail', name: 'Gmail' }] }),
    });
    const editor = makeEditor(integration);
    const result = await LIST_TOOL_SERVICES_ROUTE.handler({
      mastra: makeMastra(editor),
      integrationId: 'composio',
    } as any);
    expect(result).toEqual({ data: [{ slug: 'gmail', name: 'Gmail' }] });
  });
});

describe('LIST_TOOL_INTEGRATION_TOOLS_ROUTE', () => {
  it('passes filtering options through to listTools', async () => {
    const listTools = vi.fn().mockResolvedValue({
      data: [{ slug: 'gmail.fetch', name: 'Fetch', toolService: 'gmail' }],
      pagination: { page: 2, perPage: 10, hasMore: true },
    });
    const integration = makeIntegration({ listTools });
    const editor = makeEditor(integration);
    const result = await LIST_TOOL_INTEGRATION_TOOLS_ROUTE.handler({
      mastra: makeMastra(editor),
      integrationId: 'composio',
      toolService: 'gmail',
      search: 'fetch',
      page: 2,
      perPage: 10,
    } as any);
    expect(listTools).toHaveBeenCalledWith({ toolService: 'gmail', search: 'fetch', page: 2, perPage: 10 });
    expect(result.pagination.hasMore).toBe(true);
  });

  it('calls listTools with undefined when no filters provided', async () => {
    const listTools = vi.fn().mockResolvedValue({ data: [], pagination: { page: 1, hasMore: false } });
    const integration = makeIntegration({ listTools });
    const editor = makeEditor(integration);
    await LIST_TOOL_INTEGRATION_TOOLS_ROUTE.handler({
      mastra: makeMastra(editor),
      integrationId: 'composio',
    } as any);
    expect(listTools).toHaveBeenCalledWith(undefined);
  });
});

describe('AUTHORIZE_TOOL_INTEGRATION_ROUTE', () => {
  it('forwards body params to authorize and returns url + authId', async () => {
    const authorize = vi.fn().mockResolvedValue({ url: 'https://oauth/redirect', authId: 'auth-123' });
    const integration = makeIntegration({ authorize });
    const editor = makeEditor(integration);
    const result = await AUTHORIZE_TOOL_INTEGRATION_ROUTE.handler({
      mastra: makeMastra(editor),
      integrationId: 'composio',
      toolService: 'gmail',
      connectionId: 'conn-1',
      toolName: 'gmail.fetch',
    } as any);
    expect(authorize).toHaveBeenCalledWith({
      toolService: 'gmail',
      connectionId: 'conn-1',
      toolName: 'gmail.fetch',
    });
    expect(result).toEqual({ url: 'https://oauth/redirect', authId: 'auth-123' });
  });

  it('falls back to the caller owner id when connectionId is empty (fresh connect)', async () => {
    const authorize = vi.fn().mockResolvedValue({ url: 'https://oauth/redirect', authId: 'auth-123' });
    const integration = makeIntegration({ authorize });
    const editor = makeEditor(integration);
    const requestContext = new RequestContext();
    requestContext.set(MASTRA_RESOURCE_ID_KEY, 'user-abc');
    await AUTHORIZE_TOOL_INTEGRATION_ROUTE.handler({
      mastra: makeMastra(editor),
      integrationId: 'composio',
      toolService: 'gmail',
      connectionId: '',
      requestContext,
    } as any);
    expect(authorize).toHaveBeenCalledWith({
      toolService: 'gmail',
      connectionId: 'user-abc',
      toolName: undefined,
    });
  });

  it('upserts a tool_connections row with the supplied label on fresh connect', async () => {
    const authorize = vi.fn().mockResolvedValue({ url: 'https://oauth/redirect', authId: 'ca_new' });
    const integration = makeIntegration({ authorize });
    const editor = makeEditor(integration);
    const store = makeToolConnectionsStore();
    const requestContext = new RequestContext();
    requestContext.set(MASTRA_RESOURCE_ID_KEY, 'user_42');

    await AUTHORIZE_TOOL_INTEGRATION_ROUTE.handler({
      mastra: makeMastraWithStorage(editor, store),
      integrationId: 'composio',
      toolService: 'gmail',
      connectionId: '',
      label: 'Personal',
      requestContext,
    } as any);

    expect(store.upsert).toHaveBeenCalledWith({
      authorId: 'user_42',
      providerId: 'composio',
      toolService: 'gmail',
      connectionId: 'ca_new',
      label: 'Personal',
    });
  });

  it('upserts a tool_connections row with null label when label is omitted', async () => {
    const authorize = vi.fn().mockResolvedValue({ url: 'https://oauth/redirect', authId: 'ca_new' });
    const integration = makeIntegration({ authorize });
    const editor = makeEditor(integration);
    const store = makeToolConnectionsStore();

    await AUTHORIZE_TOOL_INTEGRATION_ROUTE.handler({
      mastra: makeMastraWithStorage(editor, store),
      integrationId: 'composio',
      toolService: 'gmail',
      connectionId: '',
    } as any);

    expect(store.upsert).toHaveBeenCalledWith({
      authorId: 'default',
      providerId: 'composio',
      toolService: 'gmail',
      connectionId: 'ca_new',
      label: null,
    });
  });

  it('forwards optional config to authorize when supplied', async () => {
    const authorize = vi.fn().mockResolvedValue({ url: 'https://oauth/redirect', authId: 'auth-123' });
    const integration = makeIntegration({ authorize });
    const editor = makeEditor(integration);
    await AUTHORIZE_TOOL_INTEGRATION_ROUTE.handler({
      mastra: makeMastra(editor),
      integrationId: 'composio',
      toolService: 'confluence',
      connectionId: 'conn-1',
      config: { subdomain: 'acme' },
    } as any);
    expect(authorize).toHaveBeenCalledWith({
      toolService: 'confluence',
      connectionId: 'conn-1',
      toolName: undefined,
      config: { subdomain: 'acme' },
    });
  });

  it('falls back to user.id when resource id is missing (Workos-style auth)', async () => {
    const authorize = vi.fn().mockResolvedValue({ url: 'https://oauth/redirect', authId: 'auth-123' });
    const integration = makeIntegration({ authorize });
    const editor = makeEditor(integration);
    const requestContext = new RequestContext();
    requestContext.set(MASTRA_USER_KEY, { id: 'user-xyz' });
    await AUTHORIZE_TOOL_INTEGRATION_ROUTE.handler({
      mastra: makeMastra(editor),
      integrationId: 'composio',
      toolService: 'gmail',
      connectionId: '',
      requestContext,
    } as any);
    expect(authorize).toHaveBeenCalledWith({
      toolService: 'gmail',
      connectionId: 'user-xyz',
      toolName: undefined,
    });
  });
});

describe('GET_TOOL_INTEGRATION_AUTH_STATUS_ROUTE', () => {
  it('returns { status } from getAuthStatus', async () => {
    const getAuthStatus = vi.fn().mockResolvedValue('completed');
    const integration = makeIntegration({ getAuthStatus });
    const editor = makeEditor(integration);
    const result = await GET_TOOL_INTEGRATION_AUTH_STATUS_ROUTE.handler({
      mastra: makeMastra(editor),
      integrationId: 'composio',
      authId: 'auth-123',
    } as any);
    expect(getAuthStatus).toHaveBeenCalledWith('auth-123');
    expect(result).toEqual({ status: 'completed' });
  });
});

describe('TOOL_INTEGRATION_CONNECTION_STATUS_ROUTE', () => {
  it('wraps getConnectionStatus result in { items }', async () => {
    const getConnectionStatus = vi.fn().mockResolvedValue({
      'conn-1': { connected: true },
      'conn-2': { connected: false },
    });
    const integration = makeIntegration({ getConnectionStatus });
    const editor = makeEditor(integration);
    const items = [
      { connectionId: 'conn-1', toolService: 'gmail' },
      { connectionId: 'conn-2', toolService: 'gmail' },
    ];
    const result = await TOOL_INTEGRATION_CONNECTION_STATUS_ROUTE.handler({
      mastra: makeMastra(editor),
      integrationId: 'composio',
      items,
    } as any);
    expect(getConnectionStatus).toHaveBeenCalledWith({ items });
    expect(result).toEqual({
      items: {
        'conn-1': { connected: true },
        'conn-2': { connected: false },
      },
    });
  });
});

describe('LIST_TOOL_INTEGRATION_CONNECTIONS_ROUTE', () => {
  it('resolves userId from RequestContext and forwards toolService via userIds[]', async () => {
    const listConnections = vi.fn().mockResolvedValue({
      items: [{ connectionId: 'ca_1', status: 'active' }],
    });
    const integration = makeIntegration({ listConnections });
    const editor = makeEditor(integration);
    const requestContext = new RequestContext();
    requestContext.set(MASTRA_RESOURCE_ID_KEY, 'user_42');

    const result = await LIST_TOOL_INTEGRATION_CONNECTIONS_ROUTE.handler({
      mastra: makeMastraWithStorage(editor, makeToolConnectionsStore()),
      integrationId: 'composio',
      toolService: 'gmail',
      requestContext,
    } as any);

    expect(listConnections).toHaveBeenCalledWith({ toolService: 'gmail', userIds: ['user_42'] });
    expect(result).toEqual({
      items: [{ connectionId: 'ca_1', status: 'active', label: null }],
    });
  });

  it('joins persisted labels from tool_connections when present', async () => {
    const listConnections = vi.fn().mockResolvedValue({
      items: [
        { connectionId: 'ca_1', status: 'active' },
        { connectionId: 'ca_2', status: 'active' },
      ],
    });
    const integration = makeIntegration({ listConnections });
    const editor = makeEditor(integration);
    const store = makeToolConnectionsStore([
      { authorId: 'user_42', providerId: 'composio', toolService: 'gmail', connectionId: 'ca_1', label: 'Work' },
    ]);
    const requestContext = new RequestContext();
    requestContext.set(MASTRA_RESOURCE_ID_KEY, 'user_42');

    const result = await LIST_TOOL_INTEGRATION_CONNECTIONS_ROUTE.handler({
      mastra: makeMastraWithStorage(editor, store),
      integrationId: 'composio',
      toolService: 'gmail',
      requestContext,
    } as any);

    expect(store.list).toHaveBeenCalledWith({
      authorId: 'user_42',
      providerId: 'composio',
      toolService: 'gmail',
    });
    expect(result).toEqual({
      items: [
        { connectionId: 'ca_1', status: 'active', label: 'Work' },
        { connectionId: 'ca_2', status: 'active', label: null },
      ],
    });
  });

  it("falls back to 'default' when no auth context is present", async () => {
    const listConnections = vi.fn().mockResolvedValue({ items: [] });
    const integration = makeIntegration({ listConnections });
    const editor = makeEditor(integration);

    await LIST_TOOL_INTEGRATION_CONNECTIONS_ROUTE.handler({
      mastra: makeMastraWithStorage(editor, makeToolConnectionsStore()),
      integrationId: 'composio',
      toolService: 'gmail',
      requestContext: undefined,
    } as any);

    expect(listConnections).toHaveBeenCalledWith({ toolService: 'gmail', userIds: ['default'] });
  });

  it('non-admin: authorId query param is silently ignored', async () => {
    const listConnections = vi.fn().mockResolvedValue({ items: [] });
    const integration = makeIntegration({ listConnections });
    const editor = makeEditor(integration);
    const requestContext = new RequestContext();
    requestContext.set(MASTRA_RESOURCE_ID_KEY, 'user_caller');

    await LIST_TOOL_INTEGRATION_CONNECTIONS_ROUTE.handler({
      mastra: makeMastraWithStorage(editor, makeToolConnectionsStore()),
      integrationId: 'composio',
      toolService: 'gmail',
      authorId: 'user_someone_else',
      requestContext,
    } as any);

    expect(listConnections).toHaveBeenCalledWith({ toolService: 'gmail', userIds: ['user_caller'] });
  });

  it('admin + no authorId param: seeds userIds[] from tool_connections across all authors', async () => {
    const listConnections = vi.fn().mockResolvedValue({
      items: [
        { connectionId: 'ca_a', status: 'active', authorId: 'user_a' },
        { connectionId: 'ca_b', status: 'active', authorId: 'user_b' },
      ],
    });
    const integration = makeIntegration({ listConnections });
    const editor = makeEditor(integration);
    const store = makeToolConnectionsStore([
      { authorId: 'user_a', providerId: 'composio', toolService: 'gmail', connectionId: 'ca_a', label: 'A' },
      { authorId: 'user_b', providerId: 'composio', toolService: 'gmail', connectionId: 'ca_b', label: 'B' },
    ]);
    const requestContext = new RequestContext();
    requestContext.set(MASTRA_RESOURCE_ID_KEY, 'admin_1');
    requestContext.set(MASTRA_USER_PERMISSIONS_KEY, ['tool-integrations:admin']);

    const result = await LIST_TOOL_INTEGRATION_CONNECTIONS_ROUTE.handler({
      mastra: makeMastraWithStorage(editor, store),
      integrationId: 'composio',
      toolService: 'gmail',
      requestContext,
    } as any);

    expect(listConnections).toHaveBeenCalledTimes(1);
    const call = listConnections.mock.calls[0][0];
    expect(call.toolService).toBe('gmail');
    expect(new Set(call.userIds)).toEqual(new Set(['user_a', 'user_b']));
    expect(result.items).toEqual([
      { connectionId: 'ca_a', status: 'active', authorId: 'user_a', label: 'A' },
      { connectionId: 'ca_b', status: 'active', authorId: 'user_b', label: 'B' },
    ]);
  });

  it('admin + authorId=X: scopes to only that author', async () => {
    const listConnections = vi.fn().mockResolvedValue({
      items: [{ connectionId: 'ca_a', status: 'active', authorId: 'user_a' }],
    });
    const integration = makeIntegration({ listConnections });
    const editor = makeEditor(integration);
    const store = makeToolConnectionsStore([
      { authorId: 'user_a', providerId: 'composio', toolService: 'gmail', connectionId: 'ca_a', label: 'A' },
      { authorId: 'user_b', providerId: 'composio', toolService: 'gmail', connectionId: 'ca_b', label: 'B' },
    ]);
    const requestContext = new RequestContext();
    requestContext.set(MASTRA_RESOURCE_ID_KEY, 'admin_1');
    requestContext.set(MASTRA_USER_PERMISSIONS_KEY, ['tool-integrations:admin']);

    await LIST_TOOL_INTEGRATION_CONNECTIONS_ROUTE.handler({
      mastra: makeMastraWithStorage(editor, store),
      integrationId: 'composio',
      toolService: 'gmail',
      authorId: 'user_a',
      requestContext,
    } as any);

    expect(listConnections).toHaveBeenCalledWith({ toolService: 'gmail', userIds: ['user_a'] });
  });

  it('admin + empty tool_connections: skips adapter call and returns empty', async () => {
    const listConnections = vi.fn().mockResolvedValue({ items: [] });
    const integration = makeIntegration({ listConnections });
    const editor = makeEditor(integration);
    const requestContext = new RequestContext();
    requestContext.set(MASTRA_RESOURCE_ID_KEY, 'admin_1');
    requestContext.set(MASTRA_USER_PERMISSIONS_KEY, ['tool-integrations:admin']);

    const result = await LIST_TOOL_INTEGRATION_CONNECTIONS_ROUTE.handler({
      mastra: makeMastraWithStorage(editor, makeToolConnectionsStore()),
      integrationId: 'composio',
      toolService: 'gmail',
      requestContext,
    } as any);

    expect(listConnections).not.toHaveBeenCalled();
    expect(result).toEqual({ items: [] });
  });

  it('forwards cursor + limit and returns nextCursor from adapter', async () => {
    const listConnections = vi.fn().mockResolvedValue({
      items: [{ connectionId: 'ca_1', status: 'active' }],
      nextCursor: 'page_2',
    });
    const integration = makeIntegration({ listConnections });
    const editor = makeEditor(integration);
    const requestContext = new RequestContext();
    requestContext.set(MASTRA_RESOURCE_ID_KEY, 'user_42');

    const result = await LIST_TOOL_INTEGRATION_CONNECTIONS_ROUTE.handler({
      mastra: makeMastraWithStorage(editor, makeToolConnectionsStore()),
      integrationId: 'composio',
      toolService: 'gmail',
      cursor: 'page_1',
      limit: 25,
      requestContext,
    } as any);

    expect(listConnections).toHaveBeenCalledWith({
      toolService: 'gmail',
      userIds: ['user_42'],
      cursor: 'page_1',
      limit: 25,
    });
    expect(result.nextCursor).toBe('page_2');
  });

  it('returns 404 for unknown integration id', async () => {
    const editor = makeEditor();
    await expect(
      LIST_TOOL_INTEGRATION_CONNECTIONS_ROUTE.handler({
        mastra: makeMastra(editor),
        integrationId: 'missing',
        toolService: 'gmail',
        requestContext: undefined,
      } as any),
    ).rejects.toThrow(HTTPException);
  });
});

describe('LIST_TOOL_INTEGRATION_CONNECTION_FIELDS_ROUTE', () => {
  it('forwards toolService to listConnectionFields and wraps result in { fields }', async () => {
    const listConnectionFields = vi
      .fn()
      .mockResolvedValue([{ name: 'subdomain', displayName: 'Subdomain', type: 'string', required: true }]);
    const integration = makeIntegration({ listConnectionFields });
    const editor = makeEditor(integration);
    const result = await LIST_TOOL_INTEGRATION_CONNECTION_FIELDS_ROUTE.handler({
      mastra: makeMastra(editor),
      integrationId: 'composio',
      toolService: 'confluence',
    } as any);
    expect(listConnectionFields).toHaveBeenCalledWith({ toolService: 'confluence' });
    expect(result).toEqual({
      fields: [{ name: 'subdomain', displayName: 'Subdomain', type: 'string', required: true }],
    });
  });

  it('returns 404 for unknown integration id', async () => {
    const editor = makeEditor();
    await expect(
      LIST_TOOL_INTEGRATION_CONNECTION_FIELDS_ROUTE.handler({
        mastra: makeMastra(editor),
        integrationId: 'missing',
        toolService: 'gmail',
      } as any),
    ).rejects.toThrow(HTTPException);
  });
});

describe('DISCONNECT_TOOL_INTEGRATION_CONNECTION_ROUTE', () => {
  it('rejects without force when an agent still pins the connection', async () => {
    const revokeConnection = vi.fn();
    const integration = makeIntegration({
      capabilities: {
        multipleConnectionsPerService: true,
        batchConnectionStatus: true,
        reauthorizeReusesConnectionId: true,
        supportsRevoke: true,
      },
      revokeConnection,
    });
    const editor = makeEditor(integration);
    const toolConnections = makeToolConnectionsStore([
      { authorId: 'user-1', providerId: 'composio', toolService: 'gmail', connectionId: 'ca_1' },
    ]);
    const agents = makeAgentsStore([
      {
        id: 'a1',
        name: 'Agent One',
        toolIntegrations: {
          composio: { connections: { gmail: [{ connectionId: 'ca_1' }] } },
        },
      },
    ]);
    const ctx = new RequestContext();
    ctx.set(MASTRA_RESOURCE_ID_KEY, 'user-1');

    await expect(
      DISCONNECT_TOOL_INTEGRATION_CONNECTION_ROUTE.handler({
        mastra: makeMastraWithStorageAndAgents(editor, toolConnections, agents),
        integrationId: 'composio',
        connectionId: 'ca_1',
        requestContext: ctx,
      } as any),
    ).rejects.toThrow(HTTPException);

    expect(revokeConnection).not.toHaveBeenCalled();
    expect(toolConnections.rows.size).toBe(1);
  });

  it('with force=true revokes at the provider and drops the row', async () => {
    const revokeConnection = vi.fn().mockResolvedValue(undefined);
    const integration = makeIntegration({
      capabilities: {
        multipleConnectionsPerService: true,
        batchConnectionStatus: true,
        reauthorizeReusesConnectionId: true,
        supportsRevoke: true,
      },
      revokeConnection,
    });
    const editor = makeEditor(integration);
    const toolConnections = makeToolConnectionsStore([
      { authorId: 'user-1', providerId: 'composio', toolService: 'gmail', connectionId: 'ca_1' },
    ]);
    const agents = makeAgentsStore([
      {
        id: 'a1',
        name: 'Agent One',
        toolIntegrations: {
          composio: { connections: { gmail: [{ connectionId: 'ca_1' }] } },
        },
      },
    ]);
    const ctx = new RequestContext();
    ctx.set(MASTRA_RESOURCE_ID_KEY, 'user-1');

    const result = await DISCONNECT_TOOL_INTEGRATION_CONNECTION_ROUTE.handler({
      mastra: makeMastraWithStorageAndAgents(editor, toolConnections, agents),
      integrationId: 'composio',
      connectionId: 'ca_1',
      force: true,
      requestContext: ctx,
    } as any);

    expect(result).toEqual({ ok: true, revoked: true });
    expect(revokeConnection).toHaveBeenCalledWith('ca_1');
    expect(toolConnections.rows.size).toBe(0);
  });

  it('reports revoked=false when adapter does not support revoke', async () => {
    const integration = makeIntegration({
      capabilities: {
        multipleConnectionsPerService: true,
        batchConnectionStatus: true,
        reauthorizeReusesConnectionId: true,
      },
    });
    const editor = makeEditor(integration);
    const toolConnections = makeToolConnectionsStore([
      { authorId: 'user-1', providerId: 'composio', toolService: 'gmail', connectionId: 'ca_1' },
    ]);
    const agents = makeAgentsStore([]);
    const ctx = new RequestContext();
    ctx.set(MASTRA_RESOURCE_ID_KEY, 'user-1');

    const result = await DISCONNECT_TOOL_INTEGRATION_CONNECTION_ROUTE.handler({
      mastra: makeMastraWithStorageAndAgents(editor, toolConnections, agents),
      integrationId: 'composio',
      connectionId: 'ca_1',
      requestContext: ctx,
    } as any);

    expect(result).toEqual({ ok: true, revoked: false });
    expect(toolConnections.rows.size).toBe(0);
  });

  it('surfaces revoke errors and preserves the local row so the user can retry', async () => {
    const revokeConnection = vi.fn().mockRejectedValue(new Error('upstream 500'));
    const integration = makeIntegration({
      capabilities: {
        multipleConnectionsPerService: true,
        batchConnectionStatus: true,
        reauthorizeReusesConnectionId: true,
        supportsRevoke: true,
      },
      revokeConnection,
    });
    const editor = makeEditor(integration);
    const toolConnections = makeToolConnectionsStore([
      { authorId: 'user-1', providerId: 'composio', toolService: 'gmail', connectionId: 'ca_1' },
    ]);
    const agents = makeAgentsStore([]);
    const ctx = new RequestContext();
    ctx.set(MASTRA_RESOURCE_ID_KEY, 'user-1');

    await expect(
      DISCONNECT_TOOL_INTEGRATION_CONNECTION_ROUTE.handler({
        mastra: makeMastraWithStorageAndAgents(editor, toolConnections, agents),
        integrationId: 'composio',
        connectionId: 'ca_1',
        force: true,
        requestContext: ctx,
      } as any),
    ).rejects.toThrow('upstream 500');

    expect(revokeConnection).toHaveBeenCalledWith('ca_1');
    // Local row must remain so the caller can retry without losing the pin.
    expect(toolConnections.rows.size).toBe(1);
  });

  it('non-admin: 403 when disconnecting another author’s connection', async () => {
    const revokeConnection = vi.fn();
    const integration = makeIntegration({
      capabilities: {
        multipleConnectionsPerService: true,
        batchConnectionStatus: true,
        reauthorizeReusesConnectionId: true,
        supportsRevoke: true,
      },
      revokeConnection,
    });
    const editor = makeEditor(integration);
    const toolConnections = makeToolConnectionsStore([
      { authorId: 'user-owner', providerId: 'composio', toolService: 'gmail', connectionId: 'ca_1' },
    ]);
    const agents = makeAgentsStore([]);
    const ctx = new RequestContext();
    ctx.set(MASTRA_RESOURCE_ID_KEY, 'user-other');

    await expect(
      DISCONNECT_TOOL_INTEGRATION_CONNECTION_ROUTE.handler({
        mastra: makeMastraWithStorageAndAgents(editor, toolConnections, agents),
        integrationId: 'composio',
        connectionId: 'ca_1',
        force: true,
        requestContext: ctx,
      } as any),
    ).rejects.toThrow(HTTPException);

    expect(revokeConnection).not.toHaveBeenCalled();
    expect(toolConnections.rows.size).toBe(1);
  });

  it('admin: can disconnect another author’s connection', async () => {
    const revokeConnection = vi.fn().mockResolvedValue(undefined);
    const integration = makeIntegration({
      capabilities: {
        multipleConnectionsPerService: true,
        batchConnectionStatus: true,
        reauthorizeReusesConnectionId: true,
        supportsRevoke: true,
      },
      revokeConnection,
    });
    const editor = makeEditor(integration);
    const toolConnections = makeToolConnectionsStore([
      { authorId: 'user-owner', providerId: 'composio', toolService: 'gmail', connectionId: 'ca_1' },
    ]);
    const agents = makeAgentsStore([]);
    const ctx = new RequestContext();
    ctx.set(MASTRA_RESOURCE_ID_KEY, 'admin_1');
    ctx.set(MASTRA_USER_PERMISSIONS_KEY, ['tool-integrations:admin']);

    const result = await DISCONNECT_TOOL_INTEGRATION_CONNECTION_ROUTE.handler({
      mastra: makeMastraWithStorageAndAgents(editor, toolConnections, agents),
      integrationId: 'composio',
      connectionId: 'ca_1',
      force: true,
      requestContext: ctx,
    } as any);

    expect(result).toEqual({ ok: true, revoked: true });
    expect(revokeConnection).toHaveBeenCalledWith('ca_1');
    expect(toolConnections.rows.size).toBe(0);
  });
});

describe('GET_TOOL_INTEGRATION_CONNECTION_USAGE_ROUTE', () => {
  it('returns the agents that pin the connection', async () => {
    const integration = makeIntegration();
    const editor = makeEditor(integration);
    const agents = makeAgentsStore([
      {
        id: 'a1',
        name: 'Agent One',
        toolIntegrations: { composio: { connections: { gmail: [{ connectionId: 'ca_1' }] } } },
      },
      {
        id: 'a2',
        name: 'Agent Two',
        toolIntegrations: { composio: { connections: { gmail: [{ connectionId: 'ca_2' }] } } },
      },
      {
        id: 'a3',
        name: 'Agent Three',
        toolIntegrations: { composio: { connections: { gmail: [{ connectionId: 'ca_1' }] } } },
      },
    ]);

    const result = await GET_TOOL_INTEGRATION_CONNECTION_USAGE_ROUTE.handler({
      mastra: makeMastraWithStorageAndAgents(editor, undefined, agents),
      integrationId: 'composio',
      connectionId: 'ca_1',
      requestContext: undefined,
    } as any);

    expect(result.agents).toEqual([
      { id: 'a1', name: 'Agent One' },
      { id: 'a3', name: 'Agent Three' },
    ]);
  });

  it('returns an empty list when no agents pin the connection', async () => {
    const integration = makeIntegration();
    const editor = makeEditor(integration);
    const agents = makeAgentsStore([
      {
        id: 'a1',
        name: 'Agent One',
        toolIntegrations: { composio: { connections: { gmail: [{ connectionId: 'ca_other' }] } } },
      },
    ]);

    const result = await GET_TOOL_INTEGRATION_CONNECTION_USAGE_ROUTE.handler({
      mastra: makeMastraWithStorageAndAgents(editor, undefined, agents),
      integrationId: 'composio',
      connectionId: 'ca_missing',
      requestContext: undefined,
    } as any);

    expect(result.agents).toEqual([]);
  });

  it('returns 404 for unknown integration id', async () => {
    const editor = makeEditor();
    await expect(
      GET_TOOL_INTEGRATION_CONNECTION_USAGE_ROUTE.handler({
        mastra: makeMastraWithStorageAndAgents(editor, undefined, makeAgentsStore([])),
        integrationId: 'missing',
        connectionId: 'ca_1',
        requestContext: undefined,
      } as any),
    ).rejects.toThrow(HTTPException);
  });

  it('non-admin: 403 reading usage for another author’s connection', async () => {
    const integration = makeIntegration();
    const editor = makeEditor(integration);
    const toolConnections = makeToolConnectionsStore([
      { authorId: 'user-owner', providerId: 'composio', toolService: 'gmail', connectionId: 'ca_1' },
    ]);
    const agents = makeAgentsStore([]);
    const ctx = new RequestContext();
    ctx.set(MASTRA_RESOURCE_ID_KEY, 'user-other');

    await expect(
      GET_TOOL_INTEGRATION_CONNECTION_USAGE_ROUTE.handler({
        mastra: makeMastraWithStorageAndAgents(editor, toolConnections, agents),
        integrationId: 'composio',
        connectionId: 'ca_1',
        requestContext: ctx,
      } as any),
    ).rejects.toThrow(HTTPException);
  });

  it('admin: can read usage for another author’s connection', async () => {
    const integration = makeIntegration();
    const editor = makeEditor(integration);
    const toolConnections = makeToolConnectionsStore([
      { authorId: 'user-owner', providerId: 'composio', toolService: 'gmail', connectionId: 'ca_1' },
    ]);
    const agents = makeAgentsStore([
      {
        id: 'a1',
        name: 'Agent One',
        toolIntegrations: { composio: { connections: { gmail: [{ connectionId: 'ca_1' }] } } },
      },
    ]);
    const ctx = new RequestContext();
    ctx.set(MASTRA_RESOURCE_ID_KEY, 'admin_1');
    ctx.set(MASTRA_USER_PERMISSIONS_KEY, ['tool-integrations:admin']);

    const result = await GET_TOOL_INTEGRATION_CONNECTION_USAGE_ROUTE.handler({
      mastra: makeMastraWithStorageAndAgents(editor, toolConnections, agents),
      integrationId: 'composio',
      connectionId: 'ca_1',
      requestContext: ctx,
    } as any);

    expect(result.agents).toEqual([{ id: 'a1', name: 'Agent One' }]);
  });
});

describe('GET_TOOL_INTEGRATION_HEALTH_ROUTE', () => {
  it('returns the integration health payload', async () => {
    const integration = makeIntegration({
      getHealth: vi.fn().mockResolvedValue({ ok: false, message: 'no api key' }),
    });
    const editor = makeEditor(integration);
    const result = await GET_TOOL_INTEGRATION_HEALTH_ROUTE.handler({
      mastra: makeMastra(editor),
      integrationId: 'composio',
    } as any);
    expect(result).toEqual({ ok: false, message: 'no api key' });
  });
});
