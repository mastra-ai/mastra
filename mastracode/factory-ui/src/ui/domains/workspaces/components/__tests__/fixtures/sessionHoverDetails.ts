import type { WorkItem } from '../../../../factory/services/workItems';
import type { FactoryProjectPayload } from '../../../services/github';
import type { FactoryUserSession } from '../../../services/user-sessions';

export const factoryId = 'fp-1';
export const projectRepositoryId = 'ghp-1';
export const workSessionId = 'session-work';
export const reviewSessionId = 'session-review';
export const workName = 'Investigate the authentication regression across long-running sessions';
export const reviewName = 'Review the authentication refresh fix before release';

const HOUR = 3_600_000;

function hoursBefore(iso: string, hours: number): string {
  return new Date(Date.parse(iso) - hours * HOUR).toISOString();
}

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
    createdAt: hoursBefore(updatedAt, 4),
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
      stageHistory: [
        { stage: 'triage', enteredAt: hoursBefore(updatedAt, 6), exitedAt: hoursBefore(updatedAt, 3), by: 'user-1' },
        { stage: 'execute', enteredAt: hoursBefore(updatedAt, 3), by: 'user-grace' },
      ],
      sessions: {
        implementation: {
          sessionId: workSessionId,
          branch: workWorkspace.branch,
          threadId: workSessionId,
          startedBy: 'user-1',
        },
      },
      metadata: { number: 42 },
      triageType: null,
      acceptedAt: null,
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
      triageType: null,
      acceptedAt: null,
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
    rosterResponse: {
      members: [
        { id: 'user-1', name: 'Ada Lovelace', avatarUrl: 'https://example.com/ada.png' },
        { id: 'user-grace', name: 'Grace Hopper' },
      ],
    },
    workRunsResponse: {
      events: [
        {
          id: 'run-ended-1',
          actorId: `agent:${workSessionId}`,
          actorType: 'agent' as const,
          action: 'factory.run.ended',
          targets: [{ type: 'work_item', id: 'issue-42' }],
          metadata: { startedAt: Date.parse(hoursBefore(updatedAt, 3)), reason: 'complete' },
          occurredAt: hoursBefore(updatedAt, 2),
        },
      ],
      actors: {},
    },
    transfersResponse: {
      events: [
        {
          id: 'transfer-1',
          actorId: 'user-1',
          actorType: 'human' as const,
          action: 'factory.session.owner_transferred',
          targets: [{ type: 'session', id: workWorkspace.id, name: workName }],
          metadata: { fromOwnerId: 'user-grace', toOwnerId: 'user-1' },
          occurredAt: hoursBefore(updatedAt, 1),
        },
      ],
      actors: {},
    },
  };
}
