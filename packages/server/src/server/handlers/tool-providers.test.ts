import type { IMastraEditor } from '@mastra/core/editor';
import { MASTRA_RESOURCE_ID_KEY, RequestContext } from '@mastra/core/request-context';
import { UnknownToolProviderError } from '@mastra/core/tool-provider';
import type { ToolProvider } from '@mastra/core/tool-provider';
import { describe, it, expect, vi } from 'vitest';

import { MASTRA_USER_KEY, MASTRA_USER_PERMISSIONS_KEY } from '../constants';
import { HTTPException } from '../http-exception';
import {
  AUTHORIZE_TOOL_PROVIDER_ROUTE,
  GET_TOOL_PROVIDER_AUTH_STATUS_ROUTE,
  GET_TOOL_PROVIDER_HEALTH_ROUTE,
  LIST_TOOL_PROVIDER_CONNECTION_FIELDS_ROUTE,
  LIST_TOOL_PROVIDER_CONNECTIONS_ROUTE,
  LIST_TOOL_PROVIDER_TOOLS_ROUTE,
  LIST_TOOL_PROVIDERS_ROUTE,
  LIST_TOOL_PROVIDER_TOOLKITS_ROUTE,
  DISCONNECT_TOOL_PROVIDER_CONNECTION_ROUTE,
  GET_TOOL_PROVIDER_CONNECTION_USAGE_ROUTE,
  TOOL_PROVIDER_CONNECTION_STATUS_ROUTE,
  UPDATE_TOOL_PROVIDER_CONNECTION_ROUTE,
} from './tool-providers';

function makeMastra(editor?: Partial<IMastraEditor> | undefined) {
  return {
    getEditor: () => editor,
    getLogger: () => ({ warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() }),
  } as any;
}

function makeToolProviderConnectionsStore(
  initialRows: Array<{
    authorId: string;
    providerId: string;
    toolkit: string;
    connectionId: string;
    label?: string | null;
    scope?: 'shared' | 'per-author' | 'caller-supplied';
  }> = [],
) {
  const rows = new Map<
    string,
    {
      authorId: string;
      providerId: string;
      toolkit: string;
      connectionId: string;
      label: string | null;
      scope: 'shared' | 'per-author' | 'caller-supplied';
    }
  >();
  for (const r of initialRows) {
    const key = `${r.authorId}::${r.providerId}::${r.connectionId}`;
    rows.set(key, { ...r, label: r.label ?? null, scope: r.scope ?? 'per-author' });
  }
  return {
    rows,
    upsertConnection: vi.fn(
      async (row: {
        authorId: string;
        providerId: string;
        toolkit: string;
        connectionId: string;
        label: string | null;
        scope?: 'shared' | 'per-author' | 'caller-supplied';
      }) => {
        const key = `${row.authorId}::${row.providerId}::${row.connectionId}`;
        rows.set(key, { ...row, scope: row.scope ?? 'per-author' });
        return rows.get(key)!;
      },
    ),
    listConnectionsByAuthor: vi.fn(
      async ({
        authorId,
        providerId,
        toolkit,
        scope,
      }: {
        authorId?: string;
        providerId?: string;
        toolkit?: string;
        scope?: 'shared' | 'per-author' | 'caller-supplied';
      }) => {
        return Array.from(rows.values()).filter(
          r =>
            (authorId ? r.authorId === authorId : true) &&
            (providerId ? r.providerId === providerId : true) &&
            (toolkit ? r.toolkit === toolkit : true) &&
            (scope ? r.scope === scope : true),
        );
      },
    ),
    getConnectionById: vi.fn(
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
    deleteConnection: vi.fn(
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
    toolProviders?: Record<string, { connections?: Record<string, Array<{ connectionId: string }>> }>;
  }>,
) {
  return {
    listResolved: vi.fn(async () => ({ agents, total: agents.length, hasMore: false, page: 0, perPage: 100 })),
  };
}

function makeMastraWithStorageAndAgents(
  editor: Partial<IMastraEditor> | undefined,
  toolConnections: ReturnType<typeof makeToolProviderConnectionsStore> | undefined,
  agentsStore?: ReturnType<typeof makeAgentsStore>,
) {
  return {
    getEditor: () => editor,
    getStorage: () => ({
      getStore: async (name: string) => {
        if (name === 'toolProviderConnections') return toolConnections;
        if (name === 'agents') return agentsStore;
        return undefined;
      },
    }),
    getLogger: () => ({ warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() }),
  } as any;
}

function makeMastraWithStorage(
  editor: Partial<IMastraEditor> | undefined,
  toolConnections: ReturnType<typeof makeToolProviderConnectionsStore> | undefined,
) {
  return {
    getEditor: () => editor,
    getStorage: () => ({
      getStore: async (name: string) => (name === 'toolProviderConnections' ? toolConnections : undefined),
    }),
    getLogger: () => ({ warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() }),
  } as any;
}

function makeProvider(overrides: Partial<ToolProvider> = {}): ToolProvider {
  return {
    info: { id: 'composio', name: 'Composio' },
    displayName: 'Composio',
    capabilities: {
      multipleConnectionsPerToolkit: true,
      batchConnectionStatus: true,
      reauthorizeReusesConnectionId: true,
    },
    listToolkits: vi.fn().mockResolvedValue({ data: [] }),
    listTools: vi.fn().mockResolvedValue({ data: [], pagination: { page: 1, hasMore: false } }),
    listConnections: vi.fn().mockResolvedValue({ items: [] }),
    listConnectionFields: vi.fn().mockResolvedValue([]),
    resolveTools: vi.fn(),
    authorize: vi.fn(),
    getAuthStatus: vi.fn(),
    getConnectionStatus: vi.fn(),
    getHealth: vi.fn().mockResolvedValue({ ok: true }),
    ...overrides,
  } as ToolProvider;
}

function makeEditor(provider?: ToolProvider): Partial<IMastraEditor> {
  return {
    getToolProviders: () => (provider ? { [provider.info.id]: provider } : {}),
    getToolProvider: (id: string) => (provider && provider.info.id === id ? provider : undefined),
    getToolProviderOrThrow: (id: string) => {
      if (provider && provider.info.id === id) return provider;
      throw new UnknownToolProviderError(id, provider ? [provider.info.id] : []);
    },
  };
}

describe('lazy @mastra/core/tool-provider integration', () => {
  // Regression guards for the lazy dynamic-import strategy in the handler.
  // The handler keeps SHARED_BUCKET_ID as a local literal and resolves
  // UnknownToolProviderError via `await import(...)` to keep the @mastra/core
  // peer-dep floor at >=1.34. These tests fail loudly if either invariant
  // drifts away from core's exports.

  it('local SHARED_BUCKET_ID stays in lockstep with @mastra/core/tool-provider', async () => {
    const { SHARED_BUCKET_ID: coreShared } = await import('@mastra/core/tool-provider');
    expect(coreShared).toBe('shared');
  });

  it('resolveProvider returns 404 when editor throws UnknownToolProviderError (lazy instanceof works)', async () => {
    // This drives `LIST_TOOL_PROVIDER_TOOLKITS_ROUTE` via a mock editor whose
    // `getToolProviderOrThrow` throws a real `UnknownToolProviderError`. The
    // handler's resolveProvider awaits a dynamic import of
    // `@mastra/core/tool-provider` to evaluate `instanceof` — this proves
    // Node's ESM cache delivers the same class identity to both the editor
    // mock and the handler.
    const editor: Partial<IMastraEditor> = {
      getToolProviderOrThrow: (id: string) => {
        throw new UnknownToolProviderError(id, []);
      },
    };
    const mastra = makeMastra(editor);
    await expect(
      LIST_TOOL_PROVIDER_TOOLKITS_ROUTE.handler({ mastra, providerId: 'missing' } as any),
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe('LIST_TOOL_PROVIDERS_ROUTE', () => {
  it('returns 500 when editor is not configured', async () => {
    const mastra = makeMastra(undefined);
    await expect(LIST_TOOL_PROVIDERS_ROUTE.handler({ mastra } as any)).rejects.toThrow(HTTPException);
  });

  it('returns registered providers with capabilities', async () => {
    const provider = makeProvider();
    const editor = makeEditor(provider);
    const result = await LIST_TOOL_PROVIDERS_ROUTE.handler({ mastra: makeMastra(editor) } as any);
    expect(result).toEqual({
      providers: [
        {
          id: 'composio',
          name: 'Composio',
          displayName: 'Composio',
          capabilities: provider.capabilities,
        },
      ],
    });
  });
});

describe('LIST_TOOL_PROVIDER_TOOLKITS_ROUTE', () => {
  it('returns 404 for unknown provider id', async () => {
    const editor = makeEditor();
    await expect(
      LIST_TOOL_PROVIDER_TOOLKITS_ROUTE.handler({ mastra: makeMastra(editor), providerId: 'missing' } as any),
    ).rejects.toThrow(HTTPException);
  });

  it('returns tool services for the provider', async () => {
    const provider = makeProvider({
      listToolkits: vi.fn().mockResolvedValue({ data: [{ slug: 'gmail', name: 'Gmail' }] }),
    });
    const editor = makeEditor(provider);
    const result = await LIST_TOOL_PROVIDER_TOOLKITS_ROUTE.handler({
      mastra: makeMastra(editor),
      providerId: 'composio',
    } as any);
    expect(result).toEqual({ data: [{ slug: 'gmail', name: 'Gmail' }] });
  });
});

describe('LIST_TOOL_PROVIDER_TOOLS_ROUTE', () => {
  it('passes filtering options through to listTools', async () => {
    const listTools = vi.fn().mockResolvedValue({
      data: [{ slug: 'gmail.fetch', name: 'Fetch', toolkit: 'gmail' }],
      pagination: { page: 2, perPage: 10, hasMore: true },
    });
    const provider = makeProvider({ listTools });
    const editor = makeEditor(provider);
    const result = await LIST_TOOL_PROVIDER_TOOLS_ROUTE.handler({
      mastra: makeMastra(editor),
      providerId: 'composio',
      toolkit: 'gmail',
      search: 'fetch',
      page: 2,
      perPage: 10,
    } as any);
    expect(listTools).toHaveBeenCalledWith({ toolkit: 'gmail', search: 'fetch', page: 2, perPage: 10 });
    expect(result.pagination?.hasMore).toBe(true);
  });

  it('calls listTools with undefined when no filters provided', async () => {
    const listTools = vi.fn().mockResolvedValue({ data: [], pagination: { page: 1, hasMore: false } });
    const provider = makeProvider({ listTools });
    const editor = makeEditor(provider);
    await LIST_TOOL_PROVIDER_TOOLS_ROUTE.handler({
      mastra: makeMastra(editor),
      providerId: 'composio',
    } as any);
    expect(listTools).toHaveBeenCalledWith(undefined);
  });
});

describe('AUTHORIZE_TOOL_PROVIDER_ROUTE', () => {
  it('forwards body params to authorize and returns url + authId', async () => {
    const authorize = vi.fn().mockResolvedValue({ url: 'https://oauth/redirect', authId: 'auth-123' });
    const provider = makeProvider({ authorize });
    const editor = makeEditor(provider);
    const result = await AUTHORIZE_TOOL_PROVIDER_ROUTE.handler({
      mastra: makeMastra(editor),
      providerId: 'composio',
      toolkit: 'gmail',
      connectionId: 'conn-1',
      toolName: 'gmail.fetch',
    } as any);
    expect(authorize).toHaveBeenCalledWith({
      toolkit: 'gmail',
      connectionId: 'conn-1',
      toolName: 'gmail.fetch',
    });
    expect(result).toEqual({ url: 'https://oauth/redirect', authId: 'auth-123' });
  });

  it('falls back to the caller owner id when connectionId is empty (fresh connect)', async () => {
    const authorize = vi.fn().mockResolvedValue({ url: 'https://oauth/redirect', authId: 'auth-123' });
    const provider = makeProvider({ authorize });
    const editor = makeEditor(provider);
    const requestContext = new RequestContext();
    requestContext.set(MASTRA_RESOURCE_ID_KEY, 'user-abc');
    await AUTHORIZE_TOOL_PROVIDER_ROUTE.handler({
      mastra: makeMastra(editor),
      providerId: 'composio',
      toolkit: 'gmail',
      connectionId: '',
      requestContext,
    } as any);
    expect(authorize).toHaveBeenCalledWith({
      toolkit: 'gmail',
      connectionId: 'user-abc',
      toolName: undefined,
    });
  });

  it('upserts a tool_provider_connections row with the supplied label on fresh connect', async () => {
    const authorize = vi.fn().mockResolvedValue({ url: 'https://oauth/redirect', authId: 'ca_new' });
    const provider = makeProvider({ authorize });
    const editor = makeEditor(provider);
    const store = makeToolProviderConnectionsStore();
    const requestContext = new RequestContext();
    requestContext.set(MASTRA_RESOURCE_ID_KEY, 'user_42');

    await AUTHORIZE_TOOL_PROVIDER_ROUTE.handler({
      mastra: makeMastraWithStorage(editor, store),
      providerId: 'composio',
      toolkit: 'gmail',
      connectionId: '',
      label: 'Personal',
      requestContext,
    } as any);

    expect(store.upsertConnection).toHaveBeenCalledWith({
      authorId: 'user_42',
      providerId: 'composio',
      toolkit: 'gmail',
      connectionId: 'ca_new',
      label: 'Personal',
      scope: 'per-author',
    });
  });

  it('upserts a tool_provider_connections row with null label when label is omitted', async () => {
    const authorize = vi.fn().mockResolvedValue({ url: 'https://oauth/redirect', authId: 'ca_new' });
    const provider = makeProvider({ authorize });
    const editor = makeEditor(provider);
    const store = makeToolProviderConnectionsStore();

    await AUTHORIZE_TOOL_PROVIDER_ROUTE.handler({
      mastra: makeMastraWithStorage(editor, store),
      providerId: 'composio',
      toolkit: 'gmail',
      connectionId: '',
    } as any);

    expect(store.upsertConnection).toHaveBeenCalledWith({
      authorId: 'default',
      providerId: 'composio',
      toolkit: 'gmail',
      connectionId: 'ca_new',
      label: null,
      scope: 'per-author',
    });
  });

  it('forwards optional config to authorize when supplied', async () => {
    const authorize = vi.fn().mockResolvedValue({ url: 'https://oauth/redirect', authId: 'auth-123' });
    const provider = makeProvider({ authorize });
    const editor = makeEditor(provider);
    await AUTHORIZE_TOOL_PROVIDER_ROUTE.handler({
      mastra: makeMastra(editor),
      providerId: 'composio',
      toolkit: 'confluence',
      connectionId: 'conn-1',
      config: { subdomain: 'acme' },
    } as any);
    expect(authorize).toHaveBeenCalledWith({
      toolkit: 'confluence',
      connectionId: 'conn-1',
      toolName: undefined,
      config: { subdomain: 'acme' },
    });
  });

  it('falls back to user.id when resource id is missing (Workos-style auth)', async () => {
    const authorize = vi.fn().mockResolvedValue({ url: 'https://oauth/redirect', authId: 'auth-123' });
    const provider = makeProvider({ authorize });
    const editor = makeEditor(provider);
    const requestContext = new RequestContext();
    requestContext.set(MASTRA_USER_KEY, { id: 'user-xyz' });
    await AUTHORIZE_TOOL_PROVIDER_ROUTE.handler({
      mastra: makeMastra(editor),
      providerId: 'composio',
      toolkit: 'gmail',
      connectionId: '',
      requestContext,
    } as any);
    expect(authorize).toHaveBeenCalledWith({
      toolkit: 'gmail',
      connectionId: 'user-xyz',
      toolName: undefined,
    });
  });
});

describe('GET_TOOL_PROVIDER_AUTH_STATUS_ROUTE', () => {
  it('returns { status } from getAuthStatus', async () => {
    const getAuthStatus = vi.fn().mockResolvedValue('completed');
    const provider = makeProvider({ getAuthStatus });
    const editor = makeEditor(provider);
    const result = await GET_TOOL_PROVIDER_AUTH_STATUS_ROUTE.handler({
      mastra: makeMastra(editor),
      providerId: 'composio',
      authId: 'auth-123',
    } as any);
    expect(getAuthStatus).toHaveBeenCalledWith('auth-123');
    expect(result).toEqual({ status: 'completed' });
  });
});

describe('TOOL_PROVIDER_CONNECTION_STATUS_ROUTE', () => {
  it('wraps getConnectionStatus result in { items }', async () => {
    const getConnectionStatus = vi.fn().mockResolvedValue({
      'conn-1': { connected: true },
      'conn-2': { connected: false },
    });
    const provider = makeProvider({ getConnectionStatus });
    const editor = makeEditor(provider);
    const items = [
      { connectionId: 'conn-1', toolkit: 'gmail' },
      { connectionId: 'conn-2', toolkit: 'gmail' },
    ];
    const result = await TOOL_PROVIDER_CONNECTION_STATUS_ROUTE.handler({
      mastra: makeMastra(editor),
      providerId: 'composio',
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

describe('LIST_TOOL_PROVIDER_CONNECTIONS_ROUTE', () => {
  it('resolves userId from RequestContext and forwards toolkit via userIds[]', async () => {
    const listConnections = vi.fn().mockResolvedValue({
      items: [{ connectionId: 'ca_1', status: 'active' }],
    });
    const provider = makeProvider({ listConnections });
    const editor = makeEditor(provider);
    const requestContext = new RequestContext();
    requestContext.set(MASTRA_RESOURCE_ID_KEY, 'user_42');

    const result = await LIST_TOOL_PROVIDER_CONNECTIONS_ROUTE.handler({
      mastra: makeMastraWithStorage(editor, makeToolProviderConnectionsStore()),
      providerId: 'composio',
      toolkit: 'gmail',
      requestContext,
    } as any);

    expect(listConnections).toHaveBeenCalledWith({ toolkit: 'gmail', userIds: ['user_42'] });
    expect(result).toEqual({
      items: [{ connectionId: 'ca_1', status: 'active', label: null }],
    });
  });

  it('joins persisted labels from tool_provider_connections when present', async () => {
    const listConnections = vi.fn().mockResolvedValue({
      items: [
        { connectionId: 'ca_1', status: 'active' },
        { connectionId: 'ca_2', status: 'active' },
      ],
    });
    const provider = makeProvider({ listConnections });
    const editor = makeEditor(provider);
    const store = makeToolProviderConnectionsStore([
      { authorId: 'user_42', providerId: 'composio', toolkit: 'gmail', connectionId: 'ca_1', label: 'Work' },
    ]);
    const requestContext = new RequestContext();
    requestContext.set(MASTRA_RESOURCE_ID_KEY, 'user_42');

    const result = await LIST_TOOL_PROVIDER_CONNECTIONS_ROUTE.handler({
      mastra: makeMastraWithStorage(editor, store),
      providerId: 'composio',
      toolkit: 'gmail',
      requestContext,
    } as any);

    expect(store.listConnectionsByAuthor).toHaveBeenCalledWith({
      providerId: 'composio',
      toolkit: 'gmail',
    });
    expect(result).toEqual({
      items: [
        { connectionId: 'ca_1', status: 'active', label: 'Work', scope: 'per-author' },
        { connectionId: 'ca_2', status: 'active', label: null },
      ],
    });
  });

  it("falls back to 'default' when no auth context is present", async () => {
    const listConnections = vi.fn().mockResolvedValue({ items: [] });
    const provider = makeProvider({ listConnections });
    const editor = makeEditor(provider);

    await LIST_TOOL_PROVIDER_CONNECTIONS_ROUTE.handler({
      mastra: makeMastraWithStorage(editor, makeToolProviderConnectionsStore()),
      providerId: 'composio',
      toolkit: 'gmail',
      requestContext: undefined,
    } as any);

    expect(listConnections).toHaveBeenCalledWith({ toolkit: 'gmail', userIds: ['default'] });
  });

  it('non-admin: authorId query param is silently ignored', async () => {
    const listConnections = vi.fn().mockResolvedValue({ items: [] });
    const provider = makeProvider({ listConnections });
    const editor = makeEditor(provider);
    const requestContext = new RequestContext();
    requestContext.set(MASTRA_RESOURCE_ID_KEY, 'user_caller');

    await LIST_TOOL_PROVIDER_CONNECTIONS_ROUTE.handler({
      mastra: makeMastraWithStorage(editor, makeToolProviderConnectionsStore()),
      providerId: 'composio',
      toolkit: 'gmail',
      authorId: 'user_someone_else',
      requestContext,
    } as any);

    expect(listConnections).toHaveBeenCalledWith({ toolkit: 'gmail', userIds: ['user_caller'] });
  });

  it('admin + no authorId param: seeds userIds[] from tool_provider_connections across all authors', async () => {
    const listConnections = vi.fn().mockResolvedValue({
      items: [
        { connectionId: 'ca_a', status: 'active', authorId: 'user_a' },
        { connectionId: 'ca_b', status: 'active', authorId: 'user_b' },
      ],
    });
    const provider = makeProvider({ listConnections });
    const editor = makeEditor(provider);
    const store = makeToolProviderConnectionsStore([
      { authorId: 'user_a', providerId: 'composio', toolkit: 'gmail', connectionId: 'ca_a', label: 'A' },
      { authorId: 'user_b', providerId: 'composio', toolkit: 'gmail', connectionId: 'ca_b', label: 'B' },
    ]);
    const requestContext = new RequestContext();
    requestContext.set(MASTRA_RESOURCE_ID_KEY, 'admin_1');
    requestContext.set(MASTRA_USER_PERMISSIONS_KEY, ['tool-providers:admin']);

    const result = await LIST_TOOL_PROVIDER_CONNECTIONS_ROUTE.handler({
      mastra: makeMastraWithStorage(editor, store),
      providerId: 'composio',
      toolkit: 'gmail',
      requestContext,
    } as any);

    expect(listConnections).toHaveBeenCalledTimes(1);
    const call = listConnections.mock.calls[0][0];
    expect(call.toolkit).toBe('gmail');
    expect(new Set(call.userIds)).toEqual(new Set(['user_a', 'user_b']));
    expect(result.items).toEqual([
      { connectionId: 'ca_a', status: 'active', authorId: 'user_a', label: 'A', scope: 'per-author' },
      { connectionId: 'ca_b', status: 'active', authorId: 'user_b', label: 'B', scope: 'per-author' },
    ]);
  });

  it('admin + authorId=X: scopes to only that author', async () => {
    const listConnections = vi.fn().mockResolvedValue({
      items: [{ connectionId: 'ca_a', status: 'active', authorId: 'user_a' }],
    });
    const provider = makeProvider({ listConnections });
    const editor = makeEditor(provider);
    const store = makeToolProviderConnectionsStore([
      { authorId: 'user_a', providerId: 'composio', toolkit: 'gmail', connectionId: 'ca_a', label: 'A' },
      { authorId: 'user_b', providerId: 'composio', toolkit: 'gmail', connectionId: 'ca_b', label: 'B' },
    ]);
    const requestContext = new RequestContext();
    requestContext.set(MASTRA_RESOURCE_ID_KEY, 'admin_1');
    requestContext.set(MASTRA_USER_PERMISSIONS_KEY, ['tool-providers:admin']);

    await LIST_TOOL_PROVIDER_CONNECTIONS_ROUTE.handler({
      mastra: makeMastraWithStorage(editor, store),
      providerId: 'composio',
      toolkit: 'gmail',
      authorId: 'user_a',
      requestContext,
    } as any);

    expect(listConnections).toHaveBeenCalledWith({ toolkit: 'gmail', userIds: ['user_a'] });
  });

  it('admin + empty tool_provider_connections: skips adapter call and returns empty', async () => {
    const listConnections = vi.fn().mockResolvedValue({
      items: [],
      pagination: { page: 1, hasMore: false },
    });
    const provider = makeProvider({ listConnections });
    const editor = makeEditor(provider);
    const requestContext = new RequestContext();
    requestContext.set(MASTRA_RESOURCE_ID_KEY, 'admin_1');
    requestContext.set(MASTRA_USER_PERMISSIONS_KEY, ['tool-providers:admin']);

    const result = await LIST_TOOL_PROVIDER_CONNECTIONS_ROUTE.handler({
      mastra: makeMastraWithStorage(editor, makeToolProviderConnectionsStore()),
      providerId: 'composio',
      toolkit: 'gmail',
      requestContext,
    } as any);

    expect(listConnections).not.toHaveBeenCalled();
    expect(result).toEqual({
      items: [],
      pagination: { page: 1, perPage: undefined, hasMore: false },
    });
  });

  it('forwards page + perPage and returns pagination envelope from adapter', async () => {
    const listConnections = vi.fn().mockResolvedValue({
      items: [{ connectionId: 'ca_1', status: 'active' }],
      pagination: { page: 1, perPage: 25, hasMore: true },
    });
    const provider = makeProvider({ listConnections });
    const editor = makeEditor(provider);
    const requestContext = new RequestContext();
    requestContext.set(MASTRA_RESOURCE_ID_KEY, 'user_42');

    const result = await LIST_TOOL_PROVIDER_CONNECTIONS_ROUTE.handler({
      mastra: makeMastraWithStorage(editor, makeToolProviderConnectionsStore()),
      providerId: 'composio',
      toolkit: 'gmail',
      page: 1,
      perPage: 25,
      requestContext,
    } as any);

    expect(listConnections).toHaveBeenCalledWith({
      toolkit: 'gmail',
      userIds: ['user_42'],
      page: 1,
      perPage: 25,
    });
    expect(result.pagination).toEqual({ page: 1, perPage: 25, hasMore: true });
  });

  it('returns 404 for unknown provider id', async () => {
    const editor = makeEditor();
    await expect(
      LIST_TOOL_PROVIDER_CONNECTIONS_ROUTE.handler({
        mastra: makeMastra(editor),
        providerId: 'missing',
        toolkit: 'gmail',
        requestContext: undefined,
      } as any),
    ).rejects.toThrow(HTTPException);
  });

  it('non-admin caller sees shared rows in addition to their own bucket', async () => {
    const listConnections = vi.fn().mockResolvedValue({
      items: [
        { connectionId: 'ca_mine', status: 'active' },
        { connectionId: 'ca_shared', status: 'active' },
      ],
    });
    const provider = makeProvider({ listConnections });
    const editor = makeEditor(provider);
    const store = makeToolProviderConnectionsStore([
      {
        authorId: 'shared',
        providerId: 'composio',
        toolkit: 'gmail',
        connectionId: 'ca_shared',
        label: 'Shared work',
        scope: 'shared',
      },
    ]);
    const requestContext = new RequestContext();
    requestContext.set(MASTRA_RESOURCE_ID_KEY, 'user_42');

    const result = await LIST_TOOL_PROVIDER_CONNECTIONS_ROUTE.handler({
      mastra: makeMastraWithStorage(editor, store),
      providerId: 'composio',
      toolkit: 'gmail',
      requestContext,
    } as any);

    const call = listConnections.mock.calls[0][0];
    expect(new Set(call.userIds)).toEqual(new Set(['user_42', 'shared']));
    expect(result.items).toEqual([
      { connectionId: 'ca_mine', status: 'active', label: null },
      { connectionId: 'ca_shared', status: 'active', label: 'Shared work', scope: 'shared' },
    ]);
  });

  it('queryScope=shared narrows the listing to shared rows only', async () => {
    const listConnections = vi.fn().mockResolvedValue({
      items: [
        { connectionId: 'ca_mine', status: 'active' },
        { connectionId: 'ca_shared', status: 'active' },
      ],
    });
    const provider = makeProvider({ listConnections });
    const editor = makeEditor(provider);
    const store = makeToolProviderConnectionsStore([
      {
        authorId: 'shared',
        providerId: 'composio',
        toolkit: 'gmail',
        connectionId: 'ca_shared',
        label: 'Shared',
        scope: 'shared',
      },
    ]);
    const requestContext = new RequestContext();
    requestContext.set(MASTRA_RESOURCE_ID_KEY, 'user_42');

    const result = await LIST_TOOL_PROVIDER_CONNECTIONS_ROUTE.handler({
      mastra: makeMastraWithStorage(editor, store),
      providerId: 'composio',
      toolkit: 'gmail',
      scope: 'shared',
      requestContext,
    } as any);

    expect(listConnections).toHaveBeenCalledWith({ toolkit: 'gmail', userIds: ['shared'] });
    expect(result.items).toEqual([{ connectionId: 'ca_shared', status: 'active', label: 'Shared', scope: 'shared' }]);
  });

  it('queryScope=per-author drops shared rows from response', async () => {
    const listConnections = vi.fn().mockResolvedValue({
      items: [
        { connectionId: 'ca_mine', status: 'active' },
        { connectionId: 'ca_shared', status: 'active' },
      ],
    });
    const provider = makeProvider({ listConnections });
    const editor = makeEditor(provider);
    const store = makeToolProviderConnectionsStore([
      {
        authorId: 'shared',
        providerId: 'composio',
        toolkit: 'gmail',
        connectionId: 'ca_shared',
        label: 'Shared',
        scope: 'shared',
      },
    ]);
    const requestContext = new RequestContext();
    requestContext.set(MASTRA_RESOURCE_ID_KEY, 'user_42');

    const result = await LIST_TOOL_PROVIDER_CONNECTIONS_ROUTE.handler({
      mastra: makeMastraWithStorage(editor, store),
      providerId: 'composio',
      toolkit: 'gmail',
      scope: 'per-author',
      requestContext,
    } as any);

    expect(listConnections).toHaveBeenCalledWith({ toolkit: 'gmail', userIds: ['user_42'] });
    expect(result.items).toEqual([{ connectionId: 'ca_mine', status: 'active', label: null }]);
  });

  it('non-admin caller sees no caller-supplied connections from the adapter', async () => {
    const listConnections = vi.fn().mockResolvedValue({ items: [] });
    const provider = makeProvider({ listConnections });
    const editor = makeEditor(provider);
    const store = makeToolProviderConnectionsStore([
      {
        authorId: 'end_user_77',
        providerId: 'composio',
        toolkit: 'gmail',
        connectionId: 'ca_callerSupplied',
        label: null,
        scope: 'caller-supplied',
      },
    ]);
    const requestContext = new RequestContext();
    requestContext.set(MASTRA_RESOURCE_ID_KEY, 'user_42');

    const result = await LIST_TOOL_PROVIDER_CONNECTIONS_ROUTE.handler({
      mastra: makeMastraWithStorage(editor, store),
      providerId: 'composio',
      toolkit: 'gmail',
      scope: 'caller-supplied',
      requestContext,
    } as any);

    // queryScope=caller-supplied filters out shared/per-author from the seed.
    // The caller-supplied row belongs to a different authorId, so the seed is
    // empty and the adapter is never called.
    expect(listConnections).not.toHaveBeenCalled();
    expect(result.items).toEqual([]);
  });

  it('admin enumerates caller-supplied rows via userIds[] (Strategy B)', async () => {
    const listConnections = vi.fn().mockResolvedValue({
      items: [
        { connectionId: 'ca_userA', status: 'active' },
        { connectionId: 'ca_userB', status: 'active' },
      ],
    });
    const provider = makeProvider({ listConnections });
    const editor = makeEditor(provider);
    const store = makeToolProviderConnectionsStore([
      {
        authorId: 'end_user_A',
        providerId: 'composio',
        toolkit: 'gmail',
        connectionId: 'ca_userA',
        label: null,
        scope: 'caller-supplied',
      },
      {
        authorId: 'end_user_B',
        providerId: 'composio',
        toolkit: 'gmail',
        connectionId: 'ca_userB',
        label: null,
        scope: 'caller-supplied',
      },
    ]);
    const requestContext = new RequestContext();
    requestContext.set(MASTRA_RESOURCE_ID_KEY, 'admin_user');
    requestContext.set(MASTRA_USER_PERMISSIONS_KEY, ['tool-providers:admin']);

    const result = await LIST_TOOL_PROVIDER_CONNECTIONS_ROUTE.handler({
      mastra: makeMastraWithStorage(editor, store),
      providerId: 'composio',
      toolkit: 'gmail',
      scope: 'caller-supplied',
      requestContext,
    } as any);

    const call = listConnections.mock.calls[0][0];
    expect(call.toolkit).toBe('gmail');
    expect(new Set(call.userIds)).toEqual(new Set(['end_user_A', 'end_user_B']));
    expect(result.items).toEqual([
      { connectionId: 'ca_userA', status: 'active', label: null, scope: 'caller-supplied' },
      { connectionId: 'ca_userB', status: 'active', label: null, scope: 'caller-supplied' },
    ]);
  });
});

describe('AUTHORIZE_TOOL_PROVIDER_ROUTE (scope)', () => {
  it('scope=shared buckets the new Composio connection under SHARED_BUCKET_ID', async () => {
    const authorize = vi.fn().mockResolvedValue({ url: 'https://oauth/redirect', authId: 'ca_new' });
    const provider = makeProvider({ authorize });
    const editor = makeEditor(provider);
    const store = makeToolProviderConnectionsStore();
    const requestContext = new RequestContext();
    requestContext.set(MASTRA_RESOURCE_ID_KEY, 'user_42');

    await AUTHORIZE_TOOL_PROVIDER_ROUTE.handler({
      mastra: makeMastraWithStorage(editor, store),
      providerId: 'composio',
      toolkit: 'gmail',
      connectionId: '',
      label: 'Team Gmail',
      scope: 'shared',
      requestContext,
    } as any);

    expect(authorize).toHaveBeenCalledWith({
      toolkit: 'gmail',
      connectionId: 'shared',
      toolName: undefined,
      config: undefined,
    });
    expect(store.upsertConnection).toHaveBeenCalledWith({
      authorId: 'shared',
      providerId: 'composio',
      toolkit: 'gmail',
      connectionId: 'ca_new',
      label: 'Team Gmail',
      scope: 'shared',
    });
  });

  it('scope omitted defaults to per-author and keeps caller bucketing', async () => {
    const authorize = vi.fn().mockResolvedValue({ url: 'https://oauth/redirect', authId: 'ca_new' });
    const provider = makeProvider({ authorize });
    const editor = makeEditor(provider);
    const store = makeToolProviderConnectionsStore();
    const requestContext = new RequestContext();
    requestContext.set(MASTRA_RESOURCE_ID_KEY, 'user_42');

    await AUTHORIZE_TOOL_PROVIDER_ROUTE.handler({
      mastra: makeMastraWithStorage(editor, store),
      providerId: 'composio',
      toolkit: 'gmail',
      connectionId: '',
      requestContext,
    } as any);

    expect(authorize).toHaveBeenCalledWith({
      toolkit: 'gmail',
      connectionId: 'user_42',
      toolName: undefined,
      config: undefined,
    });
    expect(store.upsertConnection).toHaveBeenCalledWith({
      authorId: 'user_42',
      providerId: 'composio',
      toolkit: 'gmail',
      connectionId: 'ca_new',
      label: null,
      scope: 'per-author',
    });
  });

  it('scope=caller-supplied buckets the new connection under the request-context resourceId', async () => {
    const authorize = vi.fn().mockResolvedValue({ url: 'https://oauth/redirect', authId: 'ca_new' });
    const provider = makeProvider({ authorize });
    const editor = makeEditor(provider);
    const store = makeToolProviderConnectionsStore();
    const requestContext = new RequestContext();
    requestContext.set(MASTRA_RESOURCE_ID_KEY, 'end_user_77');

    await AUTHORIZE_TOOL_PROVIDER_ROUTE.handler({
      mastra: makeMastraWithStorage(editor, store),
      providerId: 'composio',
      toolkit: 'gmail',
      connectionId: '',
      scope: 'caller-supplied',
      requestContext,
    } as any);

    expect(authorize).toHaveBeenCalledWith({
      toolkit: 'gmail',
      connectionId: 'end_user_77',
      toolName: undefined,
      config: undefined,
    });
    expect(store.upsertConnection).toHaveBeenCalledWith({
      authorId: 'end_user_77',
      providerId: 'composio',
      toolkit: 'gmail',
      connectionId: 'ca_new',
      label: null,
      scope: 'caller-supplied',
    });
  });

  it('scope=caller-supplied without a resourceId on the request context throws 400', async () => {
    const authorize = vi.fn();
    const provider = makeProvider({ authorize });
    const editor = makeEditor(provider);
    const store = makeToolProviderConnectionsStore();
    const requestContext = new RequestContext();
    // Intentionally no MASTRA_RESOURCE_ID_KEY set.

    await expect(
      AUTHORIZE_TOOL_PROVIDER_ROUTE.handler({
        mastra: makeMastraWithStorage(editor, store),
        providerId: 'composio',
        toolkit: 'gmail',
        connectionId: '',
        scope: 'caller-supplied',
        requestContext,
      } as any),
    ).rejects.toMatchObject({ status: 400 });
    expect(authorize).not.toHaveBeenCalled();
    expect(store.upsertConnection).not.toHaveBeenCalled();
  });
});

describe('DISCONNECT_TOOL_PROVIDER_CONNECTION_ROUTE (scope)', () => {
  it('lets any caller disconnect a shared connection', async () => {
    const revokeConnection = vi.fn();
    const provider = makeProvider({
      capabilities: {
        multipleConnectionsPerToolkit: true,
        batchConnectionStatus: true,
        reauthorizeReusesConnectionId: true,
        supportsRevoke: true,
      },
      revokeConnection,
    });
    const editor = makeEditor(provider);
    const store = makeToolProviderConnectionsStore([
      {
        authorId: 'shared',
        providerId: 'composio',
        toolkit: 'gmail',
        connectionId: 'ca_shared',
        label: 'Team',
        scope: 'shared',
      },
    ]);
    const requestContext = new RequestContext();
    requestContext.set(MASTRA_RESOURCE_ID_KEY, 'user_42');

    const result = await DISCONNECT_TOOL_PROVIDER_CONNECTION_ROUTE.handler({
      mastra: makeMastraWithStorage(editor, store),
      providerId: 'composio',
      connectionId: 'ca_shared',
      force: true,
      requestContext,
    } as any);

    expect(revokeConnection).toHaveBeenCalledWith('ca_shared');
    expect(store.deleteConnection).toHaveBeenCalledWith({
      authorId: 'shared',
      providerId: 'composio',
      connectionId: 'ca_shared',
    });
    expect(result).toEqual({ ok: true, revoked: true });
  });

  it('refuses caller-supplied disconnect when the caller does not own the row', async () => {
    const revokeConnection = vi.fn();
    const provider = makeProvider({
      capabilities: {
        multipleConnectionsPerToolkit: true,
        batchConnectionStatus: true,
        reauthorizeReusesConnectionId: true,
        supportsRevoke: true,
      },
      revokeConnection,
    });
    const editor = makeEditor(provider);
    const store = makeToolProviderConnectionsStore([
      {
        authorId: 'end_user_77',
        providerId: 'composio',
        toolkit: 'gmail',
        connectionId: 'ca_callerSupplied',
        label: null,
        scope: 'caller-supplied',
      },
    ]);
    const requestContext = new RequestContext();
    requestContext.set(MASTRA_RESOURCE_ID_KEY, 'someone_else');

    await expect(
      DISCONNECT_TOOL_PROVIDER_CONNECTION_ROUTE.handler({
        mastra: makeMastraWithStorage(editor, store),
        providerId: 'composio',
        connectionId: 'ca_callerSupplied',
        force: true,
        requestContext,
      } as any),
    ).rejects.toMatchObject({ status: 403 });
    expect(revokeConnection).not.toHaveBeenCalled();
    expect(store.deleteConnection).not.toHaveBeenCalled();
  });
});

describe('LIST_TOOL_PROVIDER_CONNECTION_FIELDS_ROUTE', () => {
  it('forwards toolkit to listConnectionFields and wraps result in { fields }', async () => {
    const listConnectionFields = vi
      .fn()
      .mockResolvedValue([{ name: 'subdomain', displayName: 'Subdomain', type: 'string', required: true }]);
    const provider = makeProvider({ listConnectionFields });
    const editor = makeEditor(provider);
    const result = await LIST_TOOL_PROVIDER_CONNECTION_FIELDS_ROUTE.handler({
      mastra: makeMastra(editor),
      providerId: 'composio',
      toolkit: 'confluence',
    } as any);
    expect(listConnectionFields).toHaveBeenCalledWith({ toolkit: 'confluence' });
    expect(result).toEqual({
      fields: [{ name: 'subdomain', displayName: 'Subdomain', type: 'string', required: true }],
    });
  });

  it('returns 404 for unknown provider id', async () => {
    const editor = makeEditor();
    await expect(
      LIST_TOOL_PROVIDER_CONNECTION_FIELDS_ROUTE.handler({
        mastra: makeMastra(editor),
        providerId: 'missing',
        toolkit: 'gmail',
      } as any),
    ).rejects.toThrow(HTTPException);
  });
});

describe('DISCONNECT_TOOL_PROVIDER_CONNECTION_ROUTE', () => {
  it('rejects without force when an agent still pins the connection', async () => {
    const revokeConnection = vi.fn();
    const provider = makeProvider({
      capabilities: {
        multipleConnectionsPerToolkit: true,
        batchConnectionStatus: true,
        reauthorizeReusesConnectionId: true,
        supportsRevoke: true,
      },
      revokeConnection,
    });
    const editor = makeEditor(provider);
    const toolConnections = makeToolProviderConnectionsStore([
      { authorId: 'user-1', providerId: 'composio', toolkit: 'gmail', connectionId: 'ca_1' },
    ]);
    const agents = makeAgentsStore([
      {
        id: 'a1',
        name: 'Agent One',
        toolProviders: {
          composio: { connections: { gmail: [{ connectionId: 'ca_1' }] } },
        },
      },
    ]);
    const ctx = new RequestContext();
    ctx.set(MASTRA_RESOURCE_ID_KEY, 'user-1');

    await expect(
      DISCONNECT_TOOL_PROVIDER_CONNECTION_ROUTE.handler({
        mastra: makeMastraWithStorageAndAgents(editor, toolConnections, agents),
        providerId: 'composio',
        connectionId: 'ca_1',
        requestContext: ctx,
      } as any),
    ).rejects.toThrow(HTTPException);

    expect(revokeConnection).not.toHaveBeenCalled();
    expect(toolConnections.rows.size).toBe(1);
  });

  it('with force=true revokes at the provider and drops the row', async () => {
    const revokeConnection = vi.fn().mockResolvedValue(undefined);
    const provider = makeProvider({
      capabilities: {
        multipleConnectionsPerToolkit: true,
        batchConnectionStatus: true,
        reauthorizeReusesConnectionId: true,
        supportsRevoke: true,
      },
      revokeConnection,
    });
    const editor = makeEditor(provider);
    const toolConnections = makeToolProviderConnectionsStore([
      { authorId: 'user-1', providerId: 'composio', toolkit: 'gmail', connectionId: 'ca_1' },
    ]);
    const agents = makeAgentsStore([
      {
        id: 'a1',
        name: 'Agent One',
        toolProviders: {
          composio: { connections: { gmail: [{ connectionId: 'ca_1' }] } },
        },
      },
    ]);
    const ctx = new RequestContext();
    ctx.set(MASTRA_RESOURCE_ID_KEY, 'user-1');

    const result = await DISCONNECT_TOOL_PROVIDER_CONNECTION_ROUTE.handler({
      mastra: makeMastraWithStorageAndAgents(editor, toolConnections, agents),
      providerId: 'composio',
      connectionId: 'ca_1',
      force: true,
      requestContext: ctx,
    } as any);

    expect(result).toEqual({ ok: true, revoked: true });
    expect(revokeConnection).toHaveBeenCalledWith('ca_1');
    expect(toolConnections.rows.size).toBe(0);
  });

  it('reports revoked=false when adapter does not support revoke', async () => {
    const provider = makeProvider({
      capabilities: {
        multipleConnectionsPerToolkit: true,
        batchConnectionStatus: true,
        reauthorizeReusesConnectionId: true,
      },
    });
    const editor = makeEditor(provider);
    const toolConnections = makeToolProviderConnectionsStore([
      { authorId: 'user-1', providerId: 'composio', toolkit: 'gmail', connectionId: 'ca_1' },
    ]);
    const agents = makeAgentsStore([]);
    const ctx = new RequestContext();
    ctx.set(MASTRA_RESOURCE_ID_KEY, 'user-1');

    const result = await DISCONNECT_TOOL_PROVIDER_CONNECTION_ROUTE.handler({
      mastra: makeMastraWithStorageAndAgents(editor, toolConnections, agents),
      providerId: 'composio',
      connectionId: 'ca_1',
      requestContext: ctx,
    } as any);

    expect(result).toEqual({ ok: true, revoked: false });
    expect(toolConnections.rows.size).toBe(0);
  });

  it('surfaces revoke errors and preserves the local row so the user can retry', async () => {
    const revokeConnection = vi.fn().mockRejectedValue(new Error('upstream 500'));
    const provider = makeProvider({
      capabilities: {
        multipleConnectionsPerToolkit: true,
        batchConnectionStatus: true,
        reauthorizeReusesConnectionId: true,
        supportsRevoke: true,
      },
      revokeConnection,
    });
    const editor = makeEditor(provider);
    const toolConnections = makeToolProviderConnectionsStore([
      { authorId: 'user-1', providerId: 'composio', toolkit: 'gmail', connectionId: 'ca_1' },
    ]);
    const agents = makeAgentsStore([]);
    const ctx = new RequestContext();
    ctx.set(MASTRA_RESOURCE_ID_KEY, 'user-1');

    await expect(
      DISCONNECT_TOOL_PROVIDER_CONNECTION_ROUTE.handler({
        mastra: makeMastraWithStorageAndAgents(editor, toolConnections, agents),
        providerId: 'composio',
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
    const provider = makeProvider({
      capabilities: {
        multipleConnectionsPerToolkit: true,
        batchConnectionStatus: true,
        reauthorizeReusesConnectionId: true,
        supportsRevoke: true,
      },
      revokeConnection,
    });
    const editor = makeEditor(provider);
    const toolConnections = makeToolProviderConnectionsStore([
      { authorId: 'user-owner', providerId: 'composio', toolkit: 'gmail', connectionId: 'ca_1' },
    ]);
    const agents = makeAgentsStore([]);
    const ctx = new RequestContext();
    ctx.set(MASTRA_RESOURCE_ID_KEY, 'user-other');

    await expect(
      DISCONNECT_TOOL_PROVIDER_CONNECTION_ROUTE.handler({
        mastra: makeMastraWithStorageAndAgents(editor, toolConnections, agents),
        providerId: 'composio',
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
    const provider = makeProvider({
      capabilities: {
        multipleConnectionsPerToolkit: true,
        batchConnectionStatus: true,
        reauthorizeReusesConnectionId: true,
        supportsRevoke: true,
      },
      revokeConnection,
    });
    const editor = makeEditor(provider);
    const toolConnections = makeToolProviderConnectionsStore([
      { authorId: 'user-owner', providerId: 'composio', toolkit: 'gmail', connectionId: 'ca_1' },
    ]);
    const agents = makeAgentsStore([]);
    const ctx = new RequestContext();
    ctx.set(MASTRA_RESOURCE_ID_KEY, 'admin_1');
    ctx.set(MASTRA_USER_PERMISSIONS_KEY, ['tool-providers:admin']);

    const result = await DISCONNECT_TOOL_PROVIDER_CONNECTION_ROUTE.handler({
      mastra: makeMastraWithStorageAndAgents(editor, toolConnections, agents),
      providerId: 'composio',
      connectionId: 'ca_1',
      force: true,
      requestContext: ctx,
    } as any);

    expect(result).toEqual({ ok: true, revoked: true });
    expect(revokeConnection).toHaveBeenCalledWith('ca_1');
    expect(toolConnections.rows.size).toBe(0);
  });
});

describe('UPDATE_TOOL_PROVIDER_CONNECTION_ROUTE', () => {
  it('updates the label on the matching connection row', async () => {
    const provider = makeProvider();
    const editor = makeEditor(provider);
    const toolConnections = makeToolProviderConnectionsStore([
      {
        authorId: 'user-1',
        providerId: 'composio',
        toolkit: 'gmail',
        connectionId: 'ca_1',
        label: null,
        scope: 'per-author',
      },
    ]);
    const ctx = new RequestContext();
    ctx.set(MASTRA_RESOURCE_ID_KEY, 'user-1');

    const result = await UPDATE_TOOL_PROVIDER_CONNECTION_ROUTE.handler({
      mastra: makeMastraWithStorage(editor, toolConnections),
      providerId: 'composio',
      connectionId: 'ca_1',
      label: 'Work',
      requestContext: ctx,
    } as any);

    expect(result).toEqual({ ok: true, label: 'Work' });
    expect(toolConnections.upsertConnection).toHaveBeenCalledWith({
      authorId: 'user-1',
      providerId: 'composio',
      toolkit: 'gmail',
      connectionId: 'ca_1',
      label: 'Work',
      scope: 'per-author',
    });
  });

  it('clears the label when null is passed', async () => {
    const provider = makeProvider();
    const editor = makeEditor(provider);
    const toolConnections = makeToolProviderConnectionsStore([
      {
        authorId: 'user-1',
        providerId: 'composio',
        toolkit: 'gmail',
        connectionId: 'ca_1',
        label: 'Work',
        scope: 'per-author',
      },
    ]);
    const ctx = new RequestContext();
    ctx.set(MASTRA_RESOURCE_ID_KEY, 'user-1');

    const result = await UPDATE_TOOL_PROVIDER_CONNECTION_ROUTE.handler({
      mastra: makeMastraWithStorage(editor, toolConnections),
      providerId: 'composio',
      connectionId: 'ca_1',
      label: null,
      requestContext: ctx,
    } as any);

    expect(result).toEqual({ ok: true, label: null });
    expect(toolConnections.upsertConnection).toHaveBeenCalledWith(
      expect.objectContaining({ label: null, scope: 'per-author' }),
    );
  });

  it('clears the label when an empty string is passed', async () => {
    const provider = makeProvider();
    const editor = makeEditor(provider);
    const toolConnections = makeToolProviderConnectionsStore([
      {
        authorId: 'user-1',
        providerId: 'composio',
        toolkit: 'gmail',
        connectionId: 'ca_1',
        label: 'Old',
        scope: 'per-author',
      },
    ]);
    const ctx = new RequestContext();
    ctx.set(MASTRA_RESOURCE_ID_KEY, 'user-1');

    const result = await UPDATE_TOOL_PROVIDER_CONNECTION_ROUTE.handler({
      mastra: makeMastraWithStorage(editor, toolConnections),
      providerId: 'composio',
      connectionId: 'ca_1',
      label: '',
      requestContext: ctx,
    } as any);

    expect(result).toEqual({ ok: true, label: null });
  });

  it('returns 404 when the connection row does not exist', async () => {
    const provider = makeProvider();
    const editor = makeEditor(provider);
    const toolConnections = makeToolProviderConnectionsStore([]);
    const ctx = new RequestContext();
    ctx.set(MASTRA_RESOURCE_ID_KEY, 'user-1');

    await expect(
      UPDATE_TOOL_PROVIDER_CONNECTION_ROUTE.handler({
        mastra: makeMastraWithStorage(editor, toolConnections),
        providerId: 'composio',
        connectionId: 'ca_missing',
        label: 'Anything',
        requestContext: ctx,
      } as any),
    ).rejects.toMatchObject({ status: 404 });
    expect(toolConnections.upsertConnection).not.toHaveBeenCalled();
  });

  it('returns 403 when the caller is not the owner and the row is not shared', async () => {
    const provider = makeProvider();
    const editor = makeEditor(provider);
    const toolConnections = makeToolProviderConnectionsStore([
      {
        authorId: 'user-owner',
        providerId: 'composio',
        toolkit: 'gmail',
        connectionId: 'ca_1',
        label: 'Owner Label',
        scope: 'per-author',
      },
    ]);
    const ctx = new RequestContext();
    ctx.set(MASTRA_RESOURCE_ID_KEY, 'someone-else');

    await expect(
      UPDATE_TOOL_PROVIDER_CONNECTION_ROUTE.handler({
        mastra: makeMastraWithStorage(editor, toolConnections),
        providerId: 'composio',
        connectionId: 'ca_1',
        label: 'Hijack',
        requestContext: ctx,
      } as any),
    ).rejects.toMatchObject({ status: 403 });
    expect(toolConnections.upsertConnection).not.toHaveBeenCalled();
  });

  it('lets any caller rename a shared connection', async () => {
    const provider = makeProvider();
    const editor = makeEditor(provider);
    const toolConnections = makeToolProviderConnectionsStore([
      {
        authorId: 'shared',
        providerId: 'composio',
        toolkit: 'gmail',
        connectionId: 'ca_shared',
        label: 'Team',
        scope: 'shared',
      },
    ]);
    const ctx = new RequestContext();
    ctx.set(MASTRA_RESOURCE_ID_KEY, 'random_user');

    const result = await UPDATE_TOOL_PROVIDER_CONNECTION_ROUTE.handler({
      mastra: makeMastraWithStorage(editor, toolConnections),
      providerId: 'composio',
      connectionId: 'ca_shared',
      label: 'Team Renamed',
      requestContext: ctx,
    } as any);

    expect(result).toEqual({ ok: true, label: 'Team Renamed' });
    expect(toolConnections.upsertConnection).toHaveBeenCalledWith(
      expect.objectContaining({ authorId: 'shared', label: 'Team Renamed', scope: 'shared' }),
    );
  });

  it('lets an admin rename another author’s connection', async () => {
    const provider = makeProvider();
    const editor = makeEditor(provider);
    const toolConnections = makeToolProviderConnectionsStore([
      {
        authorId: 'user-owner',
        providerId: 'composio',
        toolkit: 'gmail',
        connectionId: 'ca_1',
        label: null,
        scope: 'per-author',
      },
    ]);
    const ctx = new RequestContext();
    ctx.set(MASTRA_RESOURCE_ID_KEY, 'admin_1');
    ctx.set(MASTRA_USER_PERMISSIONS_KEY, ['tool-providers:admin']);

    const result = await UPDATE_TOOL_PROVIDER_CONNECTION_ROUTE.handler({
      mastra: makeMastraWithStorage(editor, toolConnections),
      providerId: 'composio',
      connectionId: 'ca_1',
      label: 'Renamed By Admin',
      requestContext: ctx,
    } as any);

    expect(result).toEqual({ ok: true, label: 'Renamed By Admin' });
    expect(toolConnections.upsertConnection).toHaveBeenCalledWith(
      expect.objectContaining({ authorId: 'user-owner', label: 'Renamed By Admin' }),
    );
  });

  it('returns 403 when a non-admin caller does not own a caller-supplied row', async () => {
    const provider = makeProvider();
    const editor = makeEditor(provider);
    const toolConnections = makeToolProviderConnectionsStore([
      {
        authorId: 'tenant-A',
        providerId: 'composio',
        toolkit: 'gmail',
        connectionId: 'ca_1',
        label: 'Tenant A Label',
        scope: 'caller-supplied',
      },
    ]);
    const ctx = new RequestContext();
    ctx.set(MASTRA_RESOURCE_ID_KEY, 'tenant-B');

    await expect(
      UPDATE_TOOL_PROVIDER_CONNECTION_ROUTE.handler({
        mastra: makeMastraWithStorage(editor, toolConnections),
        providerId: 'composio',
        connectionId: 'ca_1',
        label: 'Hijack',
        requestContext: ctx,
      } as any),
    ).rejects.toMatchObject({ status: 403 });
    expect(toolConnections.upsertConnection).not.toHaveBeenCalled();
  });
});

describe('GET_TOOL_PROVIDER_CONNECTION_USAGE_ROUTE', () => {
  it('returns the agents that pin the connection', async () => {
    const provider = makeProvider();
    const editor = makeEditor(provider);
    const agents = makeAgentsStore([
      {
        id: 'a1',
        name: 'Agent One',
        toolProviders: { composio: { connections: { gmail: [{ connectionId: 'ca_1' }] } } },
      },
      {
        id: 'a2',
        name: 'Agent Two',
        toolProviders: { composio: { connections: { gmail: [{ connectionId: 'ca_2' }] } } },
      },
      {
        id: 'a3',
        name: 'Agent Three',
        toolProviders: { composio: { connections: { gmail: [{ connectionId: 'ca_1' }] } } },
      },
    ]);

    const result = await GET_TOOL_PROVIDER_CONNECTION_USAGE_ROUTE.handler({
      mastra: makeMastraWithStorageAndAgents(editor, undefined, agents),
      providerId: 'composio',
      connectionId: 'ca_1',
      requestContext: undefined,
    } as any);

    expect(result.agents).toEqual([
      { id: 'a1', name: 'Agent One' },
      { id: 'a3', name: 'Agent Three' },
    ]);
  });

  it('returns an empty list when no agents pin the connection', async () => {
    const provider = makeProvider();
    const editor = makeEditor(provider);
    const agents = makeAgentsStore([
      {
        id: 'a1',
        name: 'Agent One',
        toolProviders: { composio: { connections: { gmail: [{ connectionId: 'ca_other' }] } } },
      },
    ]);

    const result = await GET_TOOL_PROVIDER_CONNECTION_USAGE_ROUTE.handler({
      mastra: makeMastraWithStorageAndAgents(editor, undefined, agents),
      providerId: 'composio',
      connectionId: 'ca_missing',
      requestContext: undefined,
    } as any);

    expect(result.agents).toEqual([]);
  });

  it('returns 404 for unknown provider id', async () => {
    const editor = makeEditor();
    await expect(
      GET_TOOL_PROVIDER_CONNECTION_USAGE_ROUTE.handler({
        mastra: makeMastraWithStorageAndAgents(editor, undefined, makeAgentsStore([])),
        providerId: 'missing',
        connectionId: 'ca_1',
        requestContext: undefined,
      } as any),
    ).rejects.toThrow(HTTPException);
  });

  it('non-admin: 403 reading usage for another author’s connection', async () => {
    const provider = makeProvider();
    const editor = makeEditor(provider);
    const toolConnections = makeToolProviderConnectionsStore([
      { authorId: 'user-owner', providerId: 'composio', toolkit: 'gmail', connectionId: 'ca_1' },
    ]);
    const agents = makeAgentsStore([]);
    const ctx = new RequestContext();
    ctx.set(MASTRA_RESOURCE_ID_KEY, 'user-other');

    await expect(
      GET_TOOL_PROVIDER_CONNECTION_USAGE_ROUTE.handler({
        mastra: makeMastraWithStorageAndAgents(editor, toolConnections, agents),
        providerId: 'composio',
        connectionId: 'ca_1',
        requestContext: ctx,
      } as any),
    ).rejects.toThrow(HTTPException);
  });

  it('admin: can read usage for another author’s connection', async () => {
    const provider = makeProvider();
    const editor = makeEditor(provider);
    const toolConnections = makeToolProviderConnectionsStore([
      { authorId: 'user-owner', providerId: 'composio', toolkit: 'gmail', connectionId: 'ca_1' },
    ]);
    const agents = makeAgentsStore([
      {
        id: 'a1',
        name: 'Agent One',
        toolProviders: { composio: { connections: { gmail: [{ connectionId: 'ca_1' }] } } },
      },
    ]);
    const ctx = new RequestContext();
    ctx.set(MASTRA_RESOURCE_ID_KEY, 'admin_1');
    ctx.set(MASTRA_USER_PERMISSIONS_KEY, ['tool-providers:admin']);

    const result = await GET_TOOL_PROVIDER_CONNECTION_USAGE_ROUTE.handler({
      mastra: makeMastraWithStorageAndAgents(editor, toolConnections, agents),
      providerId: 'composio',
      connectionId: 'ca_1',
      requestContext: ctx,
    } as any);

    expect(result.agents).toEqual([{ id: 'a1', name: 'Agent One' }]);
  });
});

describe('GET_TOOL_PROVIDER_HEALTH_ROUTE', () => {
  it('returns the provider health payload', async () => {
    const provider = makeProvider({
      getHealth: vi.fn().mockResolvedValue({ ok: false, message: 'no api key' }),
    });
    const editor = makeEditor(provider);
    const result = await GET_TOOL_PROVIDER_HEALTH_ROUTE.handler({
      mastra: makeMastra(editor),
      providerId: 'composio',
    } as any);
    expect(result).toEqual({ ok: false, message: 'no api key' });
  });
});
