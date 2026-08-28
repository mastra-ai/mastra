import type { WorkItem } from '../../../../factory/services/workItems';
import type { FactoryProjectPayload } from '../../../services/github';
import type { FactoryUserSession } from '../../../services/user-sessions';

export const factoryId = 'fp-1';
export const projectRepositoryId = 'ghp-1';
export const workSessionId = 'session-work';
export const reviewSessionId = 'session-review';
export const workName = 'Investigate the authentication regression across long-running sessions';
export const reviewName = 'Review the authentication refresh fix before release';

function createWorkspace({
  id,
  branch,
  title,
  updatedAt,
}: {
  id: string;
  branch: string;
  title: string;
  updatedAt: string;
}): FactoryUserSession {
  return {
    id: `row-${id}`,
    sessionId: id,
    projectRepositoryId,
    orgId: 'org-1',
    userId: 'user-1',
    owner: { id: 'user-1', name: 'Ada Lovelace', avatarUrl: 'https://example.com/ada.png' },
    visibility: 'org' as const,
    title,
    branch,
    baseBranch: 'main',
    sandboxId: null,
    sandboxWorkdir: null,
    materializedAt: updatedAt,
    createdAt: updatedAt,
    updatedAt,
  };
}

function toWireWorkItem(item: WorkItem) {
  const { githubProjectId, source, sourceKey, url, ...rest } = item;
  if (source !== 'github-issue' && source !== 'github-pr') {
    throw new Error(`Unsupported session preview fixture source: ${source}`);
  }
  if (!sourceKey) throw new Error('Session preview fixture requires a source key');

  return {
    ...rest,
    factoryProjectId: githubProjectId,
    externalSource: {
      integrationId: 'github',
      type: source === 'github-issue' ? 'issue' : 'pull-request',
      externalId: sourceKey,
      ...(url ? { url } : {}),
    },
  };
}

export function createSessionHoverDetailsFixtures(updatedAt: string) {
  const project: FactoryProjectPayload = { id: factoryId, name: 'Mastra' };
  const workWorkspace = createWorkspace({
    id: workSessionId,
    branch: 'factory/issue-42-authentication-regression',
    title: workName,
    updatedAt,
  });
  const reviewWorkspace = createWorkspace({
    id: reviewSessionId,
    branch: 'factory/pr-99-authentication-refresh',
    title: reviewName,
    updatedAt,
  });
  const workItems: WorkItem[] = [
    {
      id: 'issue-42',
      orgId: 'org-1',
      createdBy: 'user-1',
      githubProjectId: factoryId,
      source: 'github-issue',
      sourceKey: '42',
      parentWorkItemId: null,
      title: 'Authentication fails after token refresh',
      url: 'https://github.com/mastra-ai/mastra/issues/42',
      stages: ['execute'],
      stageHistory: [],
      sessions: {
        implementation: {
          sessionId: workSessionId,
          branch: workWorkspace.branch,
          threadId: workSessionId,
          startedBy: 'user-1',
        },
      },
      metadata: { number: 42 },
      commentCount: 0,
      feedActivityAt: null,
      revision: 1,
      createdAt: updatedAt,
      updatedAt,
    },
    {
      id: 'pr-99',
      orgId: 'org-1',
      createdBy: 'user-1',
      githubProjectId: factoryId,
      source: 'github-pr',
      sourceKey: '99',
      parentWorkItemId: 'issue-42',
      title: 'Fix authentication refresh handling',
      url: 'https://github.com/mastra-ai/mastra/pull/99',
      stages: ['review'],
      stageHistory: [],
      sessions: {
        review: {
          sessionId: reviewSessionId,
          branch: reviewWorkspace.branch,
          threadId: reviewSessionId,
          startedBy: 'user-1',
        },
      },
      metadata: { number: 99 },
      commentCount: 0,
      feedActivityAt: null,
      revision: 1,
      createdAt: updatedAt,
      updatedAt,
    },
  ];
  return {
    projectsResponse: { projects: [project] },
    connectionsResponse: {
      connections: [
        {
          id: 'connection-1',
          installationId: 'installation-1',
          repositories: [
            {
              id: projectRepositoryId,
              branch: 'main',
              sandboxWorkdir: '/workspace/mastra',
              repository: { slug: 'mastra-ai/mastra', defaultBranch: 'main' },
            },
          ],
        },
      ],
    },
    sessionsResponse: { sessions: [workWorkspace, reviewWorkspace] },
    currentSessionResponse: { session: workWorkspace },
    workItemsResponse: { workItems: workItems.map(toWireWorkItem) },
    activeRunsResponse: { runs: [{ runId: 'run-work', resourceId: workSessionId, threadId: workSessionId }] },
  };
}
