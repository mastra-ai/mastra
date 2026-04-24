import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

/* ------------------------------------------------------------------ */
/*  Mocks                                                              */
/* ------------------------------------------------------------------ */

const mockGetToken = vi.fn().mockResolvedValue('test-token');
const mockGetCurrentOrgId = vi.fn().mockResolvedValue('org-1');

vi.mock('../auth/credentials.js', () => ({
  getToken: mockGetToken,
  getCurrentOrgId: mockGetCurrentOrgId,
  validateOrgAccess: vi.fn().mockResolvedValue(undefined),
}));

const mockFetchProjects = vi.fn();
const mockFetchDeployStatus = vi.fn();

vi.mock('./platform-api.js', () => ({
  fetchProjects: mockFetchProjects,
  fetchDeployStatus: mockFetchDeployStatus,
}));

vi.mock('../auth/client.js', () => ({
  MASTRA_PLATFORM_API_URL: 'http://localhost:9999',
  createApiClient: vi.fn(() => ({
    GET: vi.fn().mockResolvedValue({ data: { logs: 'log line 1\nlog line 2' } }),
  })),
  authHeaders: vi.fn((token: string, orgId?: string) => {
    const h: Record<string, string> = { Authorization: `Bearer ${token}` };
    if (orgId) h['x-organization-id'] = orgId;
    return h;
  }),
}));

beforeEach(() => {
  vi.resetAllMocks();
  mockGetToken.mockResolvedValue('test-token');
  mockGetCurrentOrgId.mockResolvedValue('org-1');
});

afterEach(() => {
  vi.restoreAllMocks();
});

/* ------------------------------------------------------------------ */
/*  deploy list                                                        */
/* ------------------------------------------------------------------ */

describe('deploysAction', () => {
  it('lists projects with deploy status', async () => {
    mockFetchProjects.mockResolvedValue([
      {
        id: 'p1',
        name: 'App 1',
        organizationId: 'org-1',
        latestDeployId: 'd1',
        latestDeployStatus: 'running',
        instanceUrl: 'https://app1.example.com',
      },
      {
        id: 'p2',
        name: 'App 2',
        organizationId: 'org-1',
        latestDeployId: null,
        latestDeployStatus: null,
        instanceUrl: null,
      },
    ]);

    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const { deploysAction } = await import('./deploy-list.js');
    await deploysAction();

    const output = spy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('App 1');
    expect(output).toContain('App 2');
    expect(output).toContain('https://app1.example.com');
    spy.mockRestore();
  });

  it('shows message when no deploys', async () => {
    mockFetchProjects.mockResolvedValue([]);

    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const { deploysAction } = await import('./deploy-list.js');
    await deploysAction();

    const output = spy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('No deploys');
    spy.mockRestore();
  });

  it('exits when no org selected', async () => {
    mockGetCurrentOrgId.mockResolvedValue(null);
    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit');
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const { deploysAction } = await import('./deploy-list.js');
    await expect(deploysAction()).rejects.toThrow('process.exit');

    expect(mockExit).toHaveBeenCalledWith(1);
    mockExit.mockRestore();
  });
});

/* ------------------------------------------------------------------ */
/*  deploy status                                                      */
/* ------------------------------------------------------------------ */

describe('statusAction', () => {
  it('displays deploy status', async () => {
    mockFetchDeployStatus.mockResolvedValue({
      id: 'd1',
      status: 'running',
      instanceUrl: 'https://example.com',
      error: null,
      projectName: 'My App',
      createdAt: '2025-06-01T00:00:00Z',
    });

    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const { statusAction } = await import('./deploy-status.js');
    await statusAction('d1', {});

    const output = spy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('d1');
    expect(output).toContain('running');
    expect(output).toContain('My App');
    expect(output).toContain('https://example.com');
    spy.mockRestore();
  });

  it('displays error info for failed deploy', async () => {
    mockFetchDeployStatus.mockResolvedValue({
      id: 'd2',
      status: 'failed',
      instanceUrl: null,
      error: 'build failed',
      projectName: 'My App',
      createdAt: '2025-06-01T00:00:00Z',
    });

    const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const { statusAction } = await import('./deploy-status.js');
    await statusAction('d2', {});

    const output = spy.mock.calls.map(c => c[0]).join('\n');
    expect(output).toContain('failed');
    expect(output).toContain('build failed');
    spy.mockRestore();
  });

  it('exits when no org selected', async () => {
    mockGetCurrentOrgId.mockResolvedValue(null);
    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit');
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const { statusAction } = await import('./deploy-status.js');
    await expect(statusAction('d1', {})).rejects.toThrow('process.exit');

    expect(mockExit).toHaveBeenCalledWith(1);
    mockExit.mockRestore();
  });
});

/* ------------------------------------------------------------------ */
/*  deploy logs                                                        */
/* ------------------------------------------------------------------ */

describe('logsAction', () => {
  it('exits when no org selected', async () => {
    mockGetCurrentOrgId.mockResolvedValue(null);
    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit');
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const { logsAction } = await import('./deploy-logs.js');
    await expect(logsAction('d1', {})).rejects.toThrow('process.exit');

    expect(mockExit).toHaveBeenCalledWith(1);
    mockExit.mockRestore();
  });
});
