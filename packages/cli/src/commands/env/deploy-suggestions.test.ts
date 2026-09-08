import process from 'node:process';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetToken = vi.fn();
const mockResolveCurrentOrg = vi.fn();
const mockResolveProject = vi.fn();
const mockFetchEnvironments = vi.fn();
const mockFetchEnvironmentDeploys = vi.fn();
const mockFetchEnvironmentDeployDiagnosis = vi.fn();
const mockStartEnvironmentDeployDiagnosis = vi.fn();
const mockIntro = vi.fn();
const mockOutro = vi.fn();
const mockLogError = vi.fn();
const mockLogInfo = vi.fn();
const mockLogStep = vi.fn();
const mockLogMessage = vi.fn();
const mockLogWarn = vi.fn();

vi.mock('../auth/credentials.js', () => ({
  getToken: (...args: unknown[]) => mockGetToken(...args),
}));

vi.mock('../auth/orgs.js', () => ({
  resolveCurrentOrg: (...args: unknown[]) => mockResolveCurrentOrg(...args),
}));

vi.mock('../auth/client.js', () => ({
  MASTRA_PLATFORM_API_URL: 'https://platform.mastra.ai',
}));

vi.mock('./resolve-project.js', () => ({
  resolveProject: (...args: unknown[]) => mockResolveProject(...args),
}));

vi.mock('./platform-api.js', () => ({
  fetchEnvironments: (...args: unknown[]) => mockFetchEnvironments(...args),
  fetchEnvironmentDeploys: (...args: unknown[]) => mockFetchEnvironmentDeploys(...args),
  fetchEnvironmentDeployDiagnosis: (...args: unknown[]) => mockFetchEnvironmentDeployDiagnosis(...args),
  startEnvironmentDeployDiagnosis: (...args: unknown[]) => mockStartEnvironmentDeployDiagnosis(...args),
}));

vi.mock('../deploy-suggestions.js', async () => {
  const actual = await vi.importActual<typeof import('../deploy-suggestions.js')>('../deploy-suggestions.js');
  return {
    ...actual,
    pollForDiagnosis: async (fetchOnce: () => Promise<unknown>) => fetchOnce(),
  };
});

vi.mock('@clack/prompts', () => ({
  intro: (...args: unknown[]) => mockIntro(...args),
  outro: (...args: unknown[]) => mockOutro(...args),
  spinner: () => ({ start: vi.fn(), stop: vi.fn() }),
  log: {
    error: (...args: unknown[]) => mockLogError(...args),
    info: (...args: unknown[]) => mockLogInfo(...args),
    step: (...args: unknown[]) => mockLogStep(...args),
    message: (...args: unknown[]) => mockLogMessage(...args),
    warn: (...args: unknown[]) => mockLogWarn(...args),
  },
}));

beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  mockGetToken.mockResolvedValue('t');
  mockResolveCurrentOrg.mockResolvedValue({ orgId: 'o' });
  mockResolveProject.mockResolvedValue({ id: 'proj-1', name: 'App' });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('envSuggestionsAction', () => {
  it('reports when deploy is already healthy', async () => {
    mockFetchEnvironments.mockResolvedValue([{ id: 'env-1', name: 'production', slug: 'production' }]);
    mockFetchEnvironmentDeploys.mockResolvedValue([{ id: 'dep-1', environmentId: 'env-1', createdAt: '2025-06-01' }]);
    mockFetchEnvironmentDeployDiagnosis.mockResolvedValue({ state: 'healthy' });

    const { envSuggestionsAction } = await import('./deploy-suggestions.js');
    await envSuggestionsAction('dep-1', { environment: 'production' });

    expect(mockOutro).toHaveBeenCalledWith('Deploy is running successfully. No suggestions required.');
  });

  it('prints suggestions when diagnosis is ready', async () => {
    mockFetchEnvironments.mockResolvedValue([{ id: 'env-1', name: 'production', slug: 'production' }]);
    mockFetchEnvironmentDeploys.mockResolvedValue([{ id: 'dep-1', environmentId: 'env-1', createdAt: '2025-06-01' }]);
    mockFetchEnvironmentDeployDiagnosis.mockResolvedValue({
      state: 'ready',
      diagnosis: {
        id: 'diag-1',
        deployId: 'dep-1',
        status: 'COMPLETE',
        summary: 'Missing API key.',
        recommendations: [
          {
            title: 'Set API_KEY',
            description: 'The deployment could not find API_KEY.',
            action: 'Set API_KEY and redeploy.',
            docsUrl: 'https://mastra.ai/docs/env',
          },
        ],
        error: null,
        createdAt: '2025-06-01T00:00:00Z',
        completedAt: '2025-06-01T00:00:05Z',
      },
    });

    const { envSuggestionsAction } = await import('./deploy-suggestions.js');
    await envSuggestionsAction('dep-1', { environment: 'production' });

    const messages = mockLogMessage.mock.calls.map(c => String(c[0])).join('\n');
    expect(messages).toContain('Deploy Suggestions');
    expect(messages).toContain('Set API_KEY');
  });

  it('starts a diagnosis when none exists yet', async () => {
    mockFetchEnvironments.mockResolvedValue([{ id: 'env-1', name: 'production', slug: 'production' }]);
    mockFetchEnvironmentDeploys.mockResolvedValue([{ id: 'dep-1', environmentId: 'env-1', createdAt: '2025-06-01' }]);
    mockFetchEnvironmentDeployDiagnosis.mockResolvedValueOnce({ state: 'missing' }).mockResolvedValueOnce({
      state: 'ready',
      diagnosis: {
        id: 'diag-1',
        deployId: 'dep-1',
        status: 'COMPLETE',
        summary: 'x',
        recommendations: [],
        error: null,
        createdAt: '2025-06-01T00:00:00Z',
        completedAt: '2025-06-01T00:00:05Z',
      },
    });

    const { envSuggestionsAction } = await import('./deploy-suggestions.js');
    await envSuggestionsAction('dep-1', { environment: 'production' });

    expect(mockStartEnvironmentDeployDiagnosis).toHaveBeenCalledWith('t', 'o', 'proj-1', 'env-1', 'dep-1');
  });

  it('exits with error when the environment cannot be found', async () => {
    mockFetchEnvironments.mockResolvedValue([{ id: 'env-1', name: 'production', slug: 'production' }]);
    const mockExit = vi.spyOn(process, 'exit').mockImplementation(((code?: string | number | null) => {
      throw new Error(`exit:${code}`);
    }) as never);

    const { envSuggestionsAction } = await import('./deploy-suggestions.js');
    await expect(envSuggestionsAction('dep-1', { environment: 'staging' })).rejects.toThrow('exit:1');
    expect(mockLogError).toHaveBeenCalled();

    mockExit.mockRestore();
  });
});
