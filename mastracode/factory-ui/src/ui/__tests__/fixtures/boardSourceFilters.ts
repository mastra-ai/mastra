import type { GithubIssue } from '../../domains/factory/services/factory';
import type { LinearIssue, LinearProject } from '../../domains/factory/services/linear';
import type { WorkItem } from '../../domains/factory/services/workItems';

const now = '2026-10-06T12:00:00.000Z';

export const linearProjects: LinearProject[] = [
  { id: 'project-a', name: 'Customer Portal', state: 'started', teams: [] },
  { id: 'project-b', name: 'Billing', state: 'started', teams: [] },
];

export function linearIssue(identifier: string, projectId: string | null, title = identifier): LinearIssue {
  return {
    id: identifier,
    identifier,
    title,
    url: `https://linear.app/acme/issue/${identifier}`,
    state: 'Todo',
    stateType: 'unstarted',
    priorityLabel: 'Normal',
    assignee: null,
    creator: 'alice',
    team: 'ENG',
    sourceId: 'linear-team:eng',
    projectId,
    labels: ['feature'],
    createdAt: now,
    updatedAt: now,
  };
}

export const linearIssues: LinearIssue[] = [
  linearIssue('ENG-101', 'project-a', 'Portal: add account switcher'),
  linearIssue('ENG-201', 'project-b', 'Billing: export invoices'),
  // This filed card moved to Billing; its live metadata must override the older stored project.
  linearIssue('ENG-301', 'project-b', 'Move to Billing'),
  linearIssue('ENG-401', null, 'Unassigned project'),
];

function card(id: string, title: string, source: WorkItem['source'], stage: string, projectId?: string): WorkItem {
  return {
    id,
    orgId: 'org-1',
    createdBy: 'user-1',
    githubProjectId: 'fp-1',
    board: 'work',
    source,
    sourceKey: source === 'linear-issue' ? `linear:${id}` : `github-issue:${id}`,
    parentWorkItemId: null,
    title,
    url: null,
    stages: [stage],
    stageHistory: [{ stage, enteredAt: now, by: 'user-1' }],
    sessions: {},
    metadata: { linearProjectId: projectId, labels: ['feature'] },
    triageType: null,
    acceptedAt: null,
    commentCount: 0,
    feedActivityAt: null,
    revision: 1,
    createdAt: now,
    updatedAt: now,
  };
}

export const sourceCards: WorkItem[] = [
  card('ENG-102', 'Portal: invite teammates', 'linear-issue', 'intake', 'project-a'),
  card('ENG-103', 'Portal: workspace settings', 'linear-issue', 'planning', 'project-a'),
  card('ENG-104', 'Portal: member permissions', 'linear-issue', 'execute', 'project-a'),
  card('ENG-202', 'Billing: payment history', 'linear-issue', 'planning', 'project-b'),
  card('ENG-301', 'Moved project card', 'linear-issue', 'planning', 'project-a'),
  card('50', 'GitHub: update dependencies', 'github-issue', 'planning'),
  card('manual', 'Manual follow-up', 'manual', 'intake'),
];

export const githubIssue: GithubIssue = {
  number: 42,
  title: 'GitHub: improve error messages',
  url: 'https://github.com/acme/app/issues/42',
  author: 'alice',
  labels: ['feature'],
  comments: 0,
  createdAt: now,
  updatedAt: now,
};

export const wireSourceCards = sourceCards.map(({ githubProjectId, source, sourceKey, url, ...item }) => ({
  ...item,
  factoryProjectId: githubProjectId,
  externalSource:
    source === 'manual'
      ? null
      : {
          integrationId: source === 'linear-issue' ? 'linear' : 'github',
          type: 'issue',
          externalId: sourceKey,
          url,
        },
}));
