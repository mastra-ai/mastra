import type { IMastraEditor } from '@mastra/core/editor';
import { MASTRA_RESOURCE_ID_KEY, RequestContext } from '@mastra/core/request-context';
import { UnknownIntegrationError } from '@mastra/core/tool-integration';
import type { ToolIntegration } from '@mastra/core/tool-integration';
import { describe, it, expect, vi } from 'vitest';

import { MASTRA_USER_KEY } from '../constants';
import { HTTPException } from '../http-exception';
import {
  AUTHORIZE_TOOL_INTEGRATION_ROUTE,
  GET_TOOL_INTEGRATION_AUTH_STATUS_ROUTE,
  GET_TOOL_INTEGRATION_HEALTH_ROUTE,
  LIST_TOOL_INTEGRATION_CONNECTIONS_ROUTE,
  LIST_TOOL_INTEGRATION_TOOLS_ROUTE,
  LIST_TOOL_INTEGRATIONS_ROUTE,
  LIST_TOOL_SERVICES_ROUTE,
  TOOL_INTEGRATION_CONNECTION_STATUS_ROUTE,
} from './tool-integrations';

function makeMastra(editor?: Partial<IMastraEditor> | undefined) {
  return {
    getEditor: () => editor,
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
  it('resolves userId from RequestContext and forwards toolService', async () => {
    const listConnections = vi.fn().mockResolvedValue({
      items: [{ connectionId: 'ca_1', status: 'active' }],
    });
    const integration = makeIntegration({ listConnections });
    const editor = makeEditor(integration);
    const requestContext = new RequestContext();
    requestContext.set(MASTRA_RESOURCE_ID_KEY, 'user_42');

    const result = await LIST_TOOL_INTEGRATION_CONNECTIONS_ROUTE.handler({
      mastra: makeMastra(editor),
      integrationId: 'composio',
      toolService: 'gmail',
      requestContext,
    } as any);

    expect(listConnections).toHaveBeenCalledWith({ toolService: 'gmail', userId: 'user_42' });
    expect(result).toEqual({
      items: [{ connectionId: 'ca_1', status: 'active' }],
    });
  });

  it("falls back to 'default' when no auth context is present", async () => {
    const listConnections = vi.fn().mockResolvedValue({ items: [] });
    const integration = makeIntegration({ listConnections });
    const editor = makeEditor(integration);

    await LIST_TOOL_INTEGRATION_CONNECTIONS_ROUTE.handler({
      mastra: makeMastra(editor),
      integrationId: 'composio',
      toolService: 'gmail',
      requestContext: undefined,
    } as any);

    expect(listConnections).toHaveBeenCalledWith({ toolService: 'gmail', userId: 'default' });
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
