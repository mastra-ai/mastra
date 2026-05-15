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
    toolkits: { get: ReturnType<typeof vi.fn> };
    tools: { get: ReturnType<typeof vi.fn>; getRawComposioTools: ReturnType<typeof vi.fn> };
    connectedAccounts: {
      initiate: ReturnType<typeof vi.fn>;
      get: ReturnType<typeof vi.fn>;
      list: ReturnType<typeof vi.fn>;
    };
    authConfigs: { list: ReturnType<typeof vi.fn> };
  }

  const instances: FakeComposioInstance[] = [];

  const factory = (opts: { apiKey: string; provider?: unknown }): FakeComposioInstance => {
    const inst: FakeComposioInstance = {
      apiKey: opts.apiKey,
      hasProvider: Boolean(opts.provider),
      toolkits: { get: vi.fn() },
      tools: { get: vi.fn(), getRawComposioTools: vi.fn() },
      connectedAccounts: { initiate: vi.fn(), get: vi.fn(), list: vi.fn() },
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
import { ComposioToolIntegration } from './composio-integration';

function getRawInstance(): FakeComposioInstance {
  return composioInstances.find(i => !i.hasProvider)!;
}

function getMastraInstance(): FakeComposioInstance {
  return composioInstances.find(i => i.hasProvider)!;
}

beforeEach(() => {
  composioInstances.length = 0;
});

describe('ComposioToolIntegration — identity & capabilities', () => {
  it('has literal id "composio" and full capabilities', () => {
    const integration = new ComposioToolIntegration({ apiKey: 'k' });
    expect(integration.id).toBe('composio');
    expect(integration.displayName).toBe('Composio');
    expect(integration.capabilities).toEqual({
      multipleConnectionsPerService: true,
      batchConnectionStatus: true,
      reauthorizeReusesConnectionId: true,
    });
  });
});

describe('ComposioToolIntegration — catalog allowlist', () => {
  it('listToolServices honors allowedToolServices', async () => {
    const integration = new ComposioToolIntegration({
      apiKey: 'k',
      allowedToolServices: ['gmail'],
    });

    // Trigger client construction.
    await integration.listToolServices().catch(() => undefined);
    const raw = getRawInstance();

    raw.toolkits.get.mockResolvedValue([
      { slug: 'gmail', name: 'Gmail', meta: { description: 'mail', logo: 'l' } },
      { slug: 'slack', name: 'Slack', meta: { description: 'chat', logo: 'l' } },
    ]);

    const services = await integration.listToolServices();
    expect(services.data.map(s => s.slug)).toEqual(['gmail']);
  });

  it('listTools honors allowedTools glob (gmail.*)', async () => {
    const integration = new ComposioToolIntegration({
      apiKey: 'k',
      allowedTools: ['gmail.*'],
    });

    await integration.listTools({ toolService: 'gmail' }).catch(() => undefined);
    const raw = getRawInstance();

    raw.tools.getRawComposioTools.mockResolvedValue([
      { slug: 'gmail.fetch_emails', name: 'Fetch', description: 'd', toolkit: { slug: 'gmail' } },
      { slug: 'gmail.send_email', name: 'Send', description: 'd', toolkit: { slug: 'gmail' } },
    ]);

    const tools = await integration.listTools({ toolService: 'gmail' });
    expect(tools.data.map(t => t.slug)).toEqual(['gmail.fetch_emails', 'gmail.send_email']);

    // Now narrow.
    const narrow = new ComposioToolIntegration({
      apiKey: 'k',
      allowedTools: ['gmail.fetch_emails'],
    });
    await narrow.listTools({ toolService: 'gmail' }).catch(() => undefined);
    const narrowRaw = composioInstances.filter(i => !i.hasProvider).at(-1)!;
    narrowRaw.tools.getRawComposioTools.mockResolvedValue([
      { slug: 'gmail.fetch_emails', name: 'Fetch', description: 'd', toolkit: { slug: 'gmail' } },
      { slug: 'gmail.send_email', name: 'Send', description: 'd', toolkit: { slug: 'gmail' } },
    ]);
    const filtered = await narrow.listTools({ toolService: 'gmail' });
    expect(filtered.data.map(t => t.slug)).toEqual(['gmail.fetch_emails']);
  });

  it('listTools forwards search + pagination to getRawComposioTools and reports hasMore', async () => {
    const integration = new ComposioToolIntegration({ apiKey: 'k' });
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

  it('listTools with toolService scopes the SDK query and forwards search', async () => {
    const integration = new ComposioToolIntegration({ apiKey: 'k' });
    await integration.listTools({ toolService: 'gmail' }).catch(() => undefined);
    const raw = getRawInstance();
    raw.tools.getRawComposioTools.mockClear();
    raw.tools.getRawComposioTools.mockResolvedValue([]);

    await integration.listTools({ toolService: 'gmail', search: 'send', perPage: 50 });

    expect(raw.tools.getRawComposioTools).toHaveBeenCalledWith({
      toolkits: ['gmail'],
      limit: 50,
      search: 'send',
    });
  });
});

describe('ComposioToolIntegration — resolveTools', () => {
  it('returns {} when toolSlugs is empty without calling the SDK', async () => {
    const integration = new ComposioToolIntegration({ apiKey: 'k' });
    const result = await integration.resolveTools({
      toolSlugs: [],
      toolMeta: {},
      connectionId: 'ca_x',
    });
    expect(result).toEqual({});
    expect(composioInstances.length).toBe(0);
  });

  it('injects connectedAccountId via beforeExecute, clears outputSchema, applies description override', async () => {
    const integration = new ComposioToolIntegration({ apiKey: 'k' });

    await integration.resolveTools({ toolSlugs: ['a'], toolMeta: {}, connectionId: 'ca_1' }).catch(() => undefined);
    const mastra = getMastraInstance();
    mastra.tools.get.mockClear();

    const tool = {
      id: 'gmail.fetch_emails',
      description: 'original',
      outputSchema: { not: 'undefined' } as unknown,
    };
    mastra.tools.get.mockResolvedValue({ 'gmail.fetch_emails': tool });

    const result = await integration.resolveTools({
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
    const integration = new ComposioToolIntegration({ apiKey: 'k' });

    await integration.resolveTools({ toolSlugs: ['a'], toolMeta: {}, connectionId: 'ca_1' }).catch(() => undefined);
    const mastra = getMastraInstance();
    mastra.tools.get.mockClear();
    mastra.tools.get.mockResolvedValue({});

    await integration.resolveTools({
      toolSlugs: ['gmail.fetch_emails'],
      toolMeta: {},
      connectionId: 'ca_1',
    });

    expect(mastra.tools.get.mock.calls[0]![0]).toBe('default');
  });

  it('reads MASTRA_RESOURCE_ID_KEY from requestContext when present', async () => {
    const integration = new ComposioToolIntegration({ apiKey: 'k' });

    await integration.resolveTools({ toolSlugs: ['a'], toolMeta: {}, connectionId: 'ca_1' }).catch(() => undefined);
    const mastra = getMastraInstance();
    mastra.tools.get.mockClear();
    mastra.tools.get.mockResolvedValue({});

    await integration.resolveTools({
      toolSlugs: ['gmail.fetch_emails'],
      toolMeta: {},
      connectionId: 'ca_1',
      requestContext: { [MASTRA_RESOURCE_ID_KEY]: 'author_99' },
    });

    expect(mastra.tools.get.mock.calls[0]![0]).toBe('author_99');
  });

  it('prefers opts.authorId over requestContext when supplied (author-bound pin)', async () => {
    const integration = new ComposioToolIntegration({ apiKey: 'k' });

    await integration.resolveTools({ toolSlugs: ['a'], toolMeta: {}, connectionId: 'ca_1' }).catch(() => undefined);
    const mastra = getMastraInstance();
    mastra.tools.get.mockClear();
    mastra.tools.get.mockResolvedValue({});

    await integration.resolveTools({
      toolSlugs: ['gmail.fetch_emails'],
      toolMeta: {},
      connectionId: 'ca_1',
      authorId: 'author_owner',
      requestContext: { [MASTRA_RESOURCE_ID_KEY]: 'invoker_other' },
    });

    expect(mastra.tools.get.mock.calls[0]![0]).toBe('author_owner');
  });
});

describe('ComposioToolIntegration — authorize', () => {
  it('resolves the single ENABLED auth config and returns { url, authId }', async () => {
    const integration = new ComposioToolIntegration({ apiKey: 'k' });

    await integration.authorize({ toolService: 'gmail', connectionId: 'author_1' }).catch(() => undefined);
    const raw = getRawInstance();

    raw.authConfigs.list.mockResolvedValue({
      items: [
        { id: 'ac_1', status: 'ENABLED' },
        { id: 'ac_2', status: 'DISABLED' },
      ],
    });
    raw.connectedAccounts.initiate.mockResolvedValue({ id: 'ca_new', redirectUrl: 'https://oauth' });

    const result = await integration.authorize({ toolService: 'gmail', connectionId: 'author_1' });

    expect(raw.authConfigs.list).toHaveBeenCalledWith({ toolkit: 'gmail' });
    expect(raw.connectedAccounts.initiate).toHaveBeenCalledWith('author_1', 'ac_1', { allowMultiple: true });
    expect(result).toEqual({ url: 'https://oauth', authId: 'ca_new' });
  });

  it('throws if zero ENABLED auth configs match', async () => {
    const integration = new ComposioToolIntegration({ apiKey: 'k' });
    await integration.authorize({ toolService: 'gmail', connectionId: 'a' }).catch(() => undefined);
    const raw = getRawInstance();
    raw.authConfigs.list.mockResolvedValue({ items: [{ id: 'ac_1', status: 'DISABLED' }] });

    await expect(integration.authorize({ toolService: 'gmail', connectionId: 'a' })).rejects.toThrow(
      /No ENABLED auth config/,
    );
  });

  it('throws if multiple ENABLED auth configs match', async () => {
    const integration = new ComposioToolIntegration({ apiKey: 'k' });
    await integration.authorize({ toolService: 'gmail', connectionId: 'a' }).catch(() => undefined);
    const raw = getRawInstance();
    raw.authConfigs.list.mockResolvedValue({
      items: [
        { id: 'ac_1', status: 'ENABLED' },
        { id: 'ac_2', status: 'ENABLED' },
      ],
    });

    await expect(integration.authorize({ toolService: 'gmail', connectionId: 'a' })).rejects.toThrow(
      /Multiple ENABLED auth configs/,
    );
  });
});

describe('ComposioToolIntegration — getAuthStatus', () => {
  it('maps Composio account status → AuthFlowStatus', async () => {
    const integration = new ComposioToolIntegration({ apiKey: 'k' });
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

describe('ComposioToolIntegration — getConnectionStatus', () => {
  it('makes exactly one SDK call for N items and buckets results by connectionId', async () => {
    const integration = new ComposioToolIntegration({ apiKey: 'k' });
    await integration
      .getConnectionStatus({ items: [{ connectionId: 'x', toolService: 'gmail' }] })
      .catch(() => undefined);
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
        { connectionId: 'ca_active', toolService: 'gmail' },
        { connectionId: 'ca_inactive', toolService: 'gmail' },
        { connectionId: 'ca_disabled', toolService: 'slack' },
        { connectionId: 'ca_missing', toolService: 'gmail' },
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
    const integration = new ComposioToolIntegration({ apiKey: 'k' });
    const result = await integration.getConnectionStatus({ items: [] });
    expect(result).toEqual({});
    expect(composioInstances.length).toBe(0);
  });
});

describe('ComposioToolIntegration — listConnections', () => {
  it('forwards toolService + userId and maps SDK items', async () => {
    const integration = new ComposioToolIntegration({ apiKey: 'k' });
    await integration.listConnections({ toolService: 'gmail', userId: 'user_42' }).catch(() => undefined);
    const raw = getRawInstance();
    raw.connectedAccounts.list.mockResolvedValue({
      items: [
        { id: 'ca_1', status: 'ACTIVE', isDisabled: false, createdAt: '2026-01-01T00:00:00Z' },
        { id: 'ca_2', status: 'INACTIVE', isDisabled: false },
        { id: 'ca_3', status: 'ACTIVE', isDisabled: true },
      ],
    });

    const result = await integration.listConnections({ toolService: 'gmail', userId: 'user_42' });

    expect(raw.connectedAccounts.list).toHaveBeenCalledWith({
      toolkitSlugs: ['gmail'],
      userIds: ['user_42'],
    });
    expect(result.items).toEqual([
      { connectionId: 'ca_1', status: 'active', createdAt: '2026-01-01T00:00:00Z' },
      { connectionId: 'ca_2', status: 'inactive', createdAt: undefined },
      { connectionId: 'ca_3', status: 'inactive', createdAt: undefined },
    ]);
  });

  it("falls back to 'default' bucket when userId is not provided", async () => {
    const integration = new ComposioToolIntegration({ apiKey: 'k' });
    await integration.listConnections({ toolService: 'gmail' }).catch(() => undefined);
    const raw = getRawInstance();
    raw.connectedAccounts.list.mockResolvedValue({ items: [] });

    await integration.listConnections({ toolService: 'gmail' });

    expect(raw.connectedAccounts.list).toHaveBeenCalledWith({
      toolkitSlugs: ['gmail'],
      userIds: ['default'],
    });
  });
});

describe('ComposioToolIntegration — getHealth', () => {
  it('returns { ok: true } when toolkits.get succeeds', async () => {
    const integration = new ComposioToolIntegration({ apiKey: 'k' });
    await integration.getHealth().catch(() => undefined);
    const raw = getRawInstance();
    raw.toolkits.get.mockResolvedValue([]);
    expect(await integration.getHealth()).toEqual({ ok: true });
  });

  it('returns { ok: false, message } when toolkits.get throws', async () => {
    const integration = new ComposioToolIntegration({ apiKey: 'k' });
    await integration.getHealth().catch(() => undefined);
    const raw = getRawInstance();
    raw.toolkits.get.mockRejectedValue(new Error('boom'));
    const health = await integration.getHealth();
    expect(health.ok).toBe(false);
    expect(health.message).toBe('boom');
  });
});
