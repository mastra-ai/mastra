import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { connect } from '../connect.js';
import { PROVIDERS, type ProviderRegistration } from '../registry.js';

// Test-only seam: the shipped barrel exports a readonly view; tests mutate the
// underlying array to install fixture providers.
const testProviders = PROVIDERS as ProviderRegistration[];

const TOKEN = 'fake-test-token';

const fakeTools = { linear_fake_tool: { id: 'linear_fake_tool' } } as never;

function installProvider(overrides?: Partial<ProviderRegistration>): {
  registration: ProviderRegistration;
  createTools: ReturnType<typeof vi.fn>;
} {
  const createTools = vi.fn().mockReturnValue(fakeTools);
  const registration: ProviderRegistration = {
    integrationId: 'linear',
    envVar: 'MASTRA_LINEAR_CONNECTION_ID',
    createTools,
    ...overrides,
  };
  testProviders.push(registration);
  return { registration, createTools };
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

let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  testProviders.length = 0;
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  testProviders.length = 0;
  vi.unstubAllEnvs();
  warnSpy.mockRestore();
});

describe('connect', () => {
  it('throws missing_project_id synchronously without a project id', () => {
    installProvider();
    vi.stubEnv('MASTRA_PROJECT_ID', '');
    expect(() => connect({ client: { accessToken: TOKEN } })).toThrow(
      expect.objectContaining({ code: 'missing_project_id' }),
    );
  });

  it('throws invalid_options for unknown provider in integrations override', () => {
    installProvider();
    expect(() =>
      connect({
        projectId: 'proj_1',
        client: { accessToken: TOKEN },
        integrations: { does_not_exist: { disabled: true } },
      }),
    ).toThrow(expect.objectContaining({ code: 'invalid_options' }));
  });

  it('falls back to MASTRA_PROJECT_ID', async () => {
    installProvider();
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ connections: [] }));
    vi.stubEnv('MASTRA_PROJECT_ID', 'proj_env');
    await connect({
      client: { accessToken: TOKEN, baseUrl: 'https://example.test', fetch: fetchMock as never },
    })();
    const [url] = fetchMock.mock.calls[0]!;
    expect(String(url)).toContain('/v2/projects/proj_env/connections');
  });

  it('resolves the toolset for the sole active connection', async () => {
    const { createTools } = installProvider();
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ connections: [makeConnection()] }));
    const tools = await connect({
      projectId: 'proj_1',
      client: { accessToken: TOKEN, baseUrl: 'https://example.test', fetch: fetchMock as never },
    })();
    expect(tools).toEqual({ linear: fakeTools });
    expect(createTools).toHaveBeenCalledWith(
      expect.objectContaining({ connectionId: 'c_lin1', allowTools: undefined }),
    );
  });

  it('warns and skips when there are no connections for a provider', async () => {
    installProvider();
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ connections: [] }));
    const tools = await connect({
      projectId: 'proj_1',
      client: { accessToken: TOKEN, baseUrl: 'https://example.test', fetch: fetchMock as never },
    })();
    expect(tools).toEqual({});
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('No linear connection in this project'));
  });

  it('only warns about missing providers once across multiple resolutions', async () => {
    installProvider();
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ connections: [] }));
    const tools = connect({
      projectId: 'proj_1',
      client: { accessToken: TOKEN, baseUrl: 'https://example.test', fetch: fetchMock as never },
      ttlMs: 0,
    });
    await tools();
    await tools();
    await tools();
    const missingWarns = warnSpy.mock.calls.filter((call: unknown[]) =>
      String(call[0]).includes('will appear automatically'),
    );
    expect(missingWarns).toHaveLength(1);
  });

  it('skips a directed connection that needs re-auth', async () => {
    installProvider();
    const fetchMock = vi
      .fn()
      .mockResolvedValue(Response.json({ connections: [makeConnection({ id: 'c_stale', status: 'needs_reauth' })] }));
    const tools = await connect({
      projectId: 'proj_1',
      client: { accessToken: TOKEN, baseUrl: 'https://example.test', fetch: fetchMock as never },
      integrations: { linear: { connectionId: 'c_stale' } },
    })();
    expect(tools).toEqual({});
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('needs re-auth'));
  });

  it('skips when multiple active connections exist without a pin', async () => {
    installProvider();
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        connections: [makeConnection({ id: 'c1' }), makeConnection({ id: 'c2' })],
      }),
    );
    const tools = await connect({
      projectId: 'proj_1',
      client: { accessToken: TOKEN, baseUrl: 'https://example.test', fetch: fetchMock as never },
    })();
    expect(tools).toEqual({});
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('2 active connections'));
  });

  it('uses the pinned connection id from integrations override', async () => {
    const { createTools } = installProvider();
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        connections: [makeConnection({ id: 'c1' }), makeConnection({ id: 'c2' })],
      }),
    );
    await connect({
      projectId: 'proj_1',
      client: { accessToken: TOKEN, baseUrl: 'https://example.test', fetch: fetchMock as never },
      integrations: { linear: { connectionId: 'c2' } },
    })();
    expect(createTools).toHaveBeenCalledWith(expect.objectContaining({ connectionId: 'c2' }));
  });

  it('uses the env-var fallback when no pin is given', async () => {
    const { createTools } = installProvider();
    vi.stubEnv('MASTRA_LINEAR_CONNECTION_ID', 'c_env');
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        connections: [makeConnection({ id: 'c_env' }), makeConnection({ id: 'c_other' })],
      }),
    );
    await connect({
      projectId: 'proj_1',
      client: { accessToken: TOKEN, baseUrl: 'https://example.test', fetch: fetchMock as never },
    })();
    expect(createTools).toHaveBeenCalledWith(expect.objectContaining({ connectionId: 'c_env' }));
  });

  it('respects disabled: true and does not include the provider', async () => {
    const { createTools } = installProvider();
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ connections: [makeConnection()] }));
    const tools = await connect({
      projectId: 'proj_1',
      client: { accessToken: TOKEN, baseUrl: 'https://example.test', fetch: fetchMock as never },
      integrations: { linear: { disabled: true } },
    })();
    expect(tools).toEqual({});
    expect(createTools).not.toHaveBeenCalled();
  });

  it('rejects negative ttlMs synchronously', () => {
    installProvider();
    expect(() => connect({ projectId: 'proj_1', client: { accessToken: TOKEN }, ttlMs: -1 })).toThrow(
      expect.objectContaining({ code: 'invalid_options' }),
    );
  });

  it('surfaces multiple providers in one call', async () => {
    installProvider();
    const notionTools = { notion_fake: { id: 'notion_fake' } } as never;
    const notionCreate = vi.fn().mockReturnValue(notionTools);
    testProviders.push({
      integrationId: 'notion',
      envVar: 'MASTRA_NOTION_CONNECTION_ID',
      createTools: notionCreate,
    });
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        connections: [makeConnection(), makeConnection({ id: 'c_not', integrationId: 'notion' })],
      }),
    );
    const tools = await connect({
      projectId: 'proj_1',
      client: { accessToken: TOKEN, baseUrl: 'https://example.test', fetch: fetchMock as never },
    })();
    expect(tools).toEqual({ linear: fakeTools, notion: notionTools });
  });
});
