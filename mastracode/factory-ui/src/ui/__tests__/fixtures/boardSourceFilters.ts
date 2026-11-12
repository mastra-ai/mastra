import type { IntakeCandidateInfo } from '../../../api/types';
import type { LinearProject } from '../../domains/factory/services/linear';
import type { WorkItem } from '../../domains/factory/services/workItems';
import { githubIssueRecord, linearRecord } from './intakeCandidates';

const now = '2026-10-06T12:00:00.000Z';

export const linearProjects: LinearProject[] = [
  { id: 'project-a', name: 'Customer Portal', state: 'started', teams: [] },
  { id: 'project-b', name: 'Billing', state: 'started', teams: [] },
];

/** A Linear issue with no card yet, as the server's list offers it. */
export function offeredLinearIssue(identifier: string, projectId?: string, title = identifier): IntakeCandidateInfo {
  return linearRecord(identifier, { projectId, title, labels: ['feature'], author: 'alice', createdAt: now });
}

export const offeredLinearIssues: IntakeCandidateInfo[] = [
  offeredLinearIssue('ENG-101', 'project-a', 'Portal: add account switcher'),
  offeredLinearIssue('ENG-201', 'project-b', 'Billing: export invoices'),
  offeredLinearIssue('ENG-401', undefined, 'Unassigned project'),
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
  card('ENG-102', 'Portal: invite teammates', 'linear-issue', 'intake', 'project-a'),
  card('ENG-103', 'Portal: workspace settings', 'linear-issue', 'planning', 'project-a'),
  card('ENG-104', 'Portal: member permissions', 'linear-issue', 'execute', 'project-a'),
  card('ENG-202', 'Billing: payment history', 'linear-issue', 'planning', 'project-b'),
  card('ENG-301', 'Moved project card', 'linear-issue', 'planning', 'project-b'),
  card('50', 'GitHub: update dependencies', 'github-issue', 'planning'),
  card('manual', 'Manual follow-up', 'manual', 'intake'),
];

export const offeredGithubIssue = githubIssueRecord(42, {
  title: 'GitHub: improve error messages',
  labels: ['feature'],
  author: 'alice',
  createdAt: now,
});

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
