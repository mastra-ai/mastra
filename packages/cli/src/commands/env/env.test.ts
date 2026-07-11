import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isActiveDeployStatus, latestDeployByEnvironment } from './env.js';
import type { EnvironmentDeploy } from './platform-api.js';
import { restartEnvironment } from './platform-api.js';

function deploy(overrides: Partial<EnvironmentDeploy>): EnvironmentDeploy {
  return {
    id: 'd-1',
    projectId: 'proj-1',
    organizationId: 'org-1',
    environmentId: 'env-1',
    projectName: 'My App',
    environmentName: 'Production',
    environmentSlug: 'my-app',
    region: null,
    status: 'running',
    instanceUrl: null,
    error: null,
    errorCode: null,
    createdAt: '2026-07-09T00:00:00.000Z',
    githubBranch: null,
    githubCommitSha: null,
    ...overrides,
  };
}

describe('latestDeployByEnvironment', () => {
  it('keeps the newest deploy per environment', () => {
    const deploys = [
      deploy({ id: 'old', environmentId: 'env-1', createdAt: '2026-07-01T00:00:00.000Z', status: 'failed' }),
      deploy({ id: 'new', environmentId: 'env-1', createdAt: '2026-07-08T00:00:00.000Z', status: 'running' }),
      deploy({ id: 'other-env', environmentId: 'env-2', createdAt: '2026-07-05T00:00:00.000Z', status: 'stopped' }),
    ];

    const latest = latestDeployByEnvironment(deploys);
    expect(latest.get('env-1')?.id).toBe('new');
    expect(latest.get('env-2')?.id).toBe('other-env');
  });

  it('handles null createdAt without dropping deploys', () => {
    const deploys = [deploy({ id: 'no-date', createdAt: null })];
    expect(latestDeployByEnvironment(deploys).get('env-1')?.id).toBe('no-date');
  });
});

describe('isActiveDeployStatus', () => {
  it('treats running and sleeping deploys as active', () => {
    expect(isActiveDeployStatus('running')).toBe(true);
    expect(isActiveDeployStatus('sleeping')).toBe(true);
  });

  it('treats terminal and in-flight statuses as inactive', () => {
    expect(isActiveDeployStatus('failed')).toBe(false);
    expect(isActiveDeployStatus('building')).toBe(false);
    expect(isActiveDeployStatus('stopped')).toBe(false);
  });
});

describe('restartEnvironment', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    vi.stubEnv('MASTRA_PLATFORM_API_URL', 'http://localhost:9999');
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('posts to the restart endpoint', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ status: 'ok' }) });

    await expect(restartEnvironment('tok', 'org-1', 'proj-1', 'env-1')).resolves.toBeUndefined();

    const [url, init] = mockFetch.mock.calls[0]!;
    expect(url).toBe('http://localhost:9999/v1/projects/proj-1/environments/env-1/restart');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({ Authorization: 'Bearer tok', 'x-organization-id': 'org-1' });
  });

  it('surfaces the 409 never-deployed detail', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ detail: 'Environment has no active deployment to restart' }),
    });

    await expect(restartEnvironment('tok', 'org-1', 'proj-1', 'env-1')).rejects.toThrow(
      'Environment has no active deployment to restart',
    );
  });

  it('surfaces the 402 billing detail', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 402,
      json: async () => ({ detail: 'Billing grace period has elapsed. Add credits or upgrade your plan.' }),
    });

    await expect(restartEnvironment('tok', 'org-1', 'proj-1', 'env-1')).rejects.toThrow(
      'Billing grace period has elapsed',
    );
  });

  it('throws session expired on 401', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 401, json: async () => ({}) });

    await expect(restartEnvironment('tok', 'org-1', 'proj-1', 'env-1')).rejects.toThrow(
      'Session expired. Run: mastra auth login',
    );
  });
});
