import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { connect } from '../connect.js';
import type { ConnectOptions } from '../connect.js';
import { MastraConnectError } from '../errors.js';
import { PROVIDERS, type ProviderRegistration } from '../registry.js';

// Test-only seam: the shipped barrel exports a readonly view; tests mutate the
// underlying array to install fixture providers.
const testProviders = PROVIDERS as ProviderRegistration[];

const TOKEN = 'fake-test-token';

function installProvider(
  integrationId: string,
  envVar: string,
): ProviderRegistration & { createToolsSpy: ReturnType<typeof vi.fn> } {
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
    ...overrides,
  };
}

function resolverOptions(connections: () => unknown[], extra?: { ttlMs?: number }) {
  const fetchMock = vi.fn().mockImplementation(async () => Response.json({ connections: connections() }));
  return {
    fetchMock,
    options: {
      projectId: 'proj_1',
      client: { accessToken: TOKEN, baseUrl: 'https://example.test', fetch: fetchMock as unknown as typeof fetch },
      ...extra,
    } satisfies ConnectOptions,
  };
}

function flush(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}

let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  testProviders.length = 0;
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  testProviders.length = 0;
  vi.useRealTimers();
  vi.unstubAllEnvs();
  warnSpy.mockRestore();
});

describe('connect resolver caching and liveness', () => {
  it('returns a resolver function with invalidate/refresh, not a promise', () => {
    installProvider('linear', 'MASTRA_LINEAR_CONNECTION_ID');
    const tools = connect(resolverOptions(() => []).options);
    expect(typeof tools).toBe('function');
    expect(typeof tools.invalidate).toBe('function');
    expect(typeof tools.refresh).toBe('function');
  });

  it('resolves toolsets from the project connections on first resolution', async () => {
    const linear = installProvider('linear', 'MASTRA_LINEAR_CONNECTION_ID');
    const { options } = resolverOptions(() => [makeConnection()]);
    const tools = connect(options);
    const result = await tools({ requestContext: {} });
    expect(Object.keys(result)).toEqual(['linear']);
    expect(linear.createToolsSpy).toHaveBeenCalledWith(expect.objectContaining({ connectionId: 'c_lin1' }));
  });

  it('serves the cached snapshot within the TTL without refetching', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    installProvider('linear', 'MASTRA_LINEAR_CONNECTION_ID');
    const { options, fetchMock } = resolverOptions(() => [makeConnection()], { ttlMs: 30_000 });
    const tools = connect(options);

    const start = Date.now();
    await tools();
    vi.setSystemTime(start + 29_999);
    await tools();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('serves stale toolsets immediately after TTL and picks up an attached integration on the next resolution', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    installProvider('linear', 'MASTRA_LINEAR_CONNECTION_ID');
    installProvider('notion', 'MASTRA_NOTION_CONNECTION_ID');
    let connections = [makeConnection()];
    const { options, fetchMock } = resolverOptions(() => connections, { ttlMs: 1_000 });
    const tools = connect(options);

    const start = Date.now();
    const first = await tools();
    expect(Object.keys(first)).toEqual(['linear']);

    connections = [makeConnection(), makeConnection({ id: 'c_not1', integrationId: 'notion' })];
    vi.setSystemTime(start + 1_001);

    const stale = await tools();
    expect(Object.keys(stale)).toEqual(['linear']);
    await flush();

    const fresh = await tools();
    expect(Object.keys(fresh).sort()).toEqual(['linear', 'notion']);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('drops a detached integration on the next refresh', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    installProvider('linear', 'MASTRA_LINEAR_CONNECTION_ID');
    installProvider('notion', 'MASTRA_NOTION_CONNECTION_ID');
    let connections = [makeConnection(), makeConnection({ id: 'c_not1', integrationId: 'notion' })];
    const { options } = resolverOptions(() => connections, { ttlMs: 1_000 });
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
    installProvider('linear', 'MASTRA_LINEAR_CONNECTION_ID');
    let fail = false;
    const fetchMock = vi
      .fn()
      .mockImplementation(async () =>
        fail ? Promise.reject(new Error('network down')) : Response.json({ connections: [makeConnection()] }),
      );
    const tools = connect({
      projectId: 'proj_1',
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

    const again = await tools();
    expect(Object.keys(again)).toEqual(['linear']);
  });

  it('applies a cooldown after a failed background refresh instead of refetching every resolution', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    installProvider('linear', 'MASTRA_LINEAR_CONNECTION_ID');
    let fail = false;
    const fetchMock = vi
      .fn()
      .mockImplementation(async () =>
        fail ? Promise.reject(new Error('network down')) : Response.json({ connections: [makeConnection()] }),
      );
    const tools = connect({
      projectId: 'proj_1',
      ttlMs: 1_000,
      client: { accessToken: TOKEN, baseUrl: 'https://example.test', fetch: fetchMock as unknown as typeof fetch },
    });

    const start = Date.now();
    await tools();
    fail = true;
    vi.setSystemTime(start + 1_001);
    await tools();
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // Still inside the failure cooldown: stale resolutions must not refetch.
    vi.setSystemTime(start + 2_000);
    await tools();
    await tools();
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // After the cooldown a stale resolution revalidates again.
    vi.setSystemTime(start + 40_000);
    fail = false;
    await tools();
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('refresh() rejects when the platform fetch fails even with a cached snapshot', async () => {
    installProvider('linear', 'MASTRA_LINEAR_CONNECTION_ID');
    let fail = false;
    const fetchMock = vi
      .fn()
      .mockImplementation(async () =>
        fail ? Promise.reject(new Error('network down')) : Response.json({ connections: [makeConnection()] }),
      );
    const tools = connect({
      projectId: 'proj_1',
      client: { accessToken: TOKEN, baseUrl: 'https://example.test', fetch: fetchMock as unknown as typeof fetch },
    });

    await tools();
    fail = true;
    await expect(tools.refresh()).rejects.toThrow('network down');

    // The cached snapshot stays available for plain resolutions.
    await expect(tools()).resolves.toHaveProperty('linear');
  });

  it('rejects when the platform is unreachable and nothing is cached', async () => {
    installProvider('linear', 'MASTRA_LINEAR_CONNECTION_ID');
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ title: 'internal error' }), {
        status: 500,
        headers: { 'content-type': 'application/problem+json' },
      }),
    );
    const tools = connect({
      projectId: 'proj_1',
      client: { accessToken: TOKEN, baseUrl: 'https://example.test', fetch: fetchMock as unknown as typeof fetch },
    });
    await expect(tools()).rejects.toMatchObject({ code: 'platform_error' });
  });

  it('performs a single fetch for concurrent cold resolutions', async () => {
    installProvider('linear', 'MASTRA_LINEAR_CONNECTION_ID');
    let resolveFetch!: (response: Response) => void;
    const fetchMock = vi.fn(() => new Promise<Response>(resolve => (resolveFetch = resolve)));
    const tools = connect({
      projectId: 'proj_1',
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
    installProvider('linear', 'MASTRA_LINEAR_CONNECTION_ID');
    const { options, fetchMock } = resolverOptions(() => [makeConnection()], { ttlMs: 60_000 });
    const tools = connect(options);

    await tools();
    tools.invalidate();
    await tools();

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('refresh() fetches immediately and updates the cache', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    installProvider('linear', 'MASTRA_LINEAR_CONNECTION_ID');
    installProvider('notion', 'MASTRA_NOTION_CONNECTION_ID');
    let connections = [makeConnection()];
    const { options, fetchMock } = resolverOptions(() => connections, { ttlMs: 60_000 });
    const tools = connect(options);

    await tools();
    connections = [makeConnection(), makeConnection({ id: 'c_not1', integrationId: 'notion' })];
    const fresh = await tools.refresh();
    expect(Object.keys(fresh).sort()).toEqual(['linear', 'notion']);

    const next = await tools();
    expect(next).toBe(fresh);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('warns once for a registered provider with no connection yet, then picks it up once attached', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    installProvider('linear', 'MASTRA_LINEAR_CONNECTION_ID');
    installProvider('notion', 'MASTRA_NOTION_CONNECTION_ID');
    const notionConnection = makeConnection({ id: 'c_not1', integrationId: 'notion' });
    let connections = [notionConnection];
    const { options } = resolverOptions(() => connections, { ttlMs: 1_000 });
    const tools = connect(options);

    const start = Date.now();
    const first = await tools();
    expect(Object.keys(first)).toEqual(['notion']);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('will appear automatically'));

    vi.setSystemTime(start + 1_001);
    await tools();
    await flush();
    const missingWarns = warnSpy.mock.calls.filter((call: unknown[]) =>
      String(call[0]).includes('will appear automatically'),
    );
    expect(missingWarns).toHaveLength(1);

    connections = [notionConnection, makeConnection()];
    const after = await tools.refresh();
    expect(Object.keys(after).sort()).toEqual(['linear', 'notion']);
  });

  it('warns and skips a provider whose builder throws instead of rejecting', async () => {
    const linear = installProvider('linear', 'MASTRA_LINEAR_CONNECTION_ID');
    linear.createToolsSpy.mockImplementation(() => {
      throw new Error('Unknown tool: linear_nope');
    });
    const { options } = resolverOptions(() => [makeConnection()]);
    const tools = connect(options);

    await expect(tools()).resolves.toEqual({});
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown tool: linear_nope'));
  });

  it('throws missing_access_token synchronously at connect() time', () => {
    installProvider('linear', 'MASTRA_LINEAR_CONNECTION_ID');
    vi.stubEnv('MASTRA_PLATFORM_ACCESS_TOKEN', '');
    vi.stubEnv('MASTRA_PLATFORM_SECRET_KEY', '');
    expect(() => connect({ projectId: 'proj_1' })).toThrow(MastraConnectError);
  });

  it('throws invalid_options synchronously for a bad ttlMs', () => {
    installProvider('linear', 'MASTRA_LINEAR_CONNECTION_ID');
    for (const ttlMs of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => connect({ projectId: 'proj_1', ttlMs, client: { accessToken: TOKEN } })).toThrow(/ttlMs/);
    }
  });

  it('accepts ttlMs of 0 and revalidates on every resolution', async () => {
    installProvider('linear', 'MASTRA_LINEAR_CONNECTION_ID');
    const { options, fetchMock } = resolverOptions(() => [makeConnection()], { ttlMs: 0 });
    const tools = connect(options);

    await tools();
    await tools();
    await flush();
    await tools();

    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});
