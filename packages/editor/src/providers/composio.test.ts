import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MASTRA_RESOURCE_ID_KEY } from '@mastra/core/request-context';

// ── module mocks ────────────────────────────────────────────────────────
// `vi.hoisted` because the mock factory below is hoisted above all other
// statements; we need the shared instance store and constructor to be
// reachable at hoist time.

const { composioInstances, makeFakeComposio } = vi.hoisted(() => {
  interface FakeComposioInstance {
    apiKey: string;
    hasProvider: boolean;
    toolkits: { get: ReturnType<typeof vi.fn>; getConnectedAccountInitiationFields: ReturnType<typeof vi.fn> };
    tools: { get: ReturnType<typeof vi.fn>; getRawComposioTools: ReturnType<typeof vi.fn> };
    connectedAccounts: {
      initiate: ReturnType<typeof vi.fn>;
      get: ReturnType<typeof vi.fn>;
      list: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
    };
    authConfigs: { list: ReturnType<typeof vi.fn> };
  }

  const instances: FakeComposioInstance[] = [];

  const factory = (opts: { apiKey: string; provider?: unknown }): FakeComposioInstance => {
    const inst: FakeComposioInstance = {
      apiKey: opts.apiKey,
      hasProvider: Boolean(opts.provider),
      toolkits: { get: vi.fn(), getConnectedAccountInitiationFields: vi.fn() },
      tools: { get: vi.fn(), getRawComposioTools: vi.fn() },
      connectedAccounts: { initiate: vi.fn(), get: vi.fn(), list: vi.fn(), delete: vi.fn() },
      authConfigs: { list: vi.fn() },
    };
    instances.push(inst);
    return inst;
  };

  return { composioInstances: instances, makeFakeComposio: factory };
});

type FakeComposioInstance = ReturnType<typeof makeFakeComposio>;

vi.mock('@composio/core', () => ({
  Composio: function (this: Record<string, unknown>, opts: { apiKey: string; provider?: unknown }) {
    Object.assign(this, makeFakeComposio(opts));
  },
}));

vi.mock('@composio/mastra', () => ({
  MastraProvider: function (this: Record<string, unknown>) {
    Object.assign(this, { __mastra: true });
  },
}));

// Import after mocks are registered.
import { ComposioToolProvider } from './composio';

function getRawInstance(): FakeComposioInstance {
  return composioInstances.find(i => !i.hasProvider)!;
}

function getMastraInstance(): FakeComposioInstance {
  return composioInstances.find(i => i.hasProvider)!;
}

beforeEach(() => {
  composioInstances.length = 0;
});

describe('ComposioToolProvider — identity & capabilities', () => {
  it('has literal id "composio" and full capabilities', () => {
    const integration = new ComposioToolProvider({ apiKey: 'k' });
    expect(integration.info.id).toBe('composio');
    expect(integration.info.name).toBe('Composio');
    expect(integration.capabilities).toEqual({
      multipleConnectionsPerToolkit: true,
      batchConnectionStatus: true,
      reauthorizeReusesConnectionId: true,
      supportsRevoke: true,
    });
  });
});

describe('ComposioToolProvider — catalog allowlist', () => {
  it('listToolkitsVNext honors allowedToolkits', async () => {
    const integration = new ComposioToolProvider({
      apiKey: 'k',
      allowedToolkits: ['gmail'],
    });

    // Trigger client construction.
    await integration.listToolkitsVNext().catch(() => undefined);
    const raw = getRawInstance();

    raw.toolkits.get.mockResolvedValue([
      { slug: 'gmail', name: 'Gmail', meta: { description: 'mail', logo: 'l' } },
      { slug: 'slack', name: 'Slack', meta: { description: 'chat', logo: 'l' } },
    ]);

    const services = await integration.listToolkitsVNext();
    expect(services.data.map(s => s.slug)).toEqual(['gmail']);
  });

  it('listTools honors per-service allowedTools entries', async () => {
    const integration = new ComposioToolProvider({
      apiKey: 'k',
      allowedTools: { gmail: ['gmail.*'] },
    });

    await integration.listTools({ toolkit: 'gmail' }).catch(() => undefined);
    const raw = getRawInstance();

    raw.tools.getRawComposioTools.mockResolvedValue([
      { slug: 'gmail.fetch_emails', name: 'Fetch', description: 'd', toolkit: { slug: 'gmail' } },
      { slug: 'gmail.send_email', name: 'Send', description: 'd', toolkit: { slug: 'gmail' } },
    ]);

    const tools = await integration.listTools({ toolkit: 'gmail' });
    expect(tools.data.map(t => t.slug)).toEqual(['gmail.fetch_emails', 'gmail.send_email']);

    // Now narrow to a single tool slug within gmail.
    const narrow = new ComposioToolProvider({
      apiKey: 'k',
      allowedTools: { gmail: ['gmail.fetch_emails'] },
    });
    await narrow.listTools({ toolkit: 'gmail' }).catch(() => undefined);
    const narrowRaw = composioInstances.filter(i => !i.hasProvider).at(-1)!;
    narrowRaw.tools.getRawComposioTools.mockResolvedValue([
      { slug: 'gmail.fetch_emails', name: 'Fetch', description: 'd', toolkit: { slug: 'gmail' } },
      { slug: 'gmail.send_email', name: 'Send', description: 'd', toolkit: { slug: 'gmail' } },
    ]);
    const filtered = await narrow.listTools({ toolkit: 'gmail' });
    expect(filtered.data.map(t => t.slug)).toEqual(['gmail.fetch_emails']);
  });

  it('listTools leaves services without an allowedTools entry unfiltered', async () => {
    const integration = new ComposioToolProvider({
      apiKey: 'k',
      allowedToolkits: ['gmail', 'slack'],
      allowedTools: { gmail: ['gmail.send_email'] }, // slack intentionally omitted
    });

    await integration.listTools({ toolkit: 'slack' }).catch(() => undefined);
    const raw = getRawInstance();
    raw.tools.getRawComposioTools.mockResolvedValue([
      { slug: 'slack.post_message', name: 'Post', description: 'd', toolkit: { slug: 'slack' } },
      { slug: 'slack.list_channels', name: 'List', description: 'd', toolkit: { slug: 'slack' } },
    ]);

    const slack = await integration.listTools({ toolkit: 'slack' });
    expect(slack.data.map(t => t.slug)).toEqual(['slack.post_message', 'slack.list_channels']);
  });

  it('listTools forwards search + pagination to getRawComposioTools and reports hasMore', async () => {
    const integration = new ComposioToolProvider({ apiKey: 'k' });
    await integration.listTools().catch(() => undefined);
    const raw = getRawInstance();
    raw.tools.getRawComposioTools.mockClear();
    raw.tools.getRawComposioTools.mockResolvedValue([
      { slug: 'gmail.send', name: 'Send', description: 'd', toolkit: { slug: 'gmail' } },
      { slug: 'gmail.send_draft', name: 'Send draft', description: 'd', toolkit: { slug: 'gmail' } },
    ]);

    const result = await integration.listTools({ search: 'send', perPage: 2, page: 1 });

    expect(raw.tools.getRawComposioTools).toHaveBeenCalledWith({ search: 'send', limit: 2 });
    expect(result.data.map(t => t.slug)).toEqual(['gmail.send', 'gmail.send_draft']);
    expect(result.pagination).toEqual({ page: 1, perPage: 2, hasMore: true });
  });

  it('listTools with toolkit scopes the SDK query and forwards search', async () => {
    const integration = new ComposioToolProvider({ apiKey: 'k' });
    await integration.listTools({ toolkit: 'gmail' }).catch(() => undefined);
    const raw = getRawInstance();
    raw.tools.getRawComposioTools.mockClear();
    raw.tools.getRawComposioTools.mockResolvedValue([]);

    await integration.listTools({ toolkit: 'gmail', search: 'send', perPage: 50 });

    expect(raw.tools.getRawComposioTools).toHaveBeenCalledWith({
      toolkits: ['gmail'],
      limit: 50,
      search: 'send',
    });
  });
});

describe('ComposioToolProvider — resolveTools', () => {
  it('returns {} when toolSlugs is empty without calling the SDK', async () => {
    const integration = new ComposioToolProvider({ apiKey: 'k' });
    const result = await integration.resolveToolsVNext({
      toolSlugs: [],
      toolMeta: {},
      connectionId: 'ca_x',
    });
    expect(result).toEqual({});
    expect(composioInstances.length).toBe(0);
  });

  it('injects connectedAccountId via beforeExecute, clears outputSchema, applies description override', async () => {
    const integration = new ComposioToolProvider({ apiKey: 'k' });

    await integration
      .resolveToolsVNext({ toolSlugs: ['a'], toolMeta: {}, connectionId: 'ca_1' })
      .catch(() => undefined);
    const mastra = getMastraInstance();
    mastra.tools.get.mockClear();

    const tool = {
      id: 'gmail.fetch_emails',
      description: 'original',
      outputSchema: { not: 'undefined' } as unknown,
    };
    mastra.tools.get.mockResolvedValue({ 'gmail.fetch_emails': tool });

    const result = await integration.resolveToolsVNext({
      toolSlugs: ['gmail.fetch_emails'],
      toolMeta: { 'gmail.fetch_emails': { description: 'overridden' } },
      connectionId: 'ca_1',
      requestContext: { [MASTRA_RESOURCE_ID_KEY]: 'user_42' },
    });

    expect(Object.keys(result)).toEqual(['gmail.fetch_emails']);
    expect((result['gmail.fetch_emails'] as unknown as typeof tool).outputSchema).toBeUndefined();
    expect((result['gmail.fetch_emails'] as unknown as typeof tool).description).toBe('overridden');

    // beforeExecute modifier was passed and injects connectionId.
    const callArgs = mastra.tools.get.mock.calls[0]!;
    expect(callArgs[0]).toBe('user_42');
    expect(callArgs[1]).toEqual({ tools: ['gmail.fetch_emails'] });
    const modifiers = callArgs[2] as { beforeExecute: (a: { params: { connectedAccountId?: string } }) => unknown };
    const params: { connectedAccountId?: string } = {};
    modifiers.beforeExecute({ params });
    expect(params.connectedAccountId).toBe('ca_1');
  });

  it('falls back to "default" internalUserId when MASTRA_RESOURCE_ID_KEY missing', async () => {
    const integration = new ComposioToolProvider({ apiKey: 'k' });

    await integration
      .resolveToolsVNext({ toolSlugs: ['a'], toolMeta: {}, connectionId: 'ca_1' })
      .catch(() => undefined);
    const mastra = getMastraInstance();
    mastra.tools.get.mockClear();
    mastra.tools.get.mockResolvedValue({});

    await integration.resolveToolsVNext({
      toolSlugs: ['gmail.fetch_emails'],
      toolMeta: {},
      connectionId: 'ca_1',
    });

    expect(mastra.tools.get.mock.calls[0]![0]).toBe('default');
  });

  it('reads MASTRA_RESOURCE_ID_KEY from requestContext when present', async () => {
    const integration = new ComposioToolProvider({ apiKey: 'k' });

    await integration
      .resolveToolsVNext({ toolSlugs: ['a'], toolMeta: {}, connectionId: 'ca_1' })
      .catch(() => undefined);
    const mastra = getMastraInstance();
    mastra.tools.get.mockClear();
    mastra.tools.get.mockResolvedValue({});

    await integration.resolveToolsVNext({
      toolSlugs: ['gmail.fetch_emails'],
      toolMeta: {},
      connectionId: 'ca_1',
      requestContext: { [MASTRA_RESOURCE_ID_KEY]: 'author_99' },
    });

    expect(mastra.tools.get.mock.calls[0]![0]).toBe('author_99');
  });

  it('prefers opts.authorId over requestContext when supplied (author-bound pin)', async () => {
    const integration = new ComposioToolProvider({ apiKey: 'k' });

    await integration
      .resolveToolsVNext({ toolSlugs: ['a'], toolMeta: {}, connectionId: 'ca_1' })
      .catch(() => undefined);
    const mastra = getMastraInstance();
    mastra.tools.get.mockClear();
    mastra.tools.get.mockResolvedValue({});

    await integration.resolveToolsVNext({
      toolSlugs: ['gmail.fetch_emails'],
      toolMeta: {},
      connectionId: 'ca_1',
      authorId: 'author_owner',
      requestContext: { [MASTRA_RESOURCE_ID_KEY]: 'invoker_other' },
    });

    expect(mastra.tools.get.mock.calls[0]![0]).toBe('author_owner');
  });
});

describe('ComposioToolProvider — authorize', () => {
  it('resolves the single ENABLED auth config and returns { url, authId }', async () => {
    const integration = new ComposioToolProvider({ apiKey: 'k' });

    await integration.authorize({ toolkit: 'gmail', connectionId: 'author_1' }).catch(() => undefined);
    const raw = getRawInstance();

    raw.authConfigs.list.mockResolvedValue({
      items: [
        { id: 'ac_1', status: 'ENABLED' },
        { id: 'ac_2', status: 'DISABLED' },
      ],
    });
    raw.connectedAccounts.initiate.mockResolvedValue({ id: 'ca_new', redirectUrl: 'https://oauth' });

    const result = await integration.authorize({ toolkit: 'gmail', connectionId: 'author_1' });

    expect(raw.authConfigs.list).toHaveBeenCalledWith({ toolkit: 'gmail' });
    expect(raw.connectedAccounts.initiate).toHaveBeenCalledWith('author_1', 'ac_1', { allowMultiple: true });
    expect(result).toEqual({ url: 'https://oauth', authId: 'ca_new' });
  });

  it('throws if zero ENABLED auth configs match', async () => {
    const integration = new ComposioToolProvider({ apiKey: 'k' });
    await integration.authorize({ toolkit: 'gmail', connectionId: 'a' }).catch(() => undefined);
    const raw = getRawInstance();
    raw.authConfigs.list.mockResolvedValue({ items: [{ id: 'ac_1', status: 'DISABLED' }] });

    await expect(integration.authorize({ toolkit: 'gmail', connectionId: 'a' })).rejects.toThrow(
      /No ENABLED auth config/,
    );
  });

  it('throws if multiple ENABLED auth configs match', async () => {
    const integration = new ComposioToolProvider({ apiKey: 'k' });
    await integration.authorize({ toolkit: 'gmail', connectionId: 'a' }).catch(() => undefined);
    const raw = getRawInstance();
    raw.authConfigs.list.mockResolvedValue({
      items: [
        { id: 'ac_1', status: 'ENABLED' },
        { id: 'ac_2', status: 'ENABLED' },
      ],
    });

    await expect(integration.authorize({ toolkit: 'gmail', connectionId: 'a' })).rejects.toThrow(
      /Multiple ENABLED auth configs/,
    );
  });

  it('forwards config to connectedAccounts.initiate as { authScheme, val }', async () => {
    const integration = new ComposioToolProvider({ apiKey: 'k' });
    await integration.authorize({ toolkit: 'confluence', connectionId: 'a' }).catch(() => undefined);
    const raw = getRawInstance();

    raw.authConfigs.list.mockResolvedValue({
      items: [{ id: 'ac_1', status: 'ENABLED', authScheme: 'OAUTH2' }],
    });
    raw.connectedAccounts.initiate.mockResolvedValue({ id: 'ca_new', redirectUrl: 'https://oauth' });

    await integration.authorize({
      toolkit: 'confluence',
      connectionId: 'author_1',
      config: { subdomain: 'acme' },
    });

    expect(raw.connectedAccounts.initiate).toHaveBeenCalledWith('author_1', 'ac_1', {
      allowMultiple: true,
      config: { authScheme: 'OAUTH2', val: { subdomain: 'acme' } },
    });
  });

  it('omits config when an empty object is supplied', async () => {
    const integration = new ComposioToolProvider({ apiKey: 'k' });
    await integration.authorize({ toolkit: 'gmail', connectionId: 'a' }).catch(() => undefined);
    const raw = getRawInstance();

    raw.authConfigs.list.mockResolvedValue({
      items: [{ id: 'ac_1', status: 'ENABLED', authScheme: 'OAUTH2' }],
    });
    raw.connectedAccounts.initiate.mockResolvedValue({ id: 'ca_new', redirectUrl: 'https://oauth' });

    await integration.authorize({ toolkit: 'gmail', connectionId: 'a', config: {} });

    expect(raw.connectedAccounts.initiate).toHaveBeenCalledWith('a', 'ac_1', { allowMultiple: true });
  });
});

describe('ComposioToolProvider — listConnectionFields', () => {
  it('queries the SDK with the resolved authScheme and maps fields', async () => {
    const integration = new ComposioToolProvider({ apiKey: 'k' });
    await integration.listConnectionFields({ toolkit: 'confluence' }).catch(() => undefined);
    const raw = getRawInstance();

    raw.authConfigs.list.mockResolvedValue({
      items: [{ id: 'ac_1', status: 'ENABLED', authScheme: 'OAUTH2' }],
    });
    raw.toolkits.getConnectedAccountInitiationFields.mockResolvedValue([
      { name: 'subdomain', displayName: 'Subdomain', description: 'Your sub', type: 'string', required: true },
      { name: 'port', type: 'integer', required: false, default: 443 },
      { name: 'tls', type: 'bool' },
    ]);

    const fields = await integration.listConnectionFields({ toolkit: 'confluence' });

    expect(raw.toolkits.getConnectedAccountInitiationFields).toHaveBeenCalledWith('confluence', 'OAUTH2', {
      requiredOnly: false,
    });
    expect(fields).toEqual([
      {
        name: 'subdomain',
        displayName: 'Subdomain',
        description: 'Your sub',
        type: 'string',
        required: true,
        default: undefined,
      },
      { name: 'port', displayName: undefined, description: undefined, type: 'number', required: false, default: 443 },
      {
        name: 'tls',
        displayName: undefined,
        description: undefined,
        type: 'boolean',
        required: false,
        default: undefined,
      },
    ]);
  });

  it('returns [] when no auth scheme is available without calling the SDK', async () => {
    const integration = new ComposioToolProvider({ apiKey: 'k' });
    await integration.listConnectionFields({ toolkit: 'gmail' }).catch(() => undefined);
    const raw = getRawInstance();

    raw.authConfigs.list.mockResolvedValue({
      items: [{ id: 'ac_1', status: 'ENABLED' /* no authScheme */ }],
    });

    const fields = await integration.listConnectionFields({ toolkit: 'gmail' });

    expect(fields).toEqual([]);
    expect(raw.toolkits.getConnectedAccountInitiationFields).not.toHaveBeenCalled();
  });
});

describe('ComposioToolProvider — getAuthStatus', () => {
  it('maps Composio account status → AuthFlowStatus', async () => {
    const integration = new ComposioToolProvider({ apiKey: 'k' });
    await integration.getAuthStatus('a').catch(() => undefined);
    const raw = getRawInstance();

    raw.connectedAccounts.get.mockResolvedValueOnce({ status: 'ACTIVE' });
    expect(await integration.getAuthStatus('a')).toBe('completed');

    raw.connectedAccounts.get.mockResolvedValueOnce({ status: 'INITIATED' });
    expect(await integration.getAuthStatus('a')).toBe('pending');

    raw.connectedAccounts.get.mockResolvedValueOnce({ status: 'EXPIRED' });
    expect(await integration.getAuthStatus('a')).toBe('failed');

    raw.connectedAccounts.get.mockResolvedValueOnce({ status: 'FAILED' });
    expect(await integration.getAuthStatus('a')).toBe('failed');
  });
});

describe('ComposioToolProvider — getConnectionStatus', () => {
  it('makes exactly one SDK call for N items and buckets results by connectionId', async () => {
    const integration = new ComposioToolProvider({ apiKey: 'k' });
    await integration.getConnectionStatus({ items: [{ connectionId: 'x', toolkit: 'gmail' }] }).catch(() => undefined);
    const raw = getRawInstance();
    raw.connectedAccounts.list.mockClear();

    raw.connectedAccounts.list.mockResolvedValue({
      items: [
        { id: 'ca_active', status: 'ACTIVE', isDisabled: false },
        { id: 'ca_inactive', status: 'INACTIVE', isDisabled: false },
        { id: 'ca_disabled', status: 'ACTIVE', isDisabled: true },
      ],
    });

    const result = await integration.getConnectionStatus({
      items: [
        { connectionId: 'ca_active', toolkit: 'gmail' },
        { connectionId: 'ca_inactive', toolkit: 'gmail' },
        { connectionId: 'ca_disabled', toolkit: 'slack' },
        { connectionId: 'ca_missing', toolkit: 'gmail' },
      ],
    });

    expect(raw.connectedAccounts.list).toHaveBeenCalledTimes(1);
    expect(raw.connectedAccounts.list).toHaveBeenCalledWith({ toolkitSlugs: ['gmail', 'slack'] });
    expect(result).toEqual({
      ca_active: { connected: true },
      ca_inactive: { connected: false },
      ca_disabled: { connected: false },
      ca_missing: { connected: false },
    });
  });

  it('returns {} for empty items without calling the SDK', async () => {
    const integration = new ComposioToolProvider({ apiKey: 'k' });
    const result = await integration.getConnectionStatus({ items: [] });
    expect(result).toEqual({});
    expect(composioInstances.length).toBe(0);
  });
});

describe('ComposioToolProvider — listConnections', () => {
  it('forwards toolkit + userId and maps SDK items', async () => {
    const integration = new ComposioToolProvider({ apiKey: 'k' });
    await integration.listConnections({ toolkit: 'gmail', userId: 'user_42' }).catch(() => undefined);
    const raw = getRawInstance();
    raw.connectedAccounts.list.mockResolvedValue({
      items: [
        { id: 'ca_1', status: 'ACTIVE', isDisabled: false, createdAt: '2026-01-01T00:00:00Z' },
        { id: 'ca_2', status: 'INACTIVE', isDisabled: false },
        { id: 'ca_3', status: 'ACTIVE', isDisabled: true },
      ],
    });

    const result = await integration.listConnections({ toolkit: 'gmail', userId: 'user_42' });

    expect(raw.connectedAccounts.list).toHaveBeenCalledWith({
      toolkitSlugs: ['gmail'],
      userIds: ['user_42'],
      limit: 50,
    });
    expect(result.items).toEqual([
      { connectionId: 'ca_1', status: 'active', createdAt: '2026-01-01T00:00:00Z' },
      { connectionId: 'ca_2', status: 'inactive', createdAt: undefined },
      { connectionId: 'ca_3', status: 'inactive', createdAt: undefined },
    ]);
  });

  it("falls back to 'default' bucket when userId is not provided", async () => {
    const integration = new ComposioToolProvider({ apiKey: 'k' });
    await integration.listConnections({ toolkit: 'gmail' }).catch(() => undefined);
    const raw = getRawInstance();
    raw.connectedAccounts.list.mockResolvedValue({ items: [] });

    await integration.listConnections({ toolkit: 'gmail' });

    expect(raw.connectedAccounts.list).toHaveBeenCalledWith({
      toolkitSlugs: ['gmail'],
      userIds: ['default'],
      limit: 50,
    });
  });

  it('forwards userIds[] for multi-bucket lookup', async () => {
    const integration = new ComposioToolProvider({ apiKey: 'k' });
    await integration.listConnections({ toolkit: 'gmail', userIds: ['user_a', 'user_b'] }).catch(() => undefined);
    const raw = getRawInstance();
    raw.connectedAccounts.list.mockResolvedValue({ items: [] });

    await integration.listConnections({ toolkit: 'gmail', userIds: ['user_a', 'user_b'] });

    expect(raw.connectedAccounts.list).toHaveBeenCalledWith({
      toolkitSlugs: ['gmail'],
      userIds: ['user_a', 'user_b'],
      limit: 50,
    });
  });

  it('short-circuits when userIds is empty', async () => {
    const integration = new ComposioToolProvider({ apiKey: 'k' });
    // Prime the SDK instance so getRawInstance() works.
    await integration.listConnections({ toolkit: 'gmail' }).catch(() => undefined);
    const raw = getRawInstance();
    raw.connectedAccounts.list.mockClear();

    const result = await integration.listConnections({ toolkit: 'gmail', userIds: [] });

    expect(result).toEqual({
      items: [],
      pagination: { page: 1, perPage: 50, hasMore: false },
    });
    expect(raw.connectedAccounts.list).not.toHaveBeenCalled();
  });

  it('clamps perPage and surfaces hasMore + per-item authorId from adapter', async () => {
    const integration = new ComposioToolProvider({ apiKey: 'k' });
    await integration.listConnections({ toolkit: 'gmail' }).catch(() => undefined);
    const raw = getRawInstance();
    raw.connectedAccounts.list.mockClear();
    raw.connectedAccounts.list.mockResolvedValue({
      items: [
        {
          id: 'ca_1',
          status: 'ACTIVE',
          isDisabled: false,
          createdAt: '2026-01-01T00:00:00Z',
          user_id: 'user_42',
        },
      ],
      nextCursor: 'next_page',
    });

    const result = await integration.listConnections({
      toolkit: 'gmail',
      userIds: ['user_42'],
      page: 1,
      perPage: 9999,
    });

    expect(raw.connectedAccounts.list).toHaveBeenCalledWith({
      toolkitSlugs: ['gmail'],
      userIds: ['user_42'],
      limit: 200,
    });
    expect(result).toEqual({
      items: [
        {
          connectionId: 'ca_1',
          status: 'active',
          createdAt: '2026-01-01T00:00:00Z',
          authorId: 'user_42',
        },
      ],
      pagination: { page: 1, perPage: 200, hasMore: true },
    });
  });
});

describe('ComposioToolProvider — getHealth', () => {
  it('returns { ok: true } when toolkits.get succeeds', async () => {
    const integration = new ComposioToolProvider({ apiKey: 'k' });
    await integration.getHealth().catch(() => undefined);
    const raw = getRawInstance();
    raw.toolkits.get.mockResolvedValue([]);
    expect(await integration.getHealth()).toEqual({ ok: true });
  });

  it('returns { ok: false, message } when toolkits.get throws', async () => {
    const integration = new ComposioToolProvider({ apiKey: 'k' });
    await integration.getHealth().catch(() => undefined);
    const raw = getRawInstance();
    raw.toolkits.get.mockRejectedValue(new Error('boom'));
    const health = await integration.getHealth();
    expect(health.ok).toBe(false);
    expect(health.message).toBe('boom');
  });
});

describe('ComposioToolProvider — revokeConnection', () => {
  beforeEach(() => {
    composioInstances.length = 0;
  });

  it('declares supportsRevoke capability', () => {
    const integration = new ComposioToolProvider({ apiKey: 'k' });
    expect(integration.capabilities.supportsRevoke).toBe(true);
  });

  it('calls composio.connectedAccounts.delete with the connection id', async () => {
    const integration = new ComposioToolProvider({ apiKey: 'k' });
    await integration.getHealth().catch(() => undefined);
    const raw = getRawInstance();
    raw.connectedAccounts.delete.mockResolvedValue({ success: true });
    await integration.revokeConnection('ca_xyz');
    expect(raw.connectedAccounts.delete).toHaveBeenCalledWith('ca_xyz');
  });

  it('throws when Composio responds with success=false', async () => {
    const integration = new ComposioToolProvider({ apiKey: 'k' });
    await integration.getHealth().catch(() => undefined);
    const raw = getRawInstance();
    raw.connectedAccounts.delete.mockResolvedValue({ success: false });
    await expect(integration.revokeConnection('ca_xyz')).rejects.toThrow(/success=false/);
  });

  it('treats a 404 statusCode error as success', async () => {
    const integration = new ComposioToolProvider({ apiKey: 'k' });
    await integration.getHealth().catch(() => undefined);
    const raw = getRawInstance();
    const err = Object.assign(new Error('Connected account not found'), { statusCode: 404 });
    raw.connectedAccounts.delete.mockRejectedValue(err);
    await expect(integration.revokeConnection('ca_missing')).resolves.toBeUndefined();
  });

  it('treats a "not found" message as success', async () => {
    const integration = new ComposioToolProvider({ apiKey: 'k' });
    await integration.getHealth().catch(() => undefined);
    const raw = getRawInstance();
    raw.connectedAccounts.delete.mockRejectedValue(new Error('connection not found'));
    await expect(integration.revokeConnection('ca_missing')).resolves.toBeUndefined();
  });

  it('rethrows non-404 errors', async () => {
    const integration = new ComposioToolProvider({ apiKey: 'k' });
    await integration.getHealth().catch(() => undefined);
    const raw = getRawInstance();
    raw.connectedAccounts.delete.mockRejectedValue(new Error('boom'));
    await expect(integration.revokeConnection('ca_xyz')).rejects.toThrow('boom');
  });
});
