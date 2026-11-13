import type { GithubIssue } from '../../domains/factory/services/factory';
import type { LinearProject } from '../../domains/factory/services/linear';
import type { WorkItem } from '../../domains/factory/services/workItems';

const now = '2026-10-06T12:00:00.000Z';

export const linearProjects: LinearProject[] = [
  { id: 'project-a', name: 'Customer Portal', state: 'started', teams: [] },
  { id: 'project-b', name: 'Billing', state: 'started', teams: [] },
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
    description: null,
    revision: 1,
    createdAt: now,
    updatedAt: now,
  };
}

export const sourceCards: WorkItem[] = [
  // Linear issues reach the board as cards the server filed, never as live issues.
  card('ENG-101', 'Portal: add account switcher', 'linear-issue', 'intake', 'project-a'),
  card('ENG-201', 'Billing: export invoices', 'linear-issue', 'intake', 'project-b'),
  card('ENG-401', 'Unassigned project', 'linear-issue', 'intake'),
  card('ENG-102', 'Portal: invite teammates', 'linear-issue', 'intake', 'project-a'),
  card('ENG-103', 'Portal: workspace settings', 'linear-issue', 'planning', 'project-a'),
  card('ENG-104', 'Portal: member permissions', 'linear-issue', 'execute', 'project-a'),
  card('ENG-202', 'Billing: payment history', 'linear-issue', 'planning', 'project-b'),
  card('ENG-301', 'Moved project card', 'linear-issue', 'planning', 'project-b'),
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

function wireSourceCard({ githubProjectId, source, sourceKey, url, ...item }: WorkItem) {
  const base = { ...item, factoryProjectId: githubProjectId };
  if (source === 'manual') return { ...base, externalSource: null };
  return {
    ...base,
    externalSource: {
      integrationId: source === 'linear-issue' ? 'linear' : 'github',
      type: 'issue',
      externalId: sourceKey,
      url,
    },
  };
}

export const wireSourceCards = sourceCards.map(wireSourceCard);
