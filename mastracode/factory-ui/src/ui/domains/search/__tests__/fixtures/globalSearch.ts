import type { GithubIssue, GithubPullRequest } from '../../../factory/services/factory';
import type { WorkItem } from '../../../factory/services/workItems';
import type { FactoryProjectPayload } from '../../../workspaces/services/github';
import type { FactoryUserSession } from '../../../workspaces/services/user-sessions';

export const ACTIVE_FACTORY_ID = 'factory-active';
export const OTHER_FACTORY_ID = 'factory-other';
export const FIRST_REPOSITORY_ID = 'repository-one';
export const SECOND_REPOSITORY_ID = 'repository-two';
export const OTHER_REPOSITORY_ID = 'repository-other';

export const factoryProjects: FactoryProjectPayload[] = [
  { id: ACTIVE_FACTORY_ID, name: 'Mastra Factory' },
  { id: OTHER_FACTORY_ID, name: 'Docs Factory' },
];

export const factoryConnections = {
  [ACTIVE_FACTORY_ID]: [
    {
      id: 'connection-active',
      installationId: 'installation-active',
      repositories: [
        {
          id: FIRST_REPOSITORY_ID,
          branch: 'main',
          sandboxWorkdir: '/workspaces/mastra',
          repository: { slug: 'mastra-ai/mastra', defaultBranch: 'main' },
        },
        {
          id: SECOND_REPOSITORY_ID,
          branch: 'main',
          sandboxWorkdir: '/workspaces/mastra-docs',
          repository: { slug: 'mastra-ai/docs', defaultBranch: 'main' },
        },
      ],
    },
  ],
  [OTHER_FACTORY_ID]: [
    {
      id: 'connection-other',
      installationId: 'installation-other',
      repositories: [
        {
          id: OTHER_REPOSITORY_ID,
          branch: 'main',
          sandboxWorkdir: '/workspaces/other',
          repository: { slug: 'other-org/other-repo', defaultBranch: 'main' },
        },
      ],
    },
  ],
};

function createSession(
  sessionId: string,
  projectRepositoryId: string,
  branch: string,
  updatedAt: string,
): FactoryUserSession {
  return {
    id: `row-${sessionId}`,
    sessionId,
    projectRepositoryId,
    orgId: 'org-search',
    userId: 'user-search',
    visibility: 'org',
    branch,
    baseBranch: 'main',
    sandboxId: `sandbox-${sessionId}`,
    sandboxWorkdir: `/workspaces/${sessionId}`,
    materializedAt: updatedAt,
    createdAt: updatedAt,
    updatedAt,
  };
}

export const sessionsByRepository: Record<string, FactoryUserSession[]> = {
  [FIRST_REPOSITORY_ID]: [
    createSession('session-work', FIRST_REPOSITORY_ID, 'factory/command-search', '2026-07-29T12:00:00.000Z'),
  ],
  [SECOND_REPOSITORY_ID]: [
    createSession('session-review', SECOND_REPOSITORY_ID, 'factory/pr-900', '2026-07-29T14:00:00.000Z'),
    createSession('session-user', SECOND_REPOSITORY_ID, 'user/research-notes', '2026-07-29T13:00:00.000Z'),
    createSession('session-unlinked', SECOND_REPOSITORY_ID, 'feature/offline-index', '2026-07-29T11:00:00.000Z'),
  ],
  [OTHER_REPOSITORY_ID]: [
    createSession('session-other-factory', OTHER_REPOSITORY_ID, 'factory/other', '2026-07-29T15:00:00.000Z'),
  ],
};

export const workItems: WorkItem[] = [
  {
    id: 'work-item-search',
    orgId: 'org-search',
    createdBy: 'user-search',
    githubProjectId: ACTIVE_FACTORY_ID,
    source: 'github-issue',
    sourceKey: 'mastra-ai/mastra:321',
    parentWorkItemId: null,
    title: 'Add universal command search',
    url: 'https://github.com/mastra-ai/mastra/issues/321',
    stages: ['execute'],
    stageHistory: [],
    sessions: {
      build: {
        sessionId: 'session-work',
        branch: 'factory/command-search',
        threadId: 'thread-work-linked',
        startedBy: 'user-search',
      },
    },
    metadata: { number: 321 },
    revision: 2,
    createdAt: '2026-07-29T10:00:00.000Z',
    updatedAt: '2026-07-29T12:30:00.000Z',
  },
  {
    id: 'work-item-review',
    orgId: 'org-search',
    createdBy: 'user-search',
    githubProjectId: ACTIVE_FACTORY_ID,
    source: 'github-pr',
    sourceKey: 'mastra-ai/mastra:900',
    parentWorkItemId: null,
    title: 'Review command palette PR',
    url: 'https://github.com/mastra-ai/mastra/pull/900',
    stages: ['review'],
    stageHistory: [],
    sessions: {
      review: {
        sessionId: 'session-review',
        branch: 'factory/pr-900',
        threadId: 'thread-review-linked',
        startedBy: 'user-search',
      },
    },
    metadata: { number: 900 },
    revision: 1,
    createdAt: '2026-07-29T13:30:00.000Z',
    updatedAt: '2026-07-29T14:30:00.000Z',
  },
  {
    id: 'work-item-unstarted-review',
    orgId: 'org-search',
    createdBy: 'user-search',
    githubProjectId: ACTIVE_FACTORY_ID,
    source: 'github-pr',
    sourceKey: 'mastra-ai/mastra:4242',
    parentWorkItemId: null,
    title: 'Bump the command palette dependencies',
    url: 'https://github.com/mastra-ai/mastra/pull/4242',
    stages: ['intake'],
    stageHistory: [],
    sessions: {},
    metadata: { number: 4242 },
    revision: 1,
    createdAt: '2026-07-29T09:00:00.000Z',
    updatedAt: '2026-07-29T09:30:00.000Z',
  },
  {
    id: 'work-item-unstarted-issue',
    orgId: 'org-search',
    createdBy: 'user-search',
    githubProjectId: ACTIVE_FACTORY_ID,
    source: 'github-issue',
    sourceKey: 'mastra-ai/mastra:777',
    parentWorkItemId: null,
    title: 'Palette keyboard traps focus on mobile',
    url: 'https://github.com/mastra-ai/mastra/issues/777',
    stages: ['triage'],
    stageHistory: [],
    sessions: {},
    metadata: { number: 777 },
    revision: 1,
    createdAt: '2026-07-29T08:00:00.000Z',
    updatedAt: '2026-07-29T08:30:00.000Z',
  },
];

/** Live GitHub intake for `FIRST_REPOSITORY_ID`: what the board's Intake column offers. */
export const intakePullRequests: GithubPullRequest[] = [
  {
    number: 20454,
    title: 'Harden the review board drop target',
    url: 'https://github.com/mastra-ai/mastra/pull/20454',
    author: 'ana',
    baseBranch: 'main',
    headBranch: 'fix/review-drop-target',
    createdAt: '2026-07-30T09:00:00.000Z',
    updatedAt: '2026-07-30T09:05:00.000Z',
  },
  {
    // Already filed as `work-item-review`; the live feed still lists it, search must not double it.
    number: 900,
    title: 'Review command palette PR',
    url: 'https://github.com/mastra-ai/mastra/pull/900',
    author: 'ben',
    baseBranch: 'main',
    headBranch: 'feat/command-palette',
    createdAt: '2026-07-29T13:00:00.000Z',
    updatedAt: '2026-07-29T13:10:00.000Z',
  },
];

export const intakeIssues: GithubIssue[] = [
  {
    number: 20455,
    title: 'Rail scopes overflow on narrow viewports',
    url: 'https://github.com/mastra-ai/mastra/issues/20455',
    author: 'cleo',
    labels: [],
    comments: 0,
    createdAt: '2026-07-30T08:00:00.000Z',
    updatedAt: '2026-07-30T08:10:00.000Z',
  },
];

function toExternalSource(source: WorkItem['source'], sourceKey: string | null, url: string | null) {
  if (source === 'manual' || !sourceKey) return null;

  let integrationId = 'github';
  if (source === 'linear-issue') integrationId = 'linear';

  let type = 'issue';
  if (source === 'github-pr') type = 'pull-request';

  return {
    integrationId,
    type,
    externalId: sourceKey,
    ...(url ? { url } : {}),
  };
}

export function toWireWorkItem(item: WorkItem) {
  const { githubProjectId, source, sourceKey, url, ...rest } = item;

  return {
    ...rest,
    factoryProjectId: githubProjectId,
    externalSource: toExternalSource(source, sourceKey, url),
  };
}
