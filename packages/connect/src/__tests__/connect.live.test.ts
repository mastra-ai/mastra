import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { connect } from '../connect.js';
import type { ConnectOptions } from '../connect.js';
import { MastraConnectError } from '../errors.js';
import { PROVIDERS } from '../registry.js';
import type { ProviderKey, ProviderRegistration } from '../registry.js';

const TOKEN = 'fake-test-token';

const originalRegistrations: Partial<Record<ProviderKey, ProviderRegistration>> = {};

function stubProvider(key: ProviderKey, integrationId: string, envVar: string) {
  const createTools = vi.fn().mockReturnValue({ [`${key}_fake_tool`]: { id: `${key}_fake_tool` } } as never);
  if (!(key in originalRegistrations)) {
    originalRegistrations[key] = PROVIDERS[key];
  }
  PROVIDERS[key] = { integrationId, envVar, createTools };
  return { createTools };
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
    ...overrides,
  };
}

function liveOptions(
  connections: () => unknown[],
  extra?: { ttlMs?: number; integrations?: ConnectOptions['integrations'] },
) {
  const fetchMock = vi.fn().mockImplementation(async () => Response.json({ connections: connections() }));
  return {
    fetchMock,
    options: {
      projectId: 'proj_1',
      live: true as const,
      client: { accessToken: TOKEN, baseUrl: 'https://example.test', fetch: fetchMock as unknown as typeof fetch },
      ...extra,
    },
  };
}

/** Lets pending microtasks (background SWR refreshes) settle without advancing the fake clock. */
function flush(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}

let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  for (const [key, registration] of Object.entries(originalRegistrations)) {
    PROVIDERS[key as ProviderKey] = registration;
  }
  vi.useRealTimers();
  vi.unstubAllEnvs();
  warnSpy.mockRestore();
});

describe('connect live mode', () => {
  it('returns a resolver function with invalidate/refresh, not a promise', () => {
    stubProvider('linear', 'linear', 'MASTRA_LINEAR_CONNECTION_ID');
    const tools = connect(liveOptions(() => []).options);
    expect(typeof tools).toBe('function');
    expect(typeof tools.invalidate).toBe('function');
    expect(typeof tools.refresh).toBe('function');
  });

  it('resolves toolsets from the project connections on first resolution', async () => {
    const { createTools } = stubProvider('linear', 'linear', 'MASTRA_LINEAR_CONNECTION_ID');
    const { options } = liveOptions(() => [makeConnection()]);
    const tools = connect(options);
    const result = await tools({ requestContext: {} });
    expect(Object.keys(result)).toEqual(['linear']);
    expect(createTools).toHaveBeenCalledWith(expect.objectContaining({ connectionId: 'c_lin1' }));
  });

  it('serves the cached snapshot within the TTL without refetching', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    stubProvider('linear', 'linear', 'MASTRA_LINEAR_CONNECTION_ID');
    const { options, fetchMock } = liveOptions(() => [makeConnection()], { ttlMs: 30_000 });
    const tools = connect(options);

    const start = Date.now();
    await tools();
    vi.setSystemTime(start + 29_999);
    await tools();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('serves stale toolsets immediately after TTL and picks up an attached integration on the next resolution', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    stubProvider('linear', 'linear', 'MASTRA_LINEAR_CONNECTION_ID');
    stubProvider('notion', 'notion', 'MASTRA_NOTION_CONNECTION_ID');
    let connections = [makeConnection()];
    const { options, fetchMock } = liveOptions(() => connections, { ttlMs: 1_000 });
    const tools = connect(options);

    const start = Date.now();
    const first = await tools();
    expect(Object.keys(first)).toEqual(['linear']);

    // Attach Notion on the platform, then let the snapshot go stale.
    connections = [makeConnection(), makeConnection({ id: 'c_not1', integrationId: 'notion' })];
    vi.setSystemTime(start + 1_001);

    // Stale-while-revalidate: this call serves the old snapshot and refreshes in the background.
    const stale = await tools();
    expect(Object.keys(stale)).toEqual(['linear']);
    await flush();

    const fresh = await tools();
    expect(Object.keys(fresh).sort()).toEqual(['linear', 'notion']);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('drops a detached integration on the next refresh', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    stubProvider('linear', 'linear', 'MASTRA_LINEAR_CONNECTION_ID');
    stubProvider('notion', 'notion', 'MASTRA_NOTION_CONNECTION_ID');
    let connections = [makeConnection(), makeConnection({ id: 'c_not1', integrationId: 'notion' })];
    const { options } = liveOptions(() => connections, { ttlMs: 1_000 });
    const tools = connect(options);

    const start = Date.now();
    await tools();
    connections = [makeConnection()];
    vi.setSystemTime(start + 1_001);
    await tools();
    await flush();

    const fresh = await tools();
    expect(Object.keys(fresh)).toEqual(['linear']);
  });

  it('keeps the stale snapshot and warns when a background refresh fails', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    stubProvider('linear', 'linear', 'MASTRA_LINEAR_CONNECTION_ID');
    let fail = false;
    const fetchMock = vi
      .fn()
      .mockImplementation(async () =>
        fail ? Promise.reject(new Error('network down')) : Response.json({ connections: [makeConnection()] }),
      );
    const tools = connect({
      projectId: 'proj_1',
      live: true,
      ttlMs: 1_000,
      client: { accessToken: TOKEN, baseUrl: 'https://example.test', fetch: fetchMock as unknown as typeof fetch },
    });

    const start = Date.now();
    await tools();
    fail = true;
    vi.setSystemTime(start + 1_001);

    const result = await tools();
    expect(Object.keys(result)).toEqual(['linear']);
    await flush();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('platform refresh failed'));

    // Still served from cache afterwards.
    const again = await tools();
    expect(Object.keys(again)).toEqual(['linear']);
  });

  it('rejects when the platform is unreachable and nothing is cached', async () => {
    stubProvider('linear', 'linear', 'MASTRA_LINEAR_CONNECTION_ID');
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ title: 'internal error' }), {
        status: 500,
        headers: { 'content-type': 'application/problem+json' },
      }),
    );
    const tools = connect({
      projectId: 'proj_1',
      live: true,
      client: { accessToken: TOKEN, baseUrl: 'https://example.test', fetch: fetchMock as unknown as typeof fetch },
    });
    await expect(tools()).rejects.toMatchObject({ code: 'platform_error' });
  });

  it('performs a single fetch for concurrent cold resolutions', async () => {
    stubProvider('linear', 'linear', 'MASTRA_LINEAR_CONNECTION_ID');
    let resolveFetch!: (response: Response) => void;
    const fetchMock = vi.fn(() => new Promise<Response>(resolve => (resolveFetch = resolve)));
    const tools = connect({
      projectId: 'proj_1',
      live: true,
      client: { accessToken: TOKEN, baseUrl: 'https://example.test', fetch: fetchMock as unknown as typeof fetch },
    });

    const p1 = tools();
    const p2 = tools();
    resolveFetch(Response.json({ connections: [makeConnection()] }));
    const [r1, r2] = await Promise.all([p1, p2]);

    expect(Object.keys(r1)).toEqual(['linear']);
    expect(r2).toBe(r1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('invalidate() forces a refetch on the next resolution', async () => {
    stubProvider('linear', 'linear', 'MASTRA_LINEAR_CONNECTION_ID');
    const { options, fetchMock } = liveOptions(() => [makeConnection()], { ttlMs: 60_000 });
    const tools = connect(options);

    await tools();
    tools.invalidate();
    await tools();

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('refresh() fetches immediately and updates the cache', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    stubProvider('linear', 'linear', 'MASTRA_LINEAR_CONNECTION_ID');
    stubProvider('notion', 'notion', 'MASTRA_NOTION_CONNECTION_ID');
    let connections = [makeConnection()];
    const { options, fetchMock } = liveOptions(() => connections, { ttlMs: 60_000 });
    const tools = connect(options);

    await tools();
    connections = [makeConnection(), makeConnection({ id: 'c_not1', integrationId: 'notion' })];
    const fresh = await tools.refresh();
    expect(Object.keys(fresh).sort()).toEqual(['linear', 'notion']);

    // The refreshed snapshot now serves within the TTL without another fetch.
    const next = await tools();
    expect(next).toBe(fresh);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('warns once for an allowlisted provider with no connection yet, then picks it up once attached', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    stubProvider('linear', 'linear', 'MASTRA_LINEAR_CONNECTION_ID');
    stubProvider('notion', 'notion', 'MASTRA_NOTION_CONNECTION_ID');
    const notionConnection = makeConnection({ id: 'c_not1', integrationId: 'notion' });
    let connections = [notionConnection];
    const { options } = liveOptions(() => connections, {
      ttlMs: 1_000,
      integrations: { linear: true, notion: true },
    });
    const tools = connect(options);

    const start = Date.now();
    const first = await tools();
    expect(Object.keys(first)).toEqual(['notion']);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('will appear automatically'));

    // Still missing after another refresh: the warning is not repeated.
    vi.setSystemTime(start + 1_001);
    await tools();
    await flush();
    const missingWarns = warnSpy.mock.calls.filter(call => String(call[0]).includes('will appear automatically'));
    expect(missingWarns).toHaveLength(1);

    // Attach Linear: it shows up without a restart.
    connections = [notionConnection, makeConnection()];
    const after = await tools.refresh();
    expect(Object.keys(after).sort()).toEqual(['linear', 'notion']);
  });

  it('warns and skips a needs_reauth connection instead of rejecting', async () => {
    stubProvider('linear', 'linear', 'MASTRA_LINEAR_CONNECTION_ID');
    const { options } = liveOptions(() => [makeConnection({ status: 'needs_reauth' })]);
    const tools = connect(options);

    await expect(tools()).resolves.toEqual({});
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('re-authentication'));
  });

  it('warns and skips a directed needs_reauth connection instead of rejecting', async () => {
    stubProvider('linear', 'linear', 'MASTRA_LINEAR_CONNECTION_ID');
    const { options } = liveOptions(() => [makeConnection({ status: 'needs_reauth' })], {
      integrations: { linear: { connectionId: 'c_lin1' } },
    });
    const tools = connect(options);

    await expect(tools()).resolves.toEqual({});
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('needs re-authentication'));
  });

  it('warns and skips an ambiguous explicit provider instead of throwing multiple_connections', async () => {
    stubProvider('linear', 'linear', 'MASTRA_LINEAR_CONNECTION_ID');
    const { options } = liveOptions(() => [makeConnection(), makeConnection({ id: 'c_lin2' })], {
      integrations: { linear: true },
    });
    const tools = connect(options);

    await expect(tools()).resolves.toEqual({});
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('multiple connections found'));
  });

  it('lets the env var pick among multiple connections in live mode', async () => {
    const { createTools } = stubProvider('linear', 'linear', 'MASTRA_LINEAR_CONNECTION_ID');
    vi.stubEnv('MASTRA_LINEAR_CONNECTION_ID', 'c_lin2');
    const { options } = liveOptions(() => [makeConnection(), makeConnection({ id: 'c_lin2' })]);
    const tools = connect(options);

    await tools();
    expect(createTools).toHaveBeenCalledWith(expect.objectContaining({ connectionId: 'c_lin2' }));
  });

  it('warns and skips unsupported platform integrations in undirected live mode', async () => {
    stubProvider('linear', 'linear', 'MASTRA_LINEAR_CONNECTION_ID');
    const { options } = liveOptions(() => [
      makeConnection(),
      makeConnection({ id: 'c_unk1', integrationId: 'salesforce' }),
    ]);
    const tools = connect(options);

    const result = await tools();
    expect(Object.keys(result)).toEqual(['linear']);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('salesforce'));
  });

  it('warns once per unsupported integration across refreshes', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    stubProvider('linear', 'linear', 'MASTRA_LINEAR_CONNECTION_ID');
    const { options } = liveOptions(
      () => [makeConnection(), makeConnection({ id: 'c_unk1', integrationId: 'salesforce' })],
      { ttlMs: 1_000 },
    );
    const tools = connect(options);

    const start = Date.now();
    await tools();
    vi.setSystemTime(start + 1_001);
    await tools();
    await flush();
    await tools.refresh();

    const unsupportedWarns = warnSpy.mock.calls.filter(call => String(call[0]).includes('salesforce'));
    expect(unsupportedWarns).toHaveLength(1);
  });

  it('warns and skips a provider whose builder throws (e.g. invalid allowTools) instead of rejecting', async () => {
    const { createTools } = stubProvider('linear', 'linear', 'MASTRA_LINEAR_CONNECTION_ID');
    createTools.mockImplementation(() => {
      throw new Error('Unknown tool: linear_nope');
    });
    const { options } = liveOptions(() => [makeConnection()]);
    const tools = connect(options);

    await expect(tools()).resolves.toEqual({});
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown tool: linear_nope'));
  });

  it('throws missing_project_id synchronously at connect() time', () => {
    vi.stubEnv('MASTRA_PROJECT_ID', '');
    expect(() => connect({ live: true, client: { accessToken: TOKEN } })).toThrow(MastraConnectError);
  });

  it('throws missing_access_token synchronously at connect() time', () => {
    vi.stubEnv('MASTRA_PLATFORM_ACCESS_TOKEN', '');
    vi.stubEnv('MASTRA_PLATFORM_SECRET_KEY', '');
    expect(() => connect({ live: true, projectId: 'proj_1' })).toThrow(MastraConnectError);
  });

  it('throws synchronously for unknown integration keys', () => {
    expect(() =>
      connect({
        live: true,
        projectId: 'proj_1',
        integrations: { bogus: true } as never,
        client: { accessToken: TOKEN },
      }),
    ).toThrow(/Unknown integration 'bogus'/);
  });

  it('throws invalid_options synchronously for a bad ttlMs', () => {
    for (const ttlMs of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => connect({ live: true, projectId: 'proj_1', ttlMs, client: { accessToken: TOKEN } })).toThrow(
        /ttlMs/,
      );
    }
  });

  it('accepts ttlMs of 0 and revalidates on every resolution', async () => {
    stubProvider('linear', 'linear', 'MASTRA_LINEAR_CONNECTION_ID');
    const { options, fetchMock } = liveOptions(() => [makeConnection()], { ttlMs: 0 });
    const tools = connect(options);

    await tools();
    await tools();
    await flush();
    await tools();

    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});
