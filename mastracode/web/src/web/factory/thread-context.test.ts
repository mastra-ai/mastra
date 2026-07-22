import { describe, expect, it, vi } from 'vitest';

import { TaskContextProviderRequestError, type TaskContext } from '../capabilities/task-context';
import type { FactoryIntegration } from '../factory-integration';
import type { SourceControlStorageHandle } from '../storage/domains/source-control/base';
import type { WorkItemRow } from '../storage/domains/work-items/base';
import { loadFactoryThreadTaskContext, type LinearTaskContextIntegration } from './thread-context';

const now = new Date('2026-07-22T00:00:00.000Z');

function workItem(overrides: Partial<WorkItemRow> = {}): WorkItemRow {
  return {
    id: 'item-1',
    orgId: 'org-1',
    factoryProjectId: 'project-1',
    externalSource: {
      integrationId: 'github',
      type: 'issue',
      externalId: '42',
      url: 'https://github.com/mastra-ai/mastra/issues/42',
    },
    parentWorkItemId: null,
    title: 'Stored title',
    stages: ['intake'],
    stageHistory: [],
    sessions: {},
    metadata: { githubRepositoryId: '9001', githubIssueNumber: 42 },
    revision: 1,
    createdBy: 'user-1',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function githubStorage(): SourceControlStorageHandle {
  return {
    connections: {
      list: vi.fn().mockResolvedValue([{ id: 'connection-1', installationId: 'installation-1' }]),
    },
    projectRepositories: {
      list: vi.fn().mockResolvedValue([{ repositoryId: 'repository-1' }]),
    },
    repositories: {
      get: vi.fn().mockResolvedValue({ id: 'repository-1', externalId: '9001', slug: 'mastra-ai/mastra' }),
    },
    installations: {
      get: vi.fn().mockResolvedValue({ id: 'installation-1', externalId: '12345' }),
    },
  } as unknown as SourceControlStorageHandle;
}

function githubIntegration(taskContext: TaskContext): FactoryIntegration {
  return {
    id: 'github',
    taskContext,
  } as FactoryIntegration;
}

describe('loadFactoryThreadTaskContext', () => {
  it('returns stored manual context without contacting a provider', async () => {
    const context = await loadFactoryThreadTaskContext({
      orgId: 'org-1',
      factoryProjectId: 'project-1',
      workItem: workItem({ externalSource: null, metadata: null }),
    });

    expect(context).toEqual({
      task: { source: 'manual', title: 'Stored title', labels: [], assignees: [] },
      resolution: { mode: 'stored', reason: 'manual' },
    });
  });

  it('accepts only canonical Linear issue identifiers before provider resolution', async () => {
    const linearWorkItem = (identifier: string) =>
      workItem({
        externalSource: {
          integrationId: 'linear',
          type: 'issue',
          externalId: identifier,
          url: `https://linear.app/acme/issue/${identifier}`,
        },
        metadata: { linearIssueIdentifier: identifier },
      });

    for (const identifier of ['ENG-42', 'A1-1', '123e4567-e89B-12d3-a456-426614174000']) {
      const context = await loadFactoryThreadTaskContext({
        orgId: 'org-1',
        factoryProjectId: 'project-1',
        workItem: linearWorkItem(identifier),
      });
      expect(context.resolution).toEqual({ mode: 'stored', reason: 'provider-unavailable' });
    }

    const getIssue = vi.fn();
    const ensureLinearReady = vi.fn();
    const linearIntegration = {
      id: 'linear',
      taskContext: { getIssue },
      refreshAccessToken: vi.fn(),
    } as unknown as LinearTaskContextIntegration;
    for (const identifier of [
      'eng-42',
      ' ENG-42',
      'ENG-42 ',
      'ENG-0',
      'ENG-01',
      '1ENG-1',
      'ENG',
      'ENG-',
      `${'A'.repeat(127)}-1`,
    ]) {
      const context = await loadFactoryThreadTaskContext({
        orgId: 'org-1',
        factoryProjectId: 'project-1',
        workItem: linearWorkItem(identifier),
        linearIntegration,
        ensureLinearReady,
      });
      expect(context.resolution).toEqual({ mode: 'stored', reason: 'invalid-source' });
    }
    expect(ensureLinearReady).not.toHaveBeenCalled();
    expect(getIssue).not.toHaveBeenCalled();
  });

  it('parses canonical persisted source keys when identity metadata is absent', async () => {
    const getIssue = vi.fn().mockResolvedValue(null);
    const getPullRequest = vi.fn().mockResolvedValue(null);
    const github = githubIntegration({ getIssue, getPullRequest });

    const issueContext = await loadFactoryThreadTaskContext({
      orgId: 'org-1',
      factoryProjectId: 'project-1',
      workItem: workItem({
        externalSource: {
          integrationId: 'github',
          type: 'issue',
          externalId: 'github-issue:42',
          url: 'https://github.com/mastra-ai/mastra/issues/42',
        },
        metadata: { githubRepositoryId: '9001' },
      }),
      sourceControlStorage: githubStorage(),
      githubIntegration: github,
    });
    const pullRequestContext = await loadFactoryThreadTaskContext({
      orgId: 'org-1',
      factoryProjectId: 'project-1',
      workItem: workItem({
        externalSource: {
          integrationId: 'github',
          type: 'pull-request',
          externalId: 'github-pr:43',
          url: 'https://github.com/mastra-ai/mastra/pull/43',
        },
        metadata: { githubRepositoryId: '9001' },
      }),
      sourceControlStorage: githubStorage(),
      githubIntegration: github,
    });
    const linearContext = await loadFactoryThreadTaskContext({
      orgId: 'org-1',
      factoryProjectId: 'project-1',
      workItem: workItem({
        externalSource: {
          integrationId: 'linear',
          type: 'issue',
          externalId: 'linear:ENG-42',
          url: 'https://linear.app/acme/issue/ENG-42',
        },
        metadata: null,
      }),
    });

    expect(issueContext.resolution).toEqual({ mode: 'stored', reason: 'not-found' });
    expect(pullRequestContext.resolution).toEqual({ mode: 'stored', reason: 'not-found' });
    expect(linearContext.resolution).toEqual({ mode: 'stored', reason: 'provider-unavailable' });
    expect(getIssue).toHaveBeenCalledWith(expect.objectContaining({ issueId: '42' }));
    expect(getPullRequest).toHaveBeenCalledWith(expect.objectContaining({ pullRequestId: '43' }));
  });

  it('rejects mismatched or non-canonical GitHub source identities before provider resolution', async () => {
    const getIssue = vi.fn();
    const getPullRequest = vi.fn();
    const ensureGithubReady = vi.fn();
    const github = githubIntegration({ getIssue, getPullRequest });
    const storage = githubStorage();
    const cases = [
      { type: 'issue' as const, externalId: '042', metadata: { githubRepositoryId: '9001' } },
      { type: 'issue' as const, externalId: 'wrong-prefix:42', metadata: { githubRepositoryId: '9001' } },
      { type: 'issue' as const, externalId: 'github-pr:42', metadata: { githubRepositoryId: '9001' } },
      { type: 'pull-request' as const, externalId: '017', metadata: { githubRepositoryId: '9001' } },
      { type: 'pull-request' as const, externalId: 'github-issue:17', metadata: { githubRepositoryId: '9001' } },
      {
        type: 'issue' as const,
        externalId: 'github-issue:42',
        metadata: { githubRepositoryId: '9001', githubIssueNumber: '042' },
      },
      {
        type: 'issue' as const,
        externalId: 'github-issue:42',
        metadata: { githubRepositoryId: '9001', githubIssueNumber: 10_000_000_000 },
      },
    ];

    for (const testCase of cases) {
      const context = await loadFactoryThreadTaskContext({
        orgId: 'org-1',
        factoryProjectId: 'project-1',
        workItem: workItem({
          externalSource: {
            integrationId: 'github',
            type: testCase.type,
            externalId: testCase.externalId,
            url: 'https://github.com/mastra-ai/mastra/issues/42',
          },
          metadata: testCase.metadata,
        }),
        sourceControlStorage: storage,
        githubIntegration: github,
        ensureGithubReady,
      });
      expect(context.resolution).toEqual({ mode: 'stored', reason: 'invalid-source' });
    }
    expect(ensureGithubReady).not.toHaveBeenCalled();
    expect(storage.connections.list).not.toHaveBeenCalled();
    expect(getIssue).not.toHaveBeenCalled();
    expect(getPullRequest).not.toHaveBeenCalled();
  });

  it('hydrates a GitHub issue through the bounded task-context capability', async () => {
    const getIssue = vi.fn().mockResolvedValue({
      identifier: '#42',
      title: 'Live title',
      description: 'Live description',
      state: 'open',
      labels: ['factory'],
      assignees: ['ada'],
      url: 'https://github.com/mastra-ai/mastra/issues/42',
    });

    const context = await loadFactoryThreadTaskContext({
      orgId: 'org-1',
      factoryProjectId: 'project-1',
      workItem: workItem(),
      sourceControlStorage: githubStorage(),
      githubIntegration: githubIntegration({ getIssue }),
    });

    expect(getIssue).toHaveBeenCalledWith({
      connection: { type: 'app-installation', installationId: 12345 },
      sourceId: 'mastra-ai/mastra',
      issueId: '42',
    });
    expect(context).toEqual({
      task: {
        source: 'github-issue',
        identifier: '#42',
        title: 'Live title',
        description: 'Live description',
        state: 'open',
        labels: ['factory'],
        assignees: ['ada'],
        url: 'https://github.com/mastra-ai/mastra/issues/42',
      },
      resolution: { mode: 'live' },
    });
  });

  it('hydrates GitHub pull-request labels and assignees through task context', async () => {
    const getPullRequest = vi.fn().mockResolvedValue({
      identifier: '#43',
      title: 'Live pull request',
      description: 'Pull request description',
      state: 'merged',
      labels: ['factory', 'ready'],
      assignees: ['ada', 'grace'],
      url: 'https://github.com/mastra-ai/mastra/pull/43',
    });
    const context = await loadFactoryThreadTaskContext({
      orgId: 'org-1',
      factoryProjectId: 'project-1',
      workItem: workItem({
        externalSource: {
          integrationId: 'github',
          type: 'pull-request',
          externalId: '43',
          url: 'https://github.com/mastra-ai/mastra/pull/43',
        },
        metadata: { githubRepositoryId: '9001', githubPullRequestNumber: 43 },
      }),
      sourceControlStorage: githubStorage(),
      githubIntegration: githubIntegration({ getPullRequest }),
    });

    expect(getPullRequest).toHaveBeenCalledWith({
      connection: { type: 'app-installation', installationId: 12345 },
      sourceId: 'mastra-ai/mastra',
      pullRequestId: '43',
    });
    expect(context).toEqual({
      task: {
        source: 'github-pr',
        identifier: '#43',
        title: 'Live pull request',
        description: 'Pull request description',
        state: 'merged',
        labels: ['factory', 'ready'],
        assignees: ['ada', 'grace'],
        url: 'https://github.com/mastra-ai/mastra/pull/43',
      },
      resolution: { mode: 'live' },
    });
  });

  it('falls back to stored context when the GitHub request boundary fails', async () => {
    const context = await loadFactoryThreadTaskContext({
      orgId: 'org-1',
      factoryProjectId: 'project-1',
      workItem: workItem(),
      sourceControlStorage: githubStorage(),
      githubIntegration: githubIntegration({
        getIssue: vi.fn().mockRejectedValue(new TaskContextProviderRequestError('GitHub API request failed.')),
      }),
    });

    expect(context).toEqual({
      task: {
        source: 'github-issue',
        title: 'Stored title',
        labels: [],
        assignees: [],
        url: 'https://github.com/mastra-ai/mastra/issues/42',
      },
      resolution: { mode: 'stored', reason: 'provider-unavailable' },
    });
  });

  it('does not downgrade provider readiness or mapping failures', async () => {
    const ensureFailure = new Error('storage unavailable');
    await expect(
      loadFactoryThreadTaskContext({
        orgId: 'org-1',
        factoryProjectId: 'project-1',
        workItem: workItem(),
        sourceControlStorage: githubStorage(),
        githubIntegration: githubIntegration({ getIssue: vi.fn() }),
        ensureGithubReady: vi.fn().mockRejectedValue(ensureFailure),
      }),
    ).rejects.toBe(ensureFailure);

    const mappingFailure = new Error('mapper bug');
    await expect(
      loadFactoryThreadTaskContext({
        orgId: 'org-1',
        factoryProjectId: 'project-1',
        workItem: workItem(),
        sourceControlStorage: githubStorage(),
        githubIntegration: githubIntegration({ getIssue: vi.fn().mockRejectedValue(mappingFailure) }),
      }),
    ).rejects.toBe(mappingFailure);

    await expect(
      loadFactoryThreadTaskContext({
        orgId: 'org-1',
        factoryProjectId: 'project-1',
        workItem: workItem(),
        sourceControlStorage: githubStorage(),
        githubIntegration: githubIntegration({
          getIssue: vi.fn().mockResolvedValue({
            identifier: '#42',
            title: 'Live title',
            description: null,
            state: 'open',
            labels: null,
            assignees: [],
            url: null,
          } as never),
        }),
      }),
    ).rejects.toBeInstanceOf(TypeError);
  });
});
