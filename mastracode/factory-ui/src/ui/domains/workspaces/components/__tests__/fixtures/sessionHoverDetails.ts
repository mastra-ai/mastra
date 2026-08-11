import type { AgentControllerThreadInfo } from '@mastra/client-js';

import type { WorkItem } from '../../../../factory/services/workItems';
import type { FactoryProjectPayload, FactoryUserSession, MaterializeResult } from '../../../services/github';

export const factoryId = 'fp-1';
export const projectRepositoryId = 'ghp-1';
export const workSessionId = 'session-work';
export const reviewSessionId = 'session-review';
export const workName = 'Investigate the authentication regression across long-running sessions';
export const reviewName = 'Review the authentication refresh fix before release';

function createWorkspace({
  id,
  branch,
  updatedAt,
}: {
  id: string;
  branch: string;
  updatedAt: string;
}): FactoryUserSession {
  return {
    id: `row-${id}`,
    sessionId: id,
    projectRepositoryId,
    orgId: 'org-1',
    userId: 'user-1',
    branch,
    baseBranch: 'main',
    sandboxId: null,
    sandboxWorkdir: null,
    materializedAt: null,
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
    updatedAt,
  });
  const reviewWorkspace = createWorkspace({
    id: reviewSessionId,
    branch: 'factory/pr-99-authentication-refresh',
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
      revision: 1,
      createdAt: updatedAt,
      updatedAt,
    },
  ];
  const threads: AgentControllerThreadInfo[] = [
    {
      id: workSessionId,
      title: workName,
      resourceId: workSessionId,
      tags: { projectPath: workSessionId },
      state: 'active',
      createdAt: updatedAt,
      updatedAt,
    },
    {
      id: reviewSessionId,
      title: reviewName,
      resourceId: workSessionId,
      tags: { projectPath: reviewSessionId },
      state: 'idle',
      createdAt: updatedAt,
      updatedAt,
    },
  ];
  const ensureResponse: MaterializeResult = {
    resourceId: workSessionId,
    factoryProjectId: factoryId,
    projectRepositoryId,
    sandboxId: 'sandbox-1',
    sandboxWorkdir: '/workspace/mastra',
  };

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
    ensureResponse,
    workItemsResponse: { workItems: workItems.map(toWireWorkItem) },
    threadsResponse: { threads },
  };
}
