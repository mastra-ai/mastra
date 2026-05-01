import process from 'node:process';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockResolveAuth = vi.fn();
const mockResolveProjectId = vi.fn();
const mockFetchServerDeployDiagnosis = vi.fn();
const mockStartServerDeployDiagnosis = vi.fn();
const mockFetchServerProjectDetail = vi.fn();
const mockIntro = vi.fn();
const mockOutro = vi.fn();
const mockLogError = vi.fn();
const mockLogInfo = vi.fn();
const mockLogStep = vi.fn();
const mockLogMessage = vi.fn();
const mockLogWarn = vi.fn();
const mockSpinnerStart = vi.fn();
const mockSpinnerStop = vi.fn();

vi.mock('./env.js', () => ({
  resolveAuth: (...args: unknown[]) => mockResolveAuth(...args),
  resolveProjectId: (...args: unknown[]) => mockResolveProjectId(...args),
}));

vi.mock('./platform-api.js', () => ({
  fetchServerDeployDiagnosis: (...args: unknown[]) => mockFetchServerDeployDiagnosis(...args),
  startServerDeployDiagnosis: (...args: unknown[]) => mockStartServerDeployDiagnosis(...args),
  fetchServerProjectDetail: (...args: unknown[]) => mockFetchServerProjectDetail(...args),
}));

vi.mock('../../utils/polling.js', () => ({
  withPollingRetries: (fn: () => unknown) => fn(),
}));

vi.mock('@clack/prompts', () => ({
  intro: (...args: unknown[]) => mockIntro(...args),
  outro: (...args: unknown[]) => mockOutro(...args),
  spinner: () => ({
    start: (...args: unknown[]) => mockSpinnerStart(...args),
    stop: (...args: unknown[]) => mockSpinnerStop(...args),
  }),
  log: {
    error: (...args: unknown[]) => mockLogError(...args),
    info: (...args: unknown[]) => mockLogInfo(...args),
    step: (...args: unknown[]) => mockLogStep(...args),
    message: (...args: unknown[]) => mockLogMessage(...args),
    warn: (...args: unknown[]) => mockLogWarn(...args),
  },
}));

beforeEach(() => {
  vi.resetAllMocks();
  mockResolveAuth.mockResolvedValue({ token: 't', orgId: 'o' });
  mockResolveProjectId.mockResolvedValue('proj-1');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('serverSuggestionsAction', () => {
  it('prints suggestions and exits cleanly', async () => {
    mockFetchServerDeployDiagnosis.mockResolvedValue({
      state: 'ready',
      diagnosis: {
        id: 'diag-1',
        deployId: 'dep-1',
        status: 'COMPLETE',
        summary: 'A required secret is missing.',
        recommendations: [
          {
            title: 'Set API_KEY',
            description: 'The deployment could not find API_KEY.',
            action: 'Set API_KEY in Mastra Server and redeploy.',
            docsUrl: 'https://mastra.ai/docs/server/env',
          },
        ],
        error: null,
        createdAt: '2025-06-01T00:00:00Z',
        completedAt: '2025-06-01T00:00:05Z',
      },
    });

    const { serverSuggestionsAction } = await import('./deploy-suggestions.js');
    await serverSuggestionsAction('dep-1', {});

    const allMessages = mockLogMessage.mock.calls.map((call: unknown[]) => String(call[0])).join('\n');
    expect(allMessages).toContain('Deploy Suggestions');
    expect(allMessages).toContain('Set API_KEY');
    expect(allMessages).toContain('https://mastra.ai/docs/server/env');
  });

  it('reports when deploy is already running successfully', async () => {
    mockFetchServerDeployDiagnosis.mockResolvedValue({ state: 'healthy' });

    const { serverSuggestionsAction } = await import('./deploy-suggestions.js');
    await serverSuggestionsAction('dep-1', {});

    expect(mockOutro).toHaveBeenCalledWith('Deploy is running successfully. No suggestions required.');
  });

  it('starts a diagnosis when none exists and then prints suggestions', async () => {
    mockFetchServerDeployDiagnosis.mockResolvedValueOnce({ state: 'missing' }).mockResolvedValueOnce({
      state: 'ready',
      diagnosis: {
        id: 'diag-2',
        deployId: 'dep-1',
        status: 'COMPLETE',
        summary: 'Missing API key.',
        recommendations: [],
        error: null,
        createdAt: '2025-06-01T00:00:00Z',
        completedAt: '2025-06-01T00:00:05Z',
      },
    });

    const { serverSuggestionsAction } = await import('./deploy-suggestions.js');
    await serverSuggestionsAction('dep-1', {});

    expect(mockStartServerDeployDiagnosis).toHaveBeenCalledWith('dep-1', 't', 'o');
    expect(mockFetchServerDeployDiagnosis).toHaveBeenCalledTimes(2);
    expect(mockLogWarn).toHaveBeenCalled();
    const warnMsg = String(mockLogWarn.mock.calls[0][0]);
    expect(warnMsg).toContain('No suggestions could be generated');
  });

  it('defaults to the linked project latest deploy when deploy id is omitted', async () => {
    mockFetchServerProjectDetail.mockResolvedValue({
      project: {
        id: 'proj-1',
        name: 'Server App',
        latestDeployId: 'dep-2',
      },
    });
    mockFetchServerDeployDiagnosis.mockResolvedValue({
      state: 'ready',
      diagnosis: {
        id: 'diag-1',
        deployId: 'dep-2',
        status: 'COMPLETE',
        summary: 'A required secret is missing.',
        recommendations: [],
        error: null,
        createdAt: '2025-06-01T00:00:00Z',
        completedAt: '2025-06-01T00:00:05Z',
      },
    });

    const { serverSuggestionsAction } = await import('./deploy-suggestions.js');
    await serverSuggestionsAction(undefined, {});

    expect(mockResolveProjectId).toHaveBeenCalledWith({}, { token: 't', orgId: 'o' });
    expect(mockFetchServerProjectDetail).toHaveBeenCalledWith('t', 'o', 'proj-1');
    expect(mockFetchServerDeployDiagnosis).toHaveBeenCalledWith('dep-2', 't', 'o');
    expect(mockLogInfo).toHaveBeenCalledWith('Using latest deploy: dep-2 (Server App)');
    expect(mockLogWarn).toHaveBeenCalled();
    const warnMsg = String(mockLogWarn.mock.calls[0][0]);
    expect(warnMsg).toContain('No suggestions could be generated');
  });

  it('tells the user how to deploy and rerun suggestions when the linked server project has no deploys', async () => {
    mockFetchServerProjectDetail.mockResolvedValue({
      project: {
        id: 'proj-1',
        name: 'Server App',
        latestDeployId: null,
      },
    });
    const mockExit = vi.spyOn(process, 'exit').mockImplementation((code?: string | number | null) => {
      throw new Error(`exit:${code}`);
    });

    const { serverSuggestionsAction } = await import('./deploy-suggestions.js');
    await expect(serverSuggestionsAction(undefined, {})).rejects.toThrow('exit:1');

    expect(mockLogError).toHaveBeenCalledWith(
      'No deploys found for linked Server project Server App. The suggestions command helps debug failed deployments, and you can run it after a deployment fails with `mastra server deploy suggestions <deploy-id>` or `mastra server deploy suggestions`.',
    );
    expect(mockFetchServerDeployDiagnosis).not.toHaveBeenCalled();
    mockExit.mockRestore();
  });

  it('exits when diagnosis generation fails', async () => {
    mockFetchServerDeployDiagnosis.mockResolvedValue({
      state: 'ready',
      diagnosis: {
        id: 'diag-1',
        deployId: 'dep-1',
        status: 'FAILED',
        summary: null,
        recommendations: null,
        error: 'doctor timeout',
        createdAt: '2025-06-01T00:00:00Z',
        completedAt: '2025-06-01T00:00:05Z',
      },
    });
    const mockExit = vi.spyOn(process, 'exit').mockImplementation((code?: string | number | null) => {
      throw new Error(`exit:${code}`);
    });

    const { serverSuggestionsAction } = await import('./deploy-suggestions.js');
    await expect(serverSuggestionsAction('dep-1', {})).rejects.toThrow('exit:1');

    expect(mockLogError).toHaveBeenCalledWith('Diagnosis failed: doctor timeout');
    expect(mockLogStep).toHaveBeenCalledWith('Deploy logs: https://projects.mastra.ai');
    mockExit.mockRestore();
  });
});
