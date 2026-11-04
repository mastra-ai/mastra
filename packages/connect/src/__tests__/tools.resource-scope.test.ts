import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PROVIDERS } from '../registry.js';
import type { ProviderRegistration, ProxyProviderRegistration } from '../registry.js';
import { __clearSharedToolsStateForTests, __sharedToolsStateCountForTests, tools as connect } from '../tools.js';
import type { ToolsOptions as ConnectOptions } from '../tools.js';

// Test-only seam: the shipped barrel exports a readonly view; tests mutate the
// underlying array to install fixture providers.
const testProviders = PROVIDERS as ProviderRegistration[];

const TOKEN = 'fake-test-token';

function installProvider(
  integrationId: string,
  envVar: string,
): ProxyProviderRegistration & { createToolsSpy: ReturnType<typeof vi.fn> } {
  const createTools = vi
    .fn()
    .mockReturnValue({ [`${integrationId}_fake_tool`]: { id: `${integrationId}_fake_tool` } } as never);
  const registration = { integrationId, envVar, createTools };
  testProviders.push(registration);
  return { ...registration, createToolsSpy: createTools };
}

function makeConnection(overrides?: Record<string, unknown>) {
  return {
    id: 'c_lin1',
    integrationId: 'linear',
    status: 'active',
    connectedByUserId: 'user_1',
    connectedAt: '2026-09-01T00:00:00Z',
    createdAt: '2026-09-01T00:00:00Z',
    accountLabel: 'Acme',
    resourceId: null,
    ...overrides,
  };
}

interface SeenRequest {
  url: URL;
  headers: Headers;
}

/**
 * Platform fetch fixture that serves the connection list scoped the way the
 * real platform does: no params → global-only; `resourceId=X&includeGlobal=true`
 * → global + that resource's rows.
 */
function scopedPlatform(connections: () => Array<Record<string, unknown>>) {
  const requests: SeenRequest[] = [];
  const fetchMock = vi.fn().mockImplementation(async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    requests.push({ url, headers: new Headers(init?.headers) });
    if (url.pathname === '/v2/integrations') return Response.json({ integrations: [] });
    const resourceId = url.searchParams.get('resourceId');
    const rows = connections().filter(connection =>
      resourceId === null
        ? connection.resourceId === null
        : connection.resourceId === null || connection.resourceId === resourceId,
    );
    return Response.json({ connections: rows });
  });
  const options = {
    projectId: 'proj_1',
    client: { accessToken: TOKEN, baseUrl: 'https://example.test', fetch: fetchMock as unknown as typeof fetch },
  } satisfies ConnectOptions;
  const connectionLists = () => requests.filter(request => request.url.pathname.endsWith('/connections'));
  return { fetchMock, options, requests, connectionLists };
}

let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  testProviders.length = 0;
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(async () => {
  testProviders.length = 0;
  vi.useRealTimers();
  await __clearSharedToolsStateForTests();
  warnSpy.mockRestore();
});

describe('resource-scoped resolution', () => {
  it('lists global + resource connections and asserts the resource header on platform calls', async () => {
    installProvider('linear', 'MASTRA_LINEAR_CONNECTION_ID');
    installProvider('notion', 'MASTRA_NOTION_CONNECTION_ID');
    const platform = scopedPlatform(() => [
      makeConnection(),
      makeConnection({ id: 'c_not1', integrationId: 'notion', resourceId: 'end-user-42' }),
    ]);
    const tools = connect({ ...platform.options, resourceId: 'end-user-42' });

    const result = await tools();
    // Resource-scoped records also carry the built-in connect-prompt tool.
    expect(Object.keys(result).sort()).toEqual(['linear_fake_tool', 'notion_fake_tool', 'request_connection']);

    const [list] = platform.connectionLists();
    expect(list!.url.searchParams.get('resourceId')).toBe('end-user-42');
    expect(list!.url.searchParams.get('includeGlobal')).toBe('true');
    // Every platform call under the scope asserts the resource key.
    for (const request of platform.requests) {
      expect(request.headers.get('x-mastra-resource-id')).toBe('end-user-42');
    }
  });

  it('composes callback options with resource scoping and project attribution', async () => {
    installProvider('linear', 'MASTRA_LINEAR_CONNECTION_ID');
    installProvider('notion', 'MASTRA_NOTION_CONNECTION_ID');
    installProvider('slack', 'MASTRA_SLACK_CONNECTION_ID');
    const platform = scopedPlatform(() => [
      makeConnection(),
      makeConnection({ id: 'c_not1', integrationId: 'notion', resourceId: 'user-a' }),
      makeConnection({ id: 'c_slk1', integrationId: 'slack', resourceId: 'user-b' }),
    ]);
    const resolver = connect(ctx => ({
      ...platform.options,
      resourceId: (ctx?.requestContext as { userId?: string } | undefined)?.userId,
    }));

    expect(Object.keys(await resolver({ requestContext: { userId: 'user-a' } })).sort()).toEqual([
      'linear_fake_tool',
      'notion_fake_tool',
      'request_connection',
    ]);
    expect(Object.keys(await resolver({ requestContext: { userId: 'user-b' } })).sort()).toEqual([
      'linear_fake_tool',
      'request_connection',
      'slack_fake_tool',
    ]);

    const lists = platform.connectionLists();
    expect(lists.map(request => request.url.searchParams.get('resourceId'))).toEqual(['user-a', 'user-b']);
    for (const request of platform.requests) {
      expect(request.headers.get('x-mastra-project-id')).toBe('proj_1');
      expect(request.headers.get('x-mastra-resource-id')).toMatch(/^user-[ab]$/);
    }
  });

  it('keeps shared resource snapshots when callback variants exceed the wrapper cache', async () => {
    installProvider('linear', 'MASTRA_LINEAR_CONNECTION_ID');
    const platform = scopedPlatform(() => [makeConnection()]);
    const resolver = connect(ctx => ({
      ...platform.options,
      resourceId: `user-${String(ctx?.requestContext)}`,
    }));

    for (let index = 0; index < 33; index++) {
      await resolver({ requestContext: index });
    }
    const callsAfterVariants = platform.fetchMock.mock.calls.length;

    // The options-wrapper LRU is capped at 32, but all resource variants share
    // one state whose resource-snapshot LRU is capped separately at 50.
    await resolver({ requestContext: 31 });
    expect(platform.fetchMock).toHaveBeenCalledTimes(callsAfterVariants);
  });

  it('keeps the unscoped resolver global-only with no scoping params or header', async () => {
    installProvider('linear', 'MASTRA_LINEAR_CONNECTION_ID');
    installProvider('notion', 'MASTRA_NOTION_CONNECTION_ID');
    const platform = scopedPlatform(() => [
      makeConnection(),
      makeConnection({ id: 'c_not1', integrationId: 'notion', resourceId: 'end-user-42' }),
    ]);
    const tools = connect(platform.options);

    const result = await tools();
    expect(Object.keys(result)).toEqual(['linear_fake_tool']);

    const [list] = platform.connectionLists();
    expect(list!.url.search).toBe('');
    expect(list!.headers.get('x-mastra-resource-id')).toBeNull();
  });

  it('caches snapshots per resource: two resources and the global scope resolve independently', async () => {
    installProvider('linear', 'MASTRA_LINEAR_CONNECTION_ID');
    installProvider('notion', 'MASTRA_NOTION_CONNECTION_ID');
    installProvider('slack', 'MASTRA_SLACK_CONNECTION_ID');
    const platform = scopedPlatform(() => [
      makeConnection(),
      makeConnection({ id: 'c_not1', integrationId: 'notion', resourceId: 'user-a' }),
      makeConnection({ id: 'c_slk1', integrationId: 'slack', resourceId: 'user-b' }),
    ]);

    const forUserA = await connect({ ...platform.options, resourceId: 'user-a' })();
    const forUserB = await connect({ ...platform.options, resourceId: 'user-b' })();
    const globalOnly = await connect(platform.options)();

    expect(Object.keys(forUserA).sort()).toEqual(['linear_fake_tool', 'notion_fake_tool', 'request_connection']);
    expect(Object.keys(forUserB).sort()).toEqual(['linear_fake_tool', 'request_connection', 'slack_fake_tool']);
    // Global-only resolutions never include the connect-prompt tool.
    expect(Object.keys(globalOnly)).toEqual(['linear_fake_tool']);
  });

  it('shares one internal state across per-request tools() calls with identical options', async () => {
    installProvider('linear', 'MASTRA_LINEAR_CONNECTION_ID');
    const platform = scopedPlatform(() => [makeConnection()]);

    // The per-request pattern: a fresh tools() call per resolution.
    await connect({ ...platform.options, resourceId: 'user-a' })();
    const callsAfterFirst = platform.fetchMock.mock.calls.length;
    await connect({ ...platform.options, resourceId: 'user-a' })();

    // Same options + same resource within the TTL: served from the shared
    // snapshot, no second platform round trip.
    expect(platform.fetchMock.mock.calls.length).toBe(callsAfterFirst);

    // A different resource key fetches its own snapshot through the same state.
    await connect({ ...platform.options, resourceId: 'user-b' })();
    expect(platform.fetchMock.mock.calls.length).toBeGreaterThan(callsAfterFirst);
  });

  it('bounds the shared-state registry: distinct option sets evict least recently acquired', async () => {
    installProvider('linear', 'MASTRA_LINEAR_CONNECTION_ID');
    const platform = scopedPlatform(() => [makeConnection()]);

    // Each distinct access token mints its own state (e.g. per-tenant tokens).
    for (let i = 0; i < 40; i++) {
      connect({ ...platform.options, client: { ...platform.options.client, accessToken: `token-${i}` } });
    }
    expect(__sharedToolsStateCountForTests()).toBeLessThanOrEqual(32);

    // An evicted state is not fatal: the same options re-acquire a fresh state.
    const revived = connect({ ...platform.options, client: { ...platform.options.client, accessToken: 'token-0' } });
    await revived();
    expect(platform.connectionLists().length).toBeGreaterThan(0);
  });

  it('derives the resource key per resolution from a callback', async () => {
    installProvider('linear', 'MASTRA_LINEAR_CONNECTION_ID');
    installProvider('notion', 'MASTRA_NOTION_CONNECTION_ID');
    const platform = scopedPlatform(() => [
      makeConnection(),
      makeConnection({ id: 'c_not1', integrationId: 'notion', resourceId: 'user-a' }),
    ]);
    const tools = connect({
      ...platform.options,
      resourceId: ctx => (ctx?.requestContext as { userId?: string } | undefined)?.userId,
    });

    const scoped = await tools({ requestContext: { userId: 'user-a' } });
    expect(Object.keys(scoped).sort()).toEqual(['linear_fake_tool', 'notion_fake_tool', 'request_connection']);

    // Callback returning undefined resolves global-only.
    const globalOnly = await tools({ requestContext: {} });
    expect(Object.keys(globalOnly)).toEqual(['linear_fake_tool']);
  });

  it('is thenable: awaiting the resolver yields the current tool record', async () => {
    installProvider('linear', 'MASTRA_LINEAR_CONNECTION_ID');
    const platform = scopedPlatform(() => [makeConnection()]);

    const record = await connect({ ...platform.options, resourceId: 'user-a' });
    expect(Object.keys(record).sort()).toEqual(['linear_fake_tool', 'request_connection']);

    // `.with()` resolvers unwrap the same way.
    const merged = await connect(platform.options).with({ extra_tool: { id: 'extra_tool' } });
    expect(Object.keys(merged).sort()).toEqual(['extra_tool', 'linear_fake_tool']);
  });

  it('rejects a malformed static resourceId at tools() time', () => {
    installProvider('linear', 'MASTRA_LINEAR_CONNECTION_ID');
    const platform = scopedPlatform(() => []);
    expect(() => connect({ ...platform.options, resourceId: '   ' })).toThrow(/Invalid resourceId/);
    expect(() => connect({ ...platform.options, resourceId: 'x'.repeat(257) })).toThrow(/Invalid resourceId/);
    expect(() => connect({ ...platform.options, resourceId: 42 as never })).toThrow(/expected a string or a function/);
  });

  it('rejects a resourceId placed on client options', () => {
    installProvider('linear', 'MASTRA_LINEAR_CONNECTION_ID');
    const platform = scopedPlatform(() => []);
    expect(() => connect({ ...platform.options, client: { ...platform.options.client, resourceId: 'u' } })).toThrow(
      /tools\(\{ resourceId \}\)/,
    );
  });

  it('rejects the resolution when a callback returns a malformed key', async () => {
    installProvider('linear', 'MASTRA_LINEAR_CONNECTION_ID');
    const platform = scopedPlatform(() => []);
    const tools = connect({ ...platform.options, resourceId: () => '   ' });
    await expect(tools()).rejects.toThrow(/Invalid resourceId/);
  });

  it("refresh() refetches the resolver's own scope", async () => {
    installProvider('linear', 'MASTRA_LINEAR_CONNECTION_ID');
    installProvider('notion', 'MASTRA_NOTION_CONNECTION_ID');
    let rows = [makeConnection()];
    const platform = scopedPlatform(() => rows);
    const tools = connect({ ...platform.options, resourceId: 'user-a' });

    expect(Object.keys(await tools()).sort()).toEqual(['linear_fake_tool', 'request_connection']);
    rows = [makeConnection(), makeConnection({ id: 'c_not1', integrationId: 'notion', resourceId: 'user-a' })];
    const refreshed = await tools.refresh();
    expect(Object.keys(refreshed).sort()).toEqual(['linear_fake_tool', 'notion_fake_tool', 'request_connection']);

    // Every connection list went out under the user's scope.
    for (const list of platform.connectionLists()) {
      expect(list.url.searchParams.get('resourceId')).toBe('user-a');
    }
  });

  it('disconnect() clears every scope in the shared state; the next resolution refetches', async () => {
    installProvider('linear', 'MASTRA_LINEAR_CONNECTION_ID');
    const platform = scopedPlatform(() => [makeConnection()]);
    const tools = connect({ ...platform.options, resourceId: 'user-a' });

    await tools();
    // resourceId is not part of the registry key, so the unscoped call
    // populates the global scope of the same shared state.
    await connect(platform.options)();
    const callsBefore = platform.fetchMock.mock.calls.length;
    await tools(); // cached
    expect(platform.fetchMock.mock.calls.length).toBe(callsBefore);

    await tools.disconnect();
    await tools();
    expect(platform.fetchMock.mock.calls.length).toBeGreaterThan(callsBefore);
  });
});

/**
 * Platform fetch fixture with a real catalog, for connect-prompt behavior.
 * Connection scoping matches {@link scopedPlatform}.
 */
function catalogPlatform(
  connections: () => Array<Record<string, unknown>>,
  endUserProviders: () => string[] | null = () => null,
) {
  const fetchMock = vi.fn().mockImplementation(async (input: string | URL | Request) => {
    const url = new URL(String(input));
    if (url.pathname === '/v2/integrations') {
      return Response.json({
        integrations: [
          { id: 'linear', capabilities: {}, displayName: 'Linear', logoUrl: 'https://logos.test/linear.svg' },
          {
            id: 'notion',
            capabilities: {},
            displayName: 'Notion',
            authType: 'OAUTH2',
            authFields: [{ name: 'workspace', target: 'params', label: 'Workspace', required: true }],
          },
        ],
      });
    }
    if (url.pathname === '/v2/projects/proj_1/integration-settings') {
      return Response.json({ endUserProviders: endUserProviders() });
    }
    const resourceId = url.searchParams.get('resourceId');
    const rows = connections().filter(connection =>
      resourceId === null
        ? connection.resourceId === null
        : connection.resourceId === null || connection.resourceId === resourceId,
    );
    return Response.json({ connections: rows });
  });
  const options = {
    projectId: 'proj_1',
    client: { accessToken: TOKEN, baseUrl: 'https://example.test', fetch: fetchMock as unknown as typeof fetch },
  } satisfies ConnectOptions;
  return { fetchMock, options };
}

type PromptTool = {
  execute: (input: { provider?: string }) => Promise<{
    type: string;
    requestedProvider?: string;
    providers: Array<{
      id: string;
      authFields: Array<{ name: string; target?: 'credentials' | 'params' | null; required?: boolean | null }> | null;
      connected: boolean;
      scope: string | null;
    }>;
  }>;
};

describe('built-in connect-prompt tool', () => {
  it('reports connectable providers with fresh connection state', async () => {
    installProvider('linear', 'MASTRA_LINEAR_CONNECTION_ID');
    let rows: Array<Record<string, unknown>> = [makeConnection()];
    const platform = catalogPlatform(() => rows);
    const record = await connect({ ...platform.options, resourceId: 'end-user-42' })();

    const prompt = record.request_connection as unknown as PromptTool;
    const first = await prompt.execute({});
    expect(first.type).toBe('connect-prompt');
    expect(first.providers).toEqual([
      expect.objectContaining({ id: 'linear', connected: true, scope: 'global' }),
      expect.objectContaining({ id: 'notion', connected: false, scope: null }),
    ]);

    // The tool re-fetches per call: a connection completed after the snapshot
    // was cached reads as connected without waiting out the TTL.
    rows = [makeConnection(), makeConnection({ id: 'c_not1', integrationId: 'notion', resourceId: 'end-user-42' })];
    const second = await prompt.execute({ provider: 'notion' });
    expect(second.requestedProvider).toBe('notion');
    expect(second.providers).toEqual([
      expect.objectContaining({
        id: 'notion',
        authFields: [{ name: 'workspace', target: 'params', label: 'Workspace', required: true }],
        connected: true,
        scope: 'user',
      }),
    ]);
  });

  it('uses fresh project provider configuration when code omits providers', async () => {
    installProvider('linear', 'MASTRA_LINEAR_CONNECTION_ID');
    let configured: string[] | null = ['notion'];
    const platform = catalogPlatform(
      () => [makeConnection()],
      () => configured,
    );
    const record = await connect({ ...platform.options, resourceId: 'end-user-42' })();

    const prompt = record.request_connection as unknown as PromptTool;
    expect((await prompt.execute({})).providers.map(provider => provider.id)).toEqual(['notion']);

    configured = [];
    expect((await prompt.execute({})).providers).toEqual([]);
  });

  it('lets the code providers allowlist override project provider configuration', async () => {
    installProvider('linear', 'MASTRA_LINEAR_CONNECTION_ID');
    const platform = catalogPlatform(
      () => [makeConnection()],
      () => ['notion'],
    );
    const record = await connect({ ...platform.options, providers: ['linear'], resourceId: 'end-user-42' })();

    const prompt = record.request_connection as unknown as PromptTool;
    const all = await prompt.execute({});
    expect(all.providers.map(provider => provider.id)).toEqual(['linear']);

    // An unknown (or disallowed) requested provider returns the connectable
    // set instead of failing, so the agent can correct itself.
    const unknown = await prompt.execute({ provider: 'notion' });
    expect(unknown.requestedProvider).toBeUndefined();
    expect(unknown.providers.map(provider => provider.id)).toEqual(['linear']);
  });

  it('matches a requested provider id case-insensitively', async () => {
    installProvider('linear', 'MASTRA_LINEAR_CONNECTION_ID');
    const platform = catalogPlatform(() => [makeConnection()]);
    const record = await connect({ ...platform.options, providers: ['linear'], resourceId: 'end-user-42' })();

    // Agents routinely capitalize provider names; the lookup must not miss
    // the catalog entry over casing.
    const prompt = record.request_connection as unknown as PromptTool;
    const requested = await prompt.execute({ provider: 'LINEAR' });
    expect(requested.requestedProvider).toBe('linear');
    expect(requested.providers).toEqual([expect.objectContaining({ id: 'linear', connected: true })]);
  });

  it('rejects a non-boolean connectPrompt option at startup', () => {
    const platform = catalogPlatform(() => []);
    expect(() =>
      connect({ ...platform.options, resourceId: 'end-user-42', connectPrompt: 'false' as unknown as boolean }),
    ).toThrowError(/connectPrompt/);
  });

  it('is omitted with connectPrompt: false and from global-only resolutions', async () => {
    installProvider('linear', 'MASTRA_LINEAR_CONNECTION_ID');
    const platform = catalogPlatform(() => [makeConnection()]);

    const disabled = await connect({ ...platform.options, resourceId: 'end-user-42', connectPrompt: false })();
    expect(Object.keys(disabled)).toEqual(['linear_fake_tool']);

    const globalOnly = await connect({ ...platform.options, connectPrompt: true })();
    expect(Object.keys(globalOnly)).toEqual(['linear_fake_tool']);
  });
});
