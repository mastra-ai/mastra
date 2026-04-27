import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resolveTarget } from './target';

const mocks = vi.hoisted(() => ({
  getToken: vi.fn(),
  fetchServerProjects: vi.fn(),
  loadProjectConfig: vi.fn(),
}));

vi.mock('../auth/credentials.js', () => ({
  getToken: mocks.getToken,
}));

vi.mock('../server/platform-api.js', () => ({
  fetchServerProjects: mocks.fetchServerProjects,
}));

vi.mock('../studio/project-config.js', () => ({
  loadProjectConfig: mocks.loadProjectConfig,
}));

const fetchMock = vi.fn();

describe('resolveTarget', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    vi.clearAllMocks();
    fetchMock.mockRejectedValue(new Error('local unavailable'));
    mocks.getToken.mockResolvedValue('platform-token');
    mocks.loadProjectConfig.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses an explicit URL without probing local or adding platform auth', async () => {
    await expect(
      resolveTarget({
        url: 'https://runtime.example.com',
        header: ['Authorization: Bearer custom', 'X-Test: yes'],
        timeout: '1234',
        pretty: false,
      }),
    ).resolves.toEqual({
      baseUrl: 'https://runtime.example.com',
      headers: { Authorization: 'Bearer custom', 'X-Test': 'yes' },
      timeoutMs: 1234,
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(mocks.loadProjectConfig).not.toHaveBeenCalled();
    expect(mocks.getToken).not.toHaveBeenCalled();
    expect(mocks.fetchServerProjects).not.toHaveBeenCalled();
  });

  it('uses localhost when the default server is reachable', async () => {
    const cancel = vi.fn();
    fetchMock.mockResolvedValueOnce({ body: { cancel } });

    await expect(resolveTarget({ header: ['X-Test: yes'], timeout: '5000', pretty: false })).resolves.toEqual({
      baseUrl: 'http://localhost:4111',
      headers: { 'X-Test': 'yes' },
      timeoutMs: 5000,
    });

    expect(fetchMock).toHaveBeenCalledWith('http://localhost:4111/api/system/api-schema', {
      method: 'GET',
      signal: expect.any(AbortSignal),
    });
    expect(cancel).toHaveBeenCalledOnce();
    expect(mocks.loadProjectConfig).not.toHaveBeenCalled();
  });

  it('falls back to platform project discovery when localhost is unavailable', async () => {
    mocks.loadProjectConfig.mockResolvedValue({
      projectId: 'project-1',
      projectName: 'Project One',
      projectSlug: 'project-one',
      organizationId: 'org-1',
    });
    mocks.fetchServerProjects.mockResolvedValue([
      { id: 'project-2', slug: 'other', instanceUrl: 'https://other.example.com' },
      { id: 'project-1', slug: 'project-one', instanceUrl: 'https://project.example.com' },
    ]);

    await expect(resolveTarget({ header: ['X-Test: yes'], pretty: false })).resolves.toEqual({
      baseUrl: 'https://project.example.com',
      headers: { Authorization: 'Bearer platform-token', 'X-Test': 'yes' },
      timeoutMs: 30_000,
    });

    expect(mocks.loadProjectConfig).toHaveBeenCalledWith(process.cwd());
    expect(mocks.getToken).toHaveBeenCalled();
    expect(mocks.fetchServerProjects).toHaveBeenCalledWith('platform-token', 'org-1');
  });

  it('matches platform projects by slug when project ID does not match', async () => {
    mocks.loadProjectConfig.mockResolvedValue({
      projectId: 'missing-id',
      projectName: 'Project One',
      projectSlug: 'project-one',
      organizationId: 'org-1',
    });
    mocks.fetchServerProjects.mockResolvedValue([
      { id: 'project-1', slug: 'project-one', instanceUrl: 'https://slug.example.com' },
    ]);

    await expect(resolveTarget({ header: [], pretty: false })).resolves.toMatchObject({
      baseUrl: 'https://slug.example.com',
    });
  });

  it('throws SERVER_UNREACHABLE when localhost and project config are unavailable', async () => {
    await expect(resolveTarget({ header: [], pretty: false })).rejects.toMatchObject({
      code: 'SERVER_UNREACHABLE',
      message: 'Could not connect to target server',
    });
  });

  it('throws PLATFORM_RESOLUTION_FAILED when the linked project has no runtime URL', async () => {
    mocks.loadProjectConfig.mockResolvedValue({
      projectId: 'project-1',
      projectName: 'Project One',
      projectSlug: 'project-one',
      organizationId: 'org-1',
    });
    mocks.fetchServerProjects.mockResolvedValue([{ id: 'project-1', slug: 'project-one' }]);

    await expect(resolveTarget({ header: [], pretty: false })).rejects.toMatchObject({
      code: 'PLATFORM_RESOLUTION_FAILED',
      details: { projectId: 'project-1', projectSlug: 'project-one' },
    });
  });

  it('wraps platform lookup failures in PLATFORM_RESOLUTION_FAILED', async () => {
    mocks.loadProjectConfig.mockResolvedValue({
      projectId: 'project-1',
      projectName: 'Project One',
      organizationId: 'org-1',
    });
    mocks.fetchServerProjects.mockRejectedValue(new Error('platform down'));

    await expect(resolveTarget({ header: [], pretty: false })).rejects.toMatchObject({
      code: 'PLATFORM_RESOLUTION_FAILED',
      details: { message: 'platform down' },
    });
  });

  it('defaults invalid timeout values to 30 seconds', async () => {
    await expect(
      resolveTarget({ url: 'https://runtime.example.com', header: [], timeout: '-1', pretty: false }),
    ).resolves.toMatchObject({
      timeoutMs: 30_000,
    });
    await expect(
      resolveTarget({ url: 'https://runtime.example.com', header: [], timeout: 'not-a-number', pretty: false }),
    ).resolves.toMatchObject({
      timeoutMs: 30_000,
    });
  });

  it('throws malformed header errors before probing targets', async () => {
    await expect(resolveTarget({ header: ['invalid'], pretty: false })).rejects.toMatchObject({
      code: 'MALFORMED_HEADER',
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(mocks.loadProjectConfig).not.toHaveBeenCalled();
  });
});
