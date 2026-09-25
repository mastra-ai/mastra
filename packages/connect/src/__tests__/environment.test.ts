import type { WorkspaceSandbox } from '@mastra/core/workspace';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { environment } from '../environment.js';

const TOKEN = 'fake-test-token';
const PROVIDER_TOKEN = 'fake-provider-token';

function makeConnection(overrides?: Record<string, unknown>) {
  return {
    id: 'c_gh1',
    integrationId: 'github',
    status: 'active',
    connectedByUserId: 'user_1',
    connectedAt: '2026-09-01T00:00:00Z',
    createdAt: '2026-09-01T00:00:00Z',
    accountLabel: 'mastra-ai',
    ...overrides,
  };
}

function platformFetch(input: {
  connections?: unknown[];
  credentials?: Record<string, unknown>;
  credentialStatus?: number;
}) {
  return vi.fn<typeof fetch>().mockImplementation(async request => {
    const path = new URL(String(request)).pathname;
    if (path.endsWith('/connections')) {
      return Response.json({ connections: input.connections ?? [] });
    }
    if (path.endsWith('/credentials')) {
      if (input.credentialStatus) {
        return Response.json({ error: 'nope' }, { status: input.credentialStatus });
      }
      return Response.json(
        input.credentials ?? { type: 'oauth2', accessToken: PROVIDER_TOKEN, expiresAt: '2026-10-01T00:00:00Z' },
      );
    }
    return Response.json({ error: `unexpected path ${path}` }, { status: 500 });
  });
}

function options(fetchMock: ReturnType<typeof vi.fn>, extra?: Record<string, unknown>) {
  return {
    projectId: 'proj_1',
    client: { accessToken: TOKEN, baseUrl: 'https://example.test', fetch: fetchMock as unknown as typeof fetch },
    ...extra,
  };
}

let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  warnSpy.mockRestore();
});

describe('environment', () => {
  it('throws without a project id', async () => {
    const fetchMock = platformFetch({});
    await expect(
      environment({ client: { accessToken: TOKEN, fetch: fetchMock as unknown as typeof fetch } }),
    ).rejects.toMatchObject({ code: 'missing_project_id' });
  });

  it('rejects malformed integration override keys', async () => {
    const fetchMock = platformFetch({});
    await expect(environment(options(fetchMock, { integrations: { 'bad key!': {} } }))).rejects.toMatchObject({
      code: 'invalid_options',
    });
  });

  it('returns empty env when the project has no supported connections', async () => {
    const fetchMock = platformFetch({ connections: [makeConnection({ integrationId: 'linear', id: 'c_lin1' })] });
    const result = await environment(options(fetchMock));
    expect(result.env).toEqual({});
    await expect(result.onStart({ sandbox: {} as WorkspaceSandbox })).resolves.toBeUndefined();
  });

  it('maps a github oauth2 credential to GH_TOKEN and GITHUB_TOKEN', async () => {
    const fetchMock = platformFetch({ connections: [makeConnection()] });
    const result = await environment(options(fetchMock));
    expect(result.env).toEqual({ GH_TOKEN: PROVIDER_TOKEN, GITHUB_TOKEN: PROVIDER_TOKEN });
  });

  it('maps a github api_key credential the same way', async () => {
    const fetchMock = platformFetch({
      connections: [makeConnection()],
      credentials: { type: 'api_key', apiKey: 'fake-pat' },
    });
    const result = await environment(options(fetchMock));
    expect(result.env).toEqual({ GH_TOKEN: 'fake-pat', GITHUB_TOKEN: 'fake-pat' });
  });

  it('onStart configures the git credential helper through executeCommand', async () => {
    const fetchMock = platformFetch({ connections: [makeConnection()] });
    const result = await environment(options(fetchMock));
    const executeCommand = vi.fn().mockResolvedValue({ exitCode: 0, stdout: '', stderr: '' });
    await result.onStart({ sandbox: { executeCommand } as unknown as WorkspaceSandbox });
    expect(executeCommand).toHaveBeenCalledTimes(1);
    const [command, args] = executeCommand.mock.calls[0]!;
    expect(command).toBe('git');
    expect(args).toContain('credential.https://github.com.helper');
    // The helper reads $GH_TOKEN at use time; the secret must not be inlined.
    expect(JSON.stringify(args)).not.toContain(PROVIDER_TOKEN);
  });

  it('onStart warns and continues when the sandbox lacks executeCommand', async () => {
    const fetchMock = platformFetch({ connections: [makeConnection()] });
    const result = await environment(options(fetchMock));
    await expect(result.onStart({ sandbox: {} as WorkspaceSandbox })).resolves.toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('skipping git credential setup'));
  });

  it('skips a disabled provider', async () => {
    const fetchMock = platformFetch({ connections: [makeConnection()] });
    const result = await environment(options(fetchMock, { integrations: { github: { disabled: true } } }));
    expect(result.env).toEqual({});
  });

  it('skips on ambiguity between active connections and warns', async () => {
    const fetchMock = platformFetch({
      connections: [makeConnection(), makeConnection({ id: 'c_gh2' })],
    });
    const result = await environment(options(fetchMock));
    expect(result.env).toEqual({});
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('2 active connections'));
  });

  it('resolves ambiguity with a pinned connectionId', async () => {
    const fetchMock = platformFetch({
      connections: [makeConnection(), makeConnection({ id: 'c_gh2' })],
    });
    const result = await environment(options(fetchMock, { integrations: { github: { connectionId: 'c_gh2' } } }));
    expect(result.env).toEqual({ GH_TOKEN: PROVIDER_TOKEN, GITHUB_TOKEN: PROVIDER_TOKEN });
  });

  it('resolves ambiguity with the MASTRA_GITHUB_CONNECTION_ID env var', async () => {
    vi.stubEnv('MASTRA_GITHUB_CONNECTION_ID', 'c_gh2');
    const fetchMock = platformFetch({
      connections: [makeConnection(), makeConnection({ id: 'c_gh2' })],
    });
    const result = await environment(options(fetchMock));
    expect(result.env).toEqual({ GH_TOKEN: PROVIDER_TOKEN, GITHUB_TOKEN: PROVIDER_TOKEN });
  });

  it('never maps a needs_reauth connection', async () => {
    const fetchMock = platformFetch({ connections: [makeConnection({ status: 'needs_reauth' })] });
    const result = await environment(options(fetchMock));
    expect(result.env).toEqual({});
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('no active connections'));
  });

  it('warns and skips the provider when the credential fetch fails', async () => {
    const fetchMock = platformFetch({ connections: [makeConnection()], credentialStatus: 500 });
    const result = await environment(options(fetchMock));
    expect(result.env).toEqual({});
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Skipping github environment'));
  });
});
