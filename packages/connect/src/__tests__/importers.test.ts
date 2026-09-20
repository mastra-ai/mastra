import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MastraConnectError } from '../errors.js';
import { IMPORTERS, type ImporterProviderContext, type ImporterProviderRegistration } from '../importer-registry.js';
import { importers, type ImportersOptions } from '../importers.js';

const testImporters = IMPORTERS as ImporterProviderRegistration[];
const TOKEN = 'fake-test-token';

function installImporter(
  integrationId: string,
  envVar: string,
): ImporterProviderRegistration & { createImporterSpy: ReturnType<typeof vi.fn> } {
  const createImporter = vi
    .fn<(ctx: ImporterProviderContext) => ReturnType<ImporterProviderRegistration['createImporter']>>()
    .mockImplementation(ctx => ({
      id: `will-be-overridden:${integrationId}`,
      access: ctx.access,
      triggers: { cron: { schedule: ctx.schedule, bindings: [{ source: 'test', scope: 'org:acme' }] } },
      handler: async () => {},
    }));
  const registration: ImporterProviderRegistration = {
    integrationId,
    envVar,
    defaultSchedule: '0 * * * *',
    createImporter,
  };
  testImporters.push(registration);
  return { ...registration, createImporterSpy: createImporter };
}

function makeConnection(overrides?: Record<string, unknown>) {
  return {
    id: 'c_not1',
    integrationId: 'notion',
    status: 'active',
    connectedByUserId: 'user_1',
    connectedAt: '2026-09-01T00:00:00Z',
    createdAt: '2026-09-01T00:00:00Z',
    accountLabel: 'Acme',
    ...overrides,
  };
}

function resolverOptions(
  connections: () => unknown[],
  extra?: Partial<ImportersOptions>,
): { fetchMock: ReturnType<typeof vi.fn>; options: ImportersOptions } {
  const fetchMock = vi.fn().mockImplementation(async () => Response.json({ connections: connections() }));
  return {
    fetchMock,
    options: {
      projectId: 'proj_1',
      client: { accessToken: TOKEN, baseUrl: 'https://example.test', fetch: fetchMock as unknown as typeof fetch },
      integrations: { notion: { scope: 'org:acme' } },
      ...extra,
    },
  };
}

function flush(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0));
}

let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  testImporters.length = 0;
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  testImporters.length = 0;
  vi.useRealTimers();
  vi.unstubAllEnvs();
  warnSpy.mockRestore();
});

describe('importers() resolver', () => {
  it('is a callable resolver with invalidate/refresh helpers', () => {
    installImporter('notion', 'MASTRA_NOTION_CONNECTION_ID');
    const resolver = importers(resolverOptions(() => []).options);
    expect(typeof resolver).toBe('function');
    expect(typeof resolver.invalidate).toBe('function');
    expect(typeof resolver.refresh).toBe('function');
  });

  it('returns an empty list when no connections are attached', async () => {
    installImporter('notion', 'MASTRA_NOTION_CONNECTION_ID');
    const resolver = importers(resolverOptions(() => []).options);
    expect(await resolver()).toEqual([]);
  });

  it('produces one definition with connect:<integrationId>:<connectionId> id, forwarded access, and provider schedule', async () => {
    const notion = installImporter('notion', 'MASTRA_NOTION_CONNECTION_ID');
    const resolver = importers(resolverOptions(() => [makeConnection()]).options);
    const definitions = await resolver();
    expect(definitions).toHaveLength(1);
    expect(definitions[0]!.id).toBe('connect:notion:c_not1');
    expect(definitions[0]!.access).toEqual({ 'org:acme': 'owner' });
    expect(definitions[0]!.triggers?.cron?.schedule).toBe('0 * * * *');
    expect(notion.createImporterSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        connection: expect.objectContaining({ id: 'c_not1' }),
        access: { 'org:acme': 'owner' },
        schedule: '0 * * * *',
      }),
    );
  });

  it('skips providers marked disabled in config', async () => {
    installImporter('notion', 'MASTRA_NOTION_CONNECTION_ID');
    const { options } = resolverOptions(() => [makeConnection()]);
    const resolver = importers({ ...options, integrations: { notion: { scope: 'org:acme', disabled: true } } });
    expect(await resolver()).toEqual([]);
  });

  it('throws at call time when an integration is missing scope/access', () => {
    installImporter('notion', 'MASTRA_NOTION_CONNECTION_ID');
    expect(() =>
      importers({
        projectId: 'proj_1',
        client: { accessToken: TOKEN, baseUrl: 'https://x.test', fetch: (async () => new Response()) as never },
        integrations: { notion: {} },
      }),
    ).toThrow(MastraConnectError);
  });

  it('throws at call time when integrations reference an unknown provider', () => {
    installImporter('notion', 'MASTRA_NOTION_CONNECTION_ID');
    expect(() =>
      importers({
        projectId: 'proj_1',
        client: { accessToken: TOKEN, baseUrl: 'https://x.test', fetch: (async () => new Response()) as never },
        integrations: { ghost: { scope: 'org:acme' } },
      }),
    ).toThrow(/Unknown importer provider/);
  });

  it('produces one definition per active connection when the provider has multiple', async () => {
    installImporter('notion', 'MASTRA_NOTION_CONNECTION_ID');
    const resolver = importers(
      resolverOptions(() => [
        makeConnection({ id: 'c_a' }),
        makeConnection({ id: 'c_b' }),
        makeConnection({ id: 'c_c', status: 'needs_reauth' }),
      ]).options,
    );
    const definitions = await resolver();
    expect(definitions.map(d => d.id)).toEqual(['connect:notion:c_a', 'connect:notion:c_b']);
  });

  it('pins to a specific connection when connectionId is set', async () => {
    installImporter('notion', 'MASTRA_NOTION_CONNECTION_ID');
    const { options } = resolverOptions(() => [makeConnection({ id: 'c_a' }), makeConnection({ id: 'c_b' })]);
    const resolver = importers({
      ...options,
      integrations: { notion: { scope: 'org:acme', connectionId: 'c_b' } },
    });
    const definitions = await resolver();
    expect(definitions.map(d => d.id)).toEqual(['connect:notion:c_b']);
  });

  it('serves the cached snapshot within the TTL without refetching', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    installImporter('notion', 'MASTRA_NOTION_CONNECTION_ID');
    const { options, fetchMock } = resolverOptions(() => [makeConnection()], { ttlMs: 30_000 });
    const resolver = importers(options);
    const start = Date.now();
    await resolver();
    vi.setSystemTime(start + 29_999);
    await resolver();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('invalidate() drops the cache so the next resolution refetches', async () => {
    installImporter('notion', 'MASTRA_NOTION_CONNECTION_ID');
    const { options, fetchMock } = resolverOptions(() => [makeConnection()], { ttlMs: 30_000 });
    const resolver = importers(options);
    await resolver();
    resolver.invalidate();
    await resolver();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('serves the stale snapshot when the platform fetch fails after cache expiry', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    installImporter('notion', 'MASTRA_NOTION_CONNECTION_ID');
    let shouldFail = false;
    const fetchMock = vi.fn().mockImplementation(async () => {
      if (shouldFail) throw new Error('platform down');
      return Response.json({ connections: [makeConnection()] });
    });
    const resolver = importers({
      projectId: 'proj_1',
      client: { accessToken: TOKEN, baseUrl: 'https://example.test', fetch: fetchMock as unknown as typeof fetch },
      integrations: { notion: { scope: 'org:acme' } },
      ttlMs: 1_000,
    });
    const first = await resolver();
    expect(first.map(d => d.id)).toEqual(['connect:notion:c_not1']);

    shouldFail = true;
    vi.setSystemTime(Date.now() + 5_000);
    const stale = await resolver();
    expect(stale.map(d => d.id)).toEqual(['connect:notion:c_not1']);
    await flush();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Keeping cached importers'));
  });

  it('throws on invalid projectId or ttlMs at call time', () => {
    installImporter('notion', 'MASTRA_NOTION_CONNECTION_ID');
    expect(() => importers({ client: { accessToken: TOKEN, baseUrl: 'x' } })).toThrow(/Missing project id/);
    expect(() =>
      importers({
        projectId: 'p',
        client: { accessToken: TOKEN, baseUrl: 'x' },
        ttlMs: -1,
      }),
    ).toThrow(/Invalid ttlMs/);
  });
});
