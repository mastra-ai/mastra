import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MASTRA_RESOURCE_ID_KEY, RequestContext } from '@mastra/core/request-context';
import { resolveStoredToolProviders } from '@mastra/core/tool-provider';
import type { ToolProviders } from '@mastra/core/tool-provider';

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
    sessions: { create: ReturnType<typeof vi.fn> };
    connectedAccounts: {
      initiate: ReturnType<typeof vi.fn>;
      link: ReturnType<typeof vi.fn>;
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
      sessions: { create: vi.fn() },
      connectedAccounts: { initiate: vi.fn(), link: vi.fn(), get: vi.fn(), list: vi.fn(), delete: vi.fn() },
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
// Public entry-point surface (`@mastra/editor/composio`) — type-only imports
// verify the resolver types are exported where consumers import them from.
import type { ComposioUserIdResolver, ComposioUserIdResolverInput, ComposioToolProviderConfig } from '../composio';

function getRawInstance(): FakeComposioInstance {
  return composioInstances.find(i => !i.hasProvider)!;
}

function getMastraInstance(): FakeComposioInstance {
  return composioInstances.find(i => i.hasProvider)!;
}

function createRequestContext(values: Record<string, unknown>): RequestContext {
  return new RequestContext(Object.entries(values));
}

beforeEach(() => {
  composioInstances.length = 0;
});

describe('ComposioToolProvider — identity & capabilities', () => {
  it('exports the user ID resolver types from the public composio entry point', () => {
    const resolver: ComposioUserIdResolver = (input: ComposioUserIdResolverInput) => {
      const user = input.requestContext?.get('user');
      return typeof user === 'string' ? user : undefined;
    };
    const config: ComposioToolProviderConfig = { apiKey: 'k', userIdResolver: resolver };
    expect(new ComposioToolProvider(config).info.id).toBe('composio');
  });

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

  it('has no defaultScope unless configured', () => {
    const integration = new ComposioToolProvider({ apiKey: 'k' });
    expect(integration.defaultScope).toBeUndefined();
  });

  it('exposes the configured defaultScope', () => {
    const integration = new ComposioToolProvider({ apiKey: 'k', defaultScope: 'caller-supplied' });
    expect(integration.defaultScope).toBe('caller-supplied');
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

  it('injects connectedAccountId via beforeExecute, retains outputSchema, applies description override', async () => {
    const integration = new ComposioToolProvider({ apiKey: 'k' });

    await integration
      .resolveToolsVNext({ toolSlugs: ['a'], toolMeta: {}, connectionId: 'ca_1' })
      .catch(() => undefined);
    const mastra = getMastraInstance();
    mastra.tools.get.mockClear();

    const outputSchema = { type: 'object' } as unknown;
    const tool = {
      id: 'gmail.fetch_emails',
      description: 'original',
      outputSchema,
    };
    mastra.tools.get.mockResolvedValue({ 'gmail.fetch_emails': tool });

    const result = await integration.resolveToolsVNext({
      toolSlugs: ['gmail.fetch_emails'],
      toolMeta: { 'gmail.fetch_emails': { description: 'overridden' } },
      connectionId: 'ca_1',
      requestContext: createRequestContext({ [MASTRA_RESOURCE_ID_KEY]: 'user_42' }),
    });

    expect(Object.keys(result)).toEqual(['gmail.fetch_emails']);
    // The outputSchema supplied by @composio/mastra is kept: it pre-relaxes
    // Composio's strict schemas, so Mastra can validate results against it.
    expect((result['gmail.fetch_emails'] as unknown as typeof tool).outputSchema).toBe(outputSchema);
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

  it('pins connectedAccountId for pinned caller-supplied connections (deterministic routing)', async () => {
    const integration = new ComposioToolProvider({ apiKey: 'k' });

    await integration
      .resolveToolsVNext({ toolSlugs: ['a'], toolMeta: {}, connectionId: 'ca_1' })
      .catch(() => undefined);
    const mastra = getMastraInstance();
    mastra.tools.get.mockClear();
    mastra.tools.get.mockResolvedValue({ 'gmail.fetch_emails': { id: 'gmail.fetch_emails' } });

    await integration.resolveToolsVNext({
      toolSlugs: ['gmail.fetch_emails'],
      toolMeta: {},
      connectionId: 'ca_1',
      authorId: 'tenant_7',
      scope: 'caller-supplied',
      requestContext: createRequestContext({ [MASTRA_RESOURCE_ID_KEY]: 'tenant_7' }),
    });

    // User bucket is the resolved resourceId, and the pinned account routes
    // execution deterministically.
    expect(mastra.tools.get.mock.calls[0]![0]).toBe('tenant_7');
    const modifiers = mastra.tools.get.mock.calls[0]![2] as {
      beforeExecute: (a: { params: { connectedAccountId?: string } }) => unknown;
    };
    const params: { connectedAccountId?: string } = {};
    modifiers.beforeExecute({ params });
    expect(params.connectedAccountId).toBe('ca_1');
  });

  it('does not pin an account for unpinned caller-supplied bootstrap tools (connectionId === authorId)', async () => {
    const integration = new ComposioToolProvider({ apiKey: 'k' });

    await integration
      .resolveToolsVNext({ toolSlugs: ['a'], toolMeta: {}, connectionId: 'ca_1' })
      .catch(() => undefined);
    const mastra = getMastraInstance();
    mastra.tools.get.mockClear();
    mastra.tools.get.mockResolvedValue({ 'gmail.fetch_emails': { id: 'gmail.fetch_emails' } });

    await integration.resolveToolsVNext({
      toolSlugs: ['gmail.fetch_emails'],
      toolMeta: {},
      connectionId: 'tenant_7',
      authorId: 'tenant_7',
      scope: 'caller-supplied',
      requestContext: createRequestContext({ [MASTRA_RESOURCE_ID_KEY]: 'tenant_7' }),
    });

    expect(mastra.tools.get.mock.calls[0]![0]).toBe('tenant_7');
    const modifiers = mastra.tools.get.mock.calls[0]![2] as {
      beforeExecute: (a: { params: { connectedAccountId?: string } }) => unknown;
    };
    const params: { connectedAccountId?: string } = {};
    modifiers.beforeExecute({ params });
    expect(params.connectedAccountId).toBeUndefined();
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
      requestContext: createRequestContext({ [MASTRA_RESOURCE_ID_KEY]: 'author_99' }),
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
      requestContext: createRequestContext({ [MASTRA_RESOURCE_ID_KEY]: 'invoker_other' }),
    });

    expect(mastra.tools.get.mock.calls[0]![0]).toBe('author_owner');
  });

  it('resolves connection-management tools from a caller-scoped session and filters the session catalog', async () => {
    const integration = new ComposioToolProvider({ apiKey: 'k' });

    await integration.resolveToolsVNext({ toolSlugs: ['a'], toolMeta: {}, connectionId: 'ca_1' });
    const mastra = getMastraInstance();
    mastra.tools.get.mockClear();

    const manageTool = { id: 'COMPOSIO_MANAGE_CONNECTIONS', outputSchema: { type: 'object' } };
    const sessionTools = vi.fn().mockResolvedValue({
      COMPOSIO_MANAGE_CONNECTIONS: manageTool,
      COMPOSIO_WAIT_FOR_CONNECTIONS: { id: 'COMPOSIO_WAIT_FOR_CONNECTIONS' },
      COMPOSIO_SEARCH_TOOLS: { id: 'COMPOSIO_SEARCH_TOOLS' },
    });
    mastra.sessions.create.mockResolvedValue({ tools: sessionTools });

    const result = await integration.resolveToolsVNext({
      toolSlugs: ['COMPOSIO_MANAGE_CONNECTIONS'],
      toolMeta: {
        COMPOSIO_MANAGE_CONNECTIONS: { toolkit: 'composio' },
        GMAIL_FETCH_EMAILS: { toolkit: 'gmail' },
        GITHUB_GET_REPOSITORY: { toolkit: 'github' },
      },
      connectionId: 'tenant_7',
      authorId: 'agent_author_should_not_win',
      scope: 'caller-supplied',
      requestContext: createRequestContext({ [MASTRA_RESOURCE_ID_KEY]: 'tenant_7' }),
    });

    expect(mastra.tools.get).not.toHaveBeenCalled();
    expect(mastra.sessions.create).toHaveBeenCalledWith('tenant_7', {
      toolkits: ['gmail', 'github'],
      manageConnections: { enable: true, waitForConnections: true },
      sandbox: { enable: false },
    });
    expect(sessionTools).toHaveBeenCalledOnce();
    expect(Object.keys(result)).toEqual(['COMPOSIO_MANAGE_CONNECTIONS']);
    expect((result.COMPOSIO_MANAGE_CONNECTIONS as unknown as typeof manageTool).outputSchema).toEqual({
      type: 'object',
    });
  });

  it('creates distinct sessions for two callers using the same provider', async () => {
    const integration = new ComposioToolProvider({ apiKey: 'k' });

    await integration.resolveToolsVNext({ toolSlugs: ['a'], toolMeta: {}, connectionId: 'ca_1' });
    const mastra = getMastraInstance();
    mastra.tools.get.mockClear();

    const sessionToolsByCaller: Array<ReturnType<typeof vi.fn>> = [];
    mastra.sessions.create.mockImplementation(async (callerPrincipalId: string) => {
      const tools = vi.fn().mockResolvedValue({
        COMPOSIO_MANAGE_CONNECTIONS: { id: 'COMPOSIO_MANAGE_CONNECTIONS', callerPrincipalId },
      });
      sessionToolsByCaller.push(tools);
      return { tools };
    });

    const resolveForCaller = (callerPrincipalId: string) =>
      integration.resolveToolsVNext({
        toolSlugs: ['COMPOSIO_MANAGE_CONNECTIONS'],
        toolMeta: { COMPOSIO_MANAGE_CONNECTIONS: { toolkit: 'composio' } },
        connectionId: callerPrincipalId,
        authorId: callerPrincipalId,
        scope: 'caller-supplied',
        requestContext: createRequestContext({ [MASTRA_RESOURCE_ID_KEY]: callerPrincipalId }),
      });

    const [callerATools, callerBTools] = await Promise.all([
      resolveForCaller('caller_a'),
      resolveForCaller('caller_b'),
    ]);

    expect(mastra.sessions.create.mock.calls.map(call => call[0])).toEqual(['caller_a', 'caller_b']);
    expect(sessionToolsByCaller).toHaveLength(2);
    expect(sessionToolsByCaller[0]).not.toBe(sessionToolsByCaller[1]);
    expect(callerATools.COMPOSIO_MANAGE_CONNECTIONS).not.toBe(callerBTools.COMPOSIO_MANAGE_CONNECTIONS);
    expect(mastra.tools.get).not.toHaveBeenCalled();
  });

  it('merges direct and session tools and applies overrides to both paths', async () => {
    const integration = new ComposioToolProvider({ apiKey: 'k' });

    await integration.resolveToolsVNext({ toolSlugs: ['a'], toolMeta: {}, connectionId: 'ca_1' });
    const mastra = getMastraInstance();
    mastra.tools.get.mockClear();

    const gmailTool = { id: 'GMAIL_FETCH_EMAILS', description: 'gmail original', outputSchema: {} };
    const waitTool = {
      id: 'COMPOSIO_WAIT_FOR_CONNECTIONS',
      description: 'wait original',
      outputSchema: {},
    };
    mastra.tools.get.mockResolvedValue({ GMAIL_FETCH_EMAILS: gmailTool });
    mastra.sessions.create.mockResolvedValue({
      tools: vi.fn().mockResolvedValue({ COMPOSIO_WAIT_FOR_CONNECTIONS: waitTool }),
    });

    const result = await integration.resolveToolsVNext({
      toolSlugs: ['GMAIL_FETCH_EMAILS', 'COMPOSIO_WAIT_FOR_CONNECTIONS'],
      toolMeta: {
        GMAIL_FETCH_EMAILS: { toolkit: 'gmail', description: 'gmail override' },
        COMPOSIO_WAIT_FOR_CONNECTIONS: { toolkit: 'composio', description: 'wait override' },
      },
      connectionId: 'ca_1',
      authorId: 'author_1',
      scope: 'per-author',
    });

    expect(mastra.tools.get).toHaveBeenCalledWith('author_1', { tools: ['GMAIL_FETCH_EMAILS'] }, expect.any(Object));
    expect(mastra.sessions.create).toHaveBeenCalledWith('author_1', {
      toolkits: ['gmail'],
      manageConnections: { enable: true, waitForConnections: true },
      sandbox: { enable: false },
    });
    expect(Object.keys(result)).toEqual(['GMAIL_FETCH_EMAILS', 'COMPOSIO_WAIT_FOR_CONNECTIONS']);
    expect(gmailTool).toMatchObject({ description: 'gmail override', outputSchema: {} });
    expect(waitTool).toMatchObject({ description: 'wait override', outputSchema: {} });

    const modifiers = mastra.tools.get.mock.calls[0]![2] as {
      beforeExecute: (a: { params: { connectedAccountId?: string } }) => unknown;
    };
    const params: { connectedAccountId?: string } = {};
    modifiers.beforeExecute({ params });
    expect(params.connectedAccountId).toBe('ca_1');
  });

  it.each([
    {
      name: 'session creation',
      arrange: (mastra: FakeComposioInstance) =>
        mastra.sessions.create.mockRejectedValue(new Error('session unavailable')),
    },
    {
      name: 'session tool resolution',
      arrange: (mastra: FakeComposioInstance) =>
        mastra.sessions.create.mockResolvedValue({
          tools: vi.fn().mockRejectedValue(new Error('session unavailable')),
        }),
    },
  ])('surfaces $name errors without falling back to direct tools', async ({ arrange }) => {
    const integration = new ComposioToolProvider({ apiKey: 'k' });

    await integration.resolveToolsVNext({ toolSlugs: ['a'], toolMeta: {}, connectionId: 'ca_1' });
    const mastra = getMastraInstance();
    mastra.tools.get.mockClear();
    arrange(mastra);

    await expect(
      integration.resolveToolsVNext({
        toolSlugs: ['COMPOSIO_MANAGE_CONNECTIONS'],
        toolMeta: { COMPOSIO_MANAGE_CONNECTIONS: { toolkit: 'composio' } },
        connectionId: 'tenant_7',
        authorId: 'tenant_7',
        scope: 'caller-supplied',
      }),
    ).rejects.toThrow('session unavailable');
    expect(mastra.tools.get).not.toHaveBeenCalled();
  });
});

describe('ComposioToolProvider — invoker identity', () => {
  const MASTRA_USER_KEY = 'mastra__user';

  function getBeforeExecute(mastra: FakeComposioInstance) {
    return mastra.tools.get.mock.calls[0]![2] as {
      beforeExecute: (a: { params: { connectedAccountId?: string } }) => unknown;
    };
  }

  it('executes invoker connections as the authenticated user, never the Memory resource id', async () => {
    const integration = new ComposioToolProvider({ apiKey: 'k' });

    await integration
      .resolveToolsVNext({ toolSlugs: ['a'], toolMeta: {}, connectionId: 'ca_1' })
      .catch(() => undefined);
    const mastra = getMastraInstance();
    mastra.tools.get.mockClear();
    mastra.tools.get.mockResolvedValue({});

    await integration.resolveToolsVNext({
      toolSlugs: ['salesforce.create_lead'],
      toolMeta: {},
      connectionId: 'ca_alice_salesforce',
      kind: 'invoker',
      toolkit: 'salesforce',
      requestContext: createRequestContext({
        [MASTRA_RESOURCE_ID_KEY]: 'project_123',
        [MASTRA_USER_KEY]: { id: 'bob' },
      }),
    });

    // User bucket = authenticated invoker, not the memory resource id.
    expect(mastra.tools.get.mock.calls[0]![0]).toBe('bob');
    // Execution routes to the exact pinned (shared) account.
    const params: { connectedAccountId?: string } = {};
    getBeforeExecute(mastra).beforeExecute({ params });
    expect(params.connectedAccountId).toBe('ca_alice_salesforce');
  });

  it('rejects invoker connections without an authenticated user or identity resolver', async () => {
    const integration = new ComposioToolProvider({ apiKey: 'k' });

    await expect(
      integration.resolveToolsVNext({
        toolSlugs: ['gmail.fetch_emails'],
        toolMeta: {},
        connectionId: 'ca_1',
        kind: 'invoker',
        toolkit: 'gmail',
        requestContext: createRequestContext({ [MASTRA_RESOURCE_ID_KEY]: 'project_123' }),
      }),
    ).rejects.toThrow('requires an authenticated user or a userIdResolver');
  });

  it('normalizes the userIdResolver result while the stored pin routes the account', async () => {
    const userIdResolver = vi.fn(async () => '  bob  ');
    const integration = new ComposioToolProvider({ apiKey: 'k', userIdResolver });

    await integration
      .resolveToolsVNext({ toolSlugs: ['a'], toolMeta: {}, connectionId: 'ca_1' })
      .catch(() => undefined);
    const mastra = getMastraInstance();
    mastra.tools.get.mockClear();
    mastra.tools.get.mockResolvedValue({});

    const requestContext = createRequestContext({ [MASTRA_USER_KEY]: { id: 'someone_else' } });
    await integration.resolveToolsVNext({
      toolSlugs: ['salesforce.create_lead'],
      toolMeta: {},
      connectionId: 'ca_requested',
      kind: 'invoker',
      toolkit: 'salesforce',
      requestContext,
    });

    expect(userIdResolver).toHaveBeenCalledWith({
      requestContext,
      toolkit: 'salesforce',
      connectedAccountId: 'ca_requested',
    });
    expect(mastra.tools.get.mock.calls[0]![0]).toBe('bob');
    const params: { connectedAccountId?: string } = {};
    getBeforeExecute(mastra).beforeExecute({ params });
    // The resolver cannot override the account — the stored pin routes it.
    expect(params.connectedAccountId).toBe('ca_requested');
  });

  it('consults the userIdResolver with the live RequestContext', async () => {
    const requestContext = createRequestContext({ [MASTRA_RESOURCE_ID_KEY]: 'tenant_7' });
    const userIdResolver = vi.fn(async ({ requestContext: context }: ComposioUserIdResolverInput) => {
      expect(context).toBe(requestContext);
      expect(context?.getRaw(MASTRA_RESOURCE_ID_KEY)).toBe('tenant_7');
      return 'bob';
    });
    const integration = new ComposioToolProvider({ apiKey: 'k', userIdResolver });

    await integration
      .resolveToolsVNext({ toolSlugs: ['a'], toolMeta: {}, connectionId: 'ca_1' })
      .catch(() => undefined);
    const mastra = getMastraInstance();
    mastra.tools.get.mockClear();
    mastra.tools.get.mockResolvedValue({});

    await integration.resolveToolsVNext({
      toolSlugs: ['gmail.fetch_emails'],
      toolMeta: {},
      connectionId: 'tenant_7',
      authorId: 'tenant_7',
      scope: 'caller-supplied',
      toolkit: 'gmail',
      requestContext,
    });

    expect(userIdResolver).toHaveBeenCalledWith({
      requestContext,
      toolkit: 'gmail',
      connectedAccountId: undefined,
    });
    expect(mastra.tools.get.mock.calls[0]![0]).toBe('bob');
    // No account pin exists — Composio auto-resolves within the bucket.
    const params: { connectedAccountId?: string } = {};
    getBeforeExecute(mastra).beforeExecute({ params });
    expect(params.connectedAccountId).toBeUndefined();
  });

  it('falls back to the authenticated user when the userIdResolver returns undefined', async () => {
    const userIdResolver = vi.fn(async () => undefined);
    const integration = new ComposioToolProvider({ apiKey: 'k', userIdResolver });

    await integration
      .resolveToolsVNext({ toolSlugs: ['a'], toolMeta: {}, connectionId: 'ca_1' })
      .catch(() => undefined);
    const mastra = getMastraInstance();
    mastra.tools.get.mockClear();
    mastra.tools.get.mockResolvedValue({});

    await integration.resolveToolsVNext({
      toolSlugs: ['salesforce.create_lead'],
      toolMeta: {},
      connectionId: 'ca_alice_salesforce',
      kind: 'invoker',
      toolkit: 'salesforce',
      requestContext: createRequestContext({ [MASTRA_USER_KEY]: { id: 'bob' } }),
    });

    expect(userIdResolver).toHaveBeenCalledOnce();
    expect(mastra.tools.get.mock.calls[0]![0]).toBe('bob');
  });

  it('rejects a userIdResolver that returns an empty userId instead of silently falling back', async () => {
    const userIdResolver = vi.fn(async () => '');
    const integration = new ComposioToolProvider({ apiKey: 'k', userIdResolver });

    await expect(
      integration.resolveToolsVNext({
        toolSlugs: ['gmail.fetch_emails'],
        toolMeta: {},
        connectionId: 'ca_1',
        kind: 'invoker',
        toolkit: 'gmail',
        requestContext: createRequestContext({ [MASTRA_USER_KEY]: { id: 'bob' } }),
      }),
    ).rejects.toThrow('userIdResolver must return a non-empty string or undefined');
  });
});

describe('ComposioToolProvider — stored-config runtime integration', () => {
  const MASTRA_USER_KEY = 'mastra__user';

  it('routes a stored invoker pin through the runtime fan-out as the authenticated user against the exact account', async () => {
    const integration = new ComposioToolProvider({ apiKey: 'k' });

    await integration
      .resolveToolsVNext({ toolSlugs: ['a'], toolMeta: {}, connectionId: 'ca_1' })
      .catch(() => undefined);
    const mastra = getMastraInstance();
    mastra.tools.get.mockClear();
    mastra.tools.get.mockResolvedValue({
      SALESFORCE_CREATE_LEAD: { id: 'SALESFORCE_CREATE_LEAD', description: 'Create a lead' },
    });

    // The stored agent config shape persisted by Agent Builder.
    const stored: ToolProviders = {
      composio: {
        tools: { SALESFORCE_CREATE_LEAD: { toolkit: 'salesforce' } },
        connections: {
          salesforce: [
            {
              kind: 'invoker',
              toolkit: 'salesforce',
              connectionId: 'ca_alice_salesforce',
              scope: 'per-author',
            },
          ],
        },
      },
    };

    const tools = await resolveStoredToolProviders(stored, () => integration, {
      requestContext: createRequestContext({
        [MASTRA_RESOURCE_ID_KEY]: 'project_123',
        [MASTRA_USER_KEY]: { id: 'bob' },
      }),
      authorId: 'agent_author',
    });

    // The runtime fan-out reached Composio as the authenticated invoker —
    // not the Memory resource id or the agent author.
    expect(mastra.tools.get.mock.calls[0]![0]).toBe('bob');
    // The materialised tool exists under its natural slug…
    expect(tools['SALESFORCE_CREATE_LEAD']).toBeDefined();
    // …and execution routes to the exact pinned (shared) account.
    const modifiers = mastra.tools.get.mock.calls[0]![2] as {
      beforeExecute: (a: { params: { connectedAccountId?: string } }) => unknown;
    };
    const params: { connectedAccountId?: string } = {};
    modifiers.beforeExecute({ params });
    expect(params.connectedAccountId).toBe('ca_alice_salesforce');
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
    raw.connectedAccounts.link.mockResolvedValue({ id: 'ca_new', redirectUrl: 'https://oauth' });

    const result = await integration.authorize({ toolkit: 'gmail', connectionId: 'author_1' });

    expect(raw.authConfigs.list).toHaveBeenCalledWith({ toolkit: 'gmail' });
    expect(raw.connectedAccounts.link).toHaveBeenCalledWith('author_1', 'ac_1');
    expect(raw.connectedAccounts.initiate).not.toHaveBeenCalled();
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

  it('uses link (no config) when an empty config object is supplied', async () => {
    const integration = new ComposioToolProvider({ apiKey: 'k' });
    await integration.authorize({ toolkit: 'gmail', connectionId: 'a' }).catch(() => undefined);
    const raw = getRawInstance();

    raw.authConfigs.list.mockResolvedValue({
      items: [{ id: 'ac_1', status: 'ENABLED', authScheme: 'OAUTH2' }],
    });
    raw.connectedAccounts.link.mockResolvedValue({ id: 'ca_new', redirectUrl: 'https://oauth' });

    await integration.authorize({ toolkit: 'gmail', connectionId: 'a', config: {} });

    expect(raw.connectedAccounts.link).toHaveBeenCalledWith('a', 'ac_1');
    expect(raw.connectedAccounts.initiate).not.toHaveBeenCalled();
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
