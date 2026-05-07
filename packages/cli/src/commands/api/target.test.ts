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
const options = (overrides: Partial<Parameters<typeof resolveTarget>[0]> = {}) => ({
  header: [],
  pretty: false,
  ...overrides,
});
const linkedProject = {
  projectId: 'project-1',
  projectName: 'Project One',
  projectSlug: 'project-one',
  organizationId: 'org-1',
};

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

  it('uses an explicit URL with only custom headers and no discovery', async () => {
    await expect(
      resolveTarget(
        options({
          url: 'https://runtime.example.com',
          header: ['Authorization: Bearer custom', 'X-Test: yes'],
          timeout: '1234',
        }),
      ),
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

  it('uses localhost when the default server is reachable and cancels the probe body', async () => {
    const cancel = vi.fn();
    fetchMock.mockResolvedValueOnce({ ok: true, body: { cancel } });

    await expect(resolveTarget(options({ header: ['X-Test: yes'], timeout: '5000' }))).resolves.toEqual({
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

  it('falls back to linked platform project discovery by ID or slug', async () => {
    mocks.loadProjectConfig.mockResolvedValueOnce(linkedProject).mockResolvedValueOnce({
      ...linkedProject,
      projectId: 'missing-id',
    });
    mocks.fetchServerProjects
      .mockResolvedValueOnce([
        { id: 'project-2', slug: 'other', instanceUrl: 'https://other.example.com' },
        { id: 'project-1', slug: 'project-one', instanceUrl: 'https://project.example.com' },
      ])
      .mockResolvedValueOnce([{ id: 'project-1', slug: 'project-one', instanceUrl: 'https://slug.example.com' }]);

    await expect(resolveTarget(options({ header: ['X-Test: yes'] }))).resolves.toEqual({
      baseUrl: 'https://project.example.com',
      headers: { Authorization: 'Bearer platform-token', 'X-Test': 'yes' },
      timeoutMs: 30_000,
    });
    await expect(resolveTarget(options())).resolves.toMatchObject({ baseUrl: 'https://slug.example.com' });

    expect(mocks.loadProjectConfig).toHaveBeenCalledWith(process.cwd());
    expect(mocks.getToken).toHaveBeenCalledTimes(2);
    expect(mocks.fetchServerProjects).toHaveBeenCalledWith('platform-token', 'org-1');
  });

  it('does not use localhost when the probe returns a non-2xx response', async () => {
    const cancel = vi.fn();
    fetchMock.mockResolvedValueOnce({ ok: false, body: { cancel } });
    mocks.loadProjectConfig.mockResolvedValueOnce(linkedProject);
    mocks.fetchServerProjects.mockResolvedValueOnce([
      { id: 'project-1', slug: 'project-one', instanceUrl: 'https://project.example.com' },
    ]);

    await expect(resolveTarget(options())).resolves.toMatchObject({
      baseUrl: 'https://project.example.com',
    });

    expect(cancel).toHaveBeenCalledOnce();
    expect(mocks.loadProjectConfig).toHaveBeenCalledWith(process.cwd());
    expect(mocks.fetchServerProjects).toHaveBeenCalledOnce();
  });

  it('throws target resolution errors for missing local/project/platform URL cases', async () => {
    await expect(resolveTarget(options())).rejects.toMatchObject({
      code: 'SERVER_UNREACHABLE',
      message: 'Could not connect to target server',
    });

    mocks.loadProjectConfig.mockResolvedValue(linkedProject);
    mocks.fetchServerProjects.mockResolvedValue([{ id: 'project-1', slug: 'project-one' }]);
    await expect(resolveTarget(options())).rejects.toMatchObject({
      code: 'PLATFORM_RESOLUTION_FAILED',
      details: { projectId: 'project-1', projectSlug: 'project-one' },
    });

    mocks.fetchServerProjects.mockRejectedValue(new Error('platform down'));
    await expect(resolveTarget(options())).rejects.toMatchObject({
      code: 'PLATFORM_RESOLUTION_FAILED',
      details: { message: 'platform down' },
    });
  });

  it.each(['-1', 'not-a-number'])(`defaults invalid timeout %s to 30 seconds`, async timeout => {
    await expect(resolveTarget(options({ url: 'https://runtime.example.com', timeout }))).resolves.toMatchObject({
      timeoutMs: 30_000,
    });
  });

  it('throws malformed header errors before probing targets', async () => {
    await expect(resolveTarget(options({ header: ['invalid'] }))).rejects.toMatchObject({
      code: 'MALFORMED_HEADER',
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(mocks.loadProjectConfig).not.toHaveBeenCalled();
  });
});
