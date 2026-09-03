import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { connect } from '../connect.js';
import { PROVIDERS } from '../registry.js';
import type { ProviderRegistration } from '../registry.js';

const TOKEN = 'fake-test-token';

const fakeTools = { linear_fake_tool: { id: 'linear_fake_tool' } } as never;

function stubProvider(overrides?: Partial<ProviderRegistration>): { createTools: ReturnType<typeof vi.fn> } {
  const createTools = vi.fn().mockReturnValue(fakeTools);
  PROVIDERS.linear = {
    integrationId: 'linear',
    envVar: 'MASTRA_LINEAR_CONNECTION_ID',
    createTools,
    ...overrides,
  };
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

function clientFor(connections: unknown[]) {
  const fetchMock = vi.fn().mockResolvedValue(Response.json({ connections }));
  return {
    projectId: 'proj_1',
    client: { accessToken: TOKEN, baseUrl: 'https://example.test', fetch: fetchMock as unknown as typeof fetch },
  };
}

let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  delete PROVIDERS.linear;
  vi.unstubAllEnvs();
  warnSpy.mockRestore();
});

describe('connect', () => {
  it('throws missing_project_id without a project id', async () => {
    vi.stubEnv('MASTRA_PROJECT_ID', '');
    await expect(connect({ client: { accessToken: TOKEN } })).rejects.toMatchObject({ code: 'missing_project_id' });
  });

  it('falls back to MASTRA_PROJECT_ID', async () => {
    stubProvider();
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ connections: [] }));
    vi.stubEnv('MASTRA_PROJECT_ID', 'proj_env');
    await connect({ client: { accessToken: TOKEN, baseUrl: 'https://example.test', fetch: fetchMock as never } });
    expect(String(fetchMock.mock.calls[0]![0])).toContain('/v2/projects/proj_env/connections');
  });

  it('returns a toolset per supported connected provider (undirected)', async () => {
    const { createTools } = stubProvider();
    const result = await connect(clientFor([makeConnection()]));
    expect(Object.keys(result)).toEqual(['linear']);
    expect(result.linear).toBe(fakeTools);
    expect(createTools).toHaveBeenCalledWith(expect.objectContaining({ connectionId: 'c_lin1' }));
  });

  it('warns and skips unsupported platform integrations', async () => {
    stubProvider();
    const result = await connect(
      clientFor([makeConnection(), makeConnection({ id: 'c_unk1', integrationId: 'salesforce' })]),
    );
    expect(Object.keys(result)).toEqual(['linear']);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('salesforce'));
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('c_unk1'));
  });

  it('treats the integrations option as an allowlist', async () => {
    stubProvider();
    const result = await connect({ ...clientFor([makeConnection()]), integrations: { linear: true } });
    expect(Object.keys(result)).toEqual(['linear']);
  });

  it('excludes providers marked false without throwing', async () => {
    stubProvider();
    const result = await connect({ ...clientFor([makeConnection()]), integrations: { linear: false } });
    expect(result).toEqual({});
  });

  it('throws connection_not_found for listed providers with no project connection', async () => {
    stubProvider();
    await expect(connect({ ...clientFor([]), integrations: { linear: true } })).rejects.toMatchObject({
      code: 'connection_not_found',
    });
  });

  it('never throws for false entries even when the provider is absent', async () => {
    stubProvider();
    await expect(connect({ ...clientFor([]), integrations: { linear: false } })).resolves.toEqual({});
  });

  it('passes allowTools from the integration options through to the builder', async () => {
    const { createTools } = stubProvider();
    await connect({
      ...clientFor([makeConnection()]),
      integrations: { linear: { allowTools: ['linear_fake_tool'] } },
    });
    expect(createTools).toHaveBeenCalledWith(expect.objectContaining({ allowTools: ['linear_fake_tool'] }));
  });

  it('lets the env var pick among multiple connections', async () => {
    const { createTools } = stubProvider();
    vi.stubEnv('MASTRA_LINEAR_CONNECTION_ID', 'c_lin2');
    await connect(clientFor([makeConnection(), makeConnection({ id: 'c_lin2' })]));
    expect(createTools).toHaveBeenCalledWith(expect.objectContaining({ connectionId: 'c_lin2' }));
  });

  it('lets an explicit connectionId option win over ambiguity', async () => {
    const { createTools } = stubProvider();
    await connect({
      ...clientFor([makeConnection(), makeConnection({ id: 'c_lin2' })]),
      integrations: { linear: { connectionId: 'c_lin1' } },
    });
    expect(createTools).toHaveBeenCalledWith(expect.objectContaining({ connectionId: 'c_lin1' }));
  });

  it('throws multiple_connections when an explicitly requested provider is ambiguous', async () => {
    stubProvider();
    await expect(
      connect({
        ...clientFor([makeConnection(), makeConnection({ id: 'c_lin2' })]),
        integrations: { linear: true },
      }),
    ).rejects.toMatchObject({ code: 'multiple_connections' });
  });

  it('warns and skips ambiguous providers in undirected mode, listing candidates', async () => {
    stubProvider();
    const result = await connect(clientFor([makeConnection(), makeConnection({ id: 'c_lin2' })]));
    expect(result).toEqual({});
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('c_lin1'));
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('c_lin2'));
  });

  it('throws needs_reauth when an explicitly requested provider only has needs_reauth connections', async () => {
    stubProvider();
    await expect(
      connect({
        ...clientFor([makeConnection({ status: 'needs_reauth' })]),
        integrations: { linear: true },
      }),
    ).rejects.toMatchObject({ code: 'needs_reauth' });
  });

  it('warns and skips needs_reauth providers in undirected mode', async () => {
    stubProvider();
    const result = await connect(clientFor([makeConnection({ status: 'needs_reauth' })]));
    expect(result).toEqual({});
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('re-authentication'));
  });

  it('throws needs_reauth when the env var names a needs_reauth connection', async () => {
    stubProvider();
    vi.stubEnv('MASTRA_LINEAR_CONNECTION_ID', 'c_lin1');
    await expect(connect(clientFor([makeConnection({ status: 'needs_reauth' })]))).rejects.toMatchObject({
      code: 'needs_reauth',
    });
  });

  it('tolerates connections with unknown statuses: skips them in undirected mode', async () => {
    stubProvider();
    const result = await connect(clientFor([makeConnection({ status: 'pending' })]));
    expect(result).toEqual({});
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('c_lin1: pending'));
  });

  it('throws connection_not_found when an explicitly requested provider only has unknown-status connections', async () => {
    stubProvider();
    await expect(
      connect({ ...clientFor([makeConnection({ status: 'pending' })]), integrations: { linear: true } }),
    ).rejects.toMatchObject({ code: 'connection_not_found' });
  });

  it('an unknown status on one connection does not break resolution of an active one', async () => {
    const { createTools } = stubProvider();
    const result = await connect(clientFor([makeConnection({ id: 'c_lin2', status: 'pending' }), makeConnection()]));
    expect(Object.keys(result)).toEqual(['linear']);
    expect(createTools).toHaveBeenCalledWith(expect.objectContaining({ connectionId: 'c_lin1' }));
  });

  it('rejects unknown integration keys in options', async () => {
    stubProvider();
    await expect(
      connect({ ...clientFor([makeConnection()]), integrations: { salesforce: true } as never }),
    ).rejects.toMatchObject({ code: 'connection_not_found' });
  });
});
