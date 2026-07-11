import process from 'node:process';

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
const mockFetchDeployDiagnosis = vi.fn();
const mockStartDeployDiagnosis = vi.fn();
const mockLoadProjectConfig = vi.fn();

vi.mock('./platform-api.js', () => ({
  fetchProjects: mockFetchProjects,
  fetchDeployStatus: mockFetchDeployStatus,
  fetchDeployDiagnosis: mockFetchDeployDiagnosis,
  startDeployDiagnosis: mockStartDeployDiagnosis,
}));

vi.mock('./project-config.js', () => ({
  loadProjectConfig: mockLoadProjectConfig,
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

const mockClackIntro = vi.fn();
const mockClackOutro = vi.fn();
const mockClackLogError = vi.fn();
const mockClackLogInfo = vi.fn();
const mockClackLogStep = vi.fn();
const mockClackLogMessage = vi.fn();
const mockClackLogWarn = vi.fn();
const mockClackSpinnerStart = vi.fn();
const mockClackSpinnerStop = vi.fn();

vi.mock('../../utils/polling.js', () => ({
  withPollingRetries: (fn: () => unknown) => fn(),
}));

vi.mock('@clack/prompts', () => ({
  intro: (...args: unknown[]) => mockClackIntro(...args),
  outro: (...args: unknown[]) => mockClackOutro(...args),
  spinner: () => ({
    start: (...args: unknown[]) => mockClackSpinnerStart(...args),
    stop: (...args: unknown[]) => mockClackSpinnerStop(...args),
  }),
  log: {
    error: (...args: unknown[]) => mockClackLogError(...args),
    info: (...args: unknown[]) => mockClackLogInfo(...args),
    step: (...args: unknown[]) => mockClackLogStep(...args),
    message: (...args: unknown[]) => mockClackLogMessage(...args),
    warn: (...args: unknown[]) => mockClackLogWarn(...args),
  },
}));

beforeEach(() => {
  vi.resetAllMocks();
  mockGetToken.mockResolvedValue('test-token');
  mockGetCurrentOrgId.mockResolvedValue('org-1');
  mockLoadProjectConfig.mockResolvedValue(null);
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

describe('suggestionsAction', () => {
  it('prints diagnosis summary and recommendations', async () => {
    mockFetchDeployDiagnosis.mockResolvedValue({
      state: 'ready',
      diagnosis: {
        id: 'diag-1',
        deployId: 'd1',
        status: 'COMPLETE',
        summary: 'Missing environment variables caused startup failure.',
        recommendations: [
          {
            title: 'Add OPENAI_API_KEY',
            description: 'The deployment could not find OPENAI_API_KEY.',
            action: 'Set OPENAI_API_KEY in your deploy environment and redeploy.',
            docsUrl: 'https://mastra.ai/docs/env',
          },
        ],
        error: null,
        createdAt: '2025-06-01T00:00:00Z',
        completedAt: '2025-06-01T00:00:05Z',
      },
    });

    const { suggestionsAction } = await import('./deploy-suggestions.js');
    await suggestionsAction('d1');

    const allMessages = mockClackLogMessage.mock.calls.map((c: unknown[]) => String(c[0])).join('\n');
    expect(allMessages).toContain('Deploy Suggestions');
    expect(allMessages).toContain('Missing environment variables');
    expect(allMessages).toContain('Add OPENAI_API_KEY');
    expect(allMessages).toContain('https://mastra.ai/docs/env');
  });

  it('reports when a deploy is already running', async () => {
    mockFetchDeployDiagnosis.mockResolvedValue({ state: 'healthy' });

    const { suggestionsAction } = await import('./deploy-suggestions.js');
    await suggestionsAction('d1');

    expect(mockClackOutro).toHaveBeenCalledWith('Deploy is running successfully. No suggestions required.');
  });

  it('starts a diagnosis when none exists and then prints suggestions', async () => {
    mockFetchDeployDiagnosis.mockResolvedValueOnce({ state: 'missing' }).mockResolvedValueOnce({
      state: 'ready',
      diagnosis: {
        id: 'diag-2',
        deployId: 'd1',
        status: 'COMPLETE',
        summary: 'Missing environment variables caused startup failure.',
        recommendations: [],
        error: null,
        createdAt: '2025-06-01T00:00:00Z',
        completedAt: '2025-06-01T00:00:05Z',
      },
    });

    const { suggestionsAction } = await import('./deploy-suggestions.js');
    await suggestionsAction('d1');

    expect(mockStartDeployDiagnosis).toHaveBeenCalledWith('d1', 'test-token', 'org-1');
    expect(mockFetchDeployDiagnosis).toHaveBeenCalledTimes(2);
    expect(mockClackLogWarn).toHaveBeenCalled();
    const warnMsg = String(mockClackLogWarn.mock.calls[0][0]);
    expect(warnMsg).toContain('No suggestions could be generated');
  });

  it('defaults to the linked project latest deploy when deploy id is omitted', async () => {
    mockLoadProjectConfig.mockResolvedValue({ projectId: 'p2', organizationId: 'org-1' });
    mockFetchProjects.mockResolvedValue([
      {
        id: 'p1',
        name: 'App 1',
        slug: 'app-1',
        organizationId: 'org-1',
        latestDeployId: 'd1',
        latestDeployStatus: 'failed',
        latestDeployCreatedAt: '2025-06-01T00:00:00Z',
        instanceUrl: null,
        createdAt: null,
        updatedAt: null,
      },
      {
        id: 'p2',
        name: 'App 2',
        slug: 'app-2',
        organizationId: 'org-1',
        latestDeployId: 'd2',
        latestDeployStatus: 'failed',
        latestDeployCreatedAt: '2025-06-01T00:00:01Z',
        instanceUrl: null,
        createdAt: null,
        updatedAt: null,
      },
    ]);
    mockFetchDeployDiagnosis.mockResolvedValue({
      state: 'ready',
      diagnosis: {
        id: 'diag-1',
        deployId: 'd2',
        status: 'COMPLETE',
        summary: 'Missing environment variables caused startup failure.',
        recommendations: [],
        error: null,
        createdAt: '2025-06-01T00:00:00Z',
        completedAt: '2025-06-01T00:00:05Z',
      },
    });

    const { suggestionsAction } = await import('./deploy-suggestions.js');
    await suggestionsAction();

    expect(mockFetchDeployDiagnosis).toHaveBeenCalledWith('d2', 'test-token', 'org-1');
    expect(mockClackLogInfo).toHaveBeenCalledWith('Using latest deploy: d2 (App 2)');
    expect(mockClackLogWarn).toHaveBeenCalled();
    const warnMsg = String(mockClackLogWarn.mock.calls[0][0]);
    expect(warnMsg).toContain('No suggestions could be generated');
  });

  it('tells the user how to deploy and rerun suggestions when the linked studio project has no deploys', async () => {
    mockLoadProjectConfig.mockResolvedValue({ projectId: 'p2', organizationId: 'org-1' });
    mockFetchProjects.mockResolvedValue([
      {
        id: 'p1',
        name: 'App 1',
        slug: 'app-1',
        organizationId: 'org-1',
        latestDeployId: 'd1',
        latestDeployStatus: 'failed',
        latestDeployCreatedAt: '2025-06-01T00:00:00Z',
        instanceUrl: null,
        createdAt: null,
        updatedAt: null,
      },
      {
        id: 'p2',
        name: 'App 2',
        slug: 'app-2',
        organizationId: 'org-1',
        latestDeployId: null,
        latestDeployStatus: null,
        latestDeployCreatedAt: null,
        instanceUrl: null,
        createdAt: null,
        updatedAt: null,
      },
    ]);

    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit');
    });

    const { suggestionsAction } = await import('./deploy-suggestions.js');
    await expect(suggestionsAction()).rejects.toThrow('process.exit');

    expect(mockClackLogError).toHaveBeenCalledWith(
      'No deploys found for linked Studio project App 2. The suggestions command helps debug failed deployments, and you can run it after a deployment fails with `mastra studio deploy suggestions <deploy-id>` or `mastra studio deploy suggestions`.',
    );
    expect(mockFetchDeployDiagnosis).not.toHaveBeenCalled();
    mockExit.mockRestore();
  });

  it('fails fast when linked project is not found in the org', async () => {
    mockLoadProjectConfig.mockResolvedValue({ projectId: 'deleted-project', organizationId: 'org-1' });
    mockFetchProjects.mockResolvedValue([
      {
        id: 'p1',
        name: 'App 1',
        slug: 'app-1',
        organizationId: 'org-1',
        latestDeployId: 'd1',
        latestDeployStatus: 'failed',
        latestDeployCreatedAt: '2025-06-01T00:00:00Z',
        instanceUrl: null,
        createdAt: null,
        updatedAt: null,
      },
    ]);

    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit');
    });

    const { suggestionsAction } = await import('./deploy-suggestions.js');
    await expect(suggestionsAction()).rejects.toThrow('process.exit');

    expect(mockClackLogError).toHaveBeenCalledWith(
      'Linked Studio project deleted-project was not found in this organization. Re-link your project or pass a deploy ID explicitly.',
    );
    expect(mockFetchDeployDiagnosis).not.toHaveBeenCalled();
    mockExit.mockRestore();
  });

  it('exits when diagnosis failed', async () => {
    mockFetchDeployDiagnosis.mockResolvedValue({
      state: 'ready',
      diagnosis: {
        id: 'diag-1',
        deployId: 'd1',
        status: 'FAILED',
        summary: null,
        recommendations: null,
        error: 'doctor timeout',
        createdAt: '2025-06-01T00:00:00Z',
        completedAt: '2025-06-01T00:00:05Z',
      },
    });
    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit');
    });

    const { suggestionsAction } = await import('./deploy-suggestions.js');
    await expect(suggestionsAction('d1')).rejects.toThrow('process.exit');

    expect(mockClackLogError).toHaveBeenCalledWith('Diagnosis failed: doctor timeout');
    expect(mockClackLogStep).toHaveBeenCalledWith('Deploy logs: https://projects.mastra.ai');
    expect(mockExit).toHaveBeenCalledWith(1);
    mockExit.mockRestore();
  });

  it('exits when no org selected', async () => {
    mockGetCurrentOrgId.mockResolvedValue(null);
    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit');
    });

    const { suggestionsAction } = await import('./deploy-suggestions.js');
    await expect(suggestionsAction('d1')).rejects.toThrow('process.exit');

    expect(mockClackLogError).toHaveBeenCalledWith('No organization selected. Run: mastra auth login');
    expect(mockExit).toHaveBeenCalledWith(1);
    mockExit.mockRestore();
  });
});
