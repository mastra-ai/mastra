import { describe, expect, it } from 'vitest';

import type { JiraIssue } from './services/jira';
import { jiraCandidate } from './boardCandidates';

const issue: JiraIssue = {
  id: 'jira-issue:encoded-reference',
  identifier: 'ENG-42',
  title: 'Fix intake sync',
  url: 'https://acme.atlassian.net/browse/ENG-42',
  author: 'Grace',
  state: 'In Progress',
  stateType: 'started',
  priorityLabel: 'High',
  assignee: 'Ada',
  project: 'ENG',
  site: 'acme.atlassian.net',
  labels: ['bug', 'backend'],
  createdAt: '2026-07-01T00:00:00Z',
  updatedAt: '2026-07-02T00:00:00Z',
  sourceId: 'jira-project:encoded-source',
};

describe('jiraCandidate', () => {
  it('preserves Jira metadata when the issue becomes a work card', () => {
    expect(jiraCandidate(issue)).toMatchObject({
      source: 'jira-issue',
      sourceKey: issue.id,
      metadata: {
        identifier: 'ENG-42',
        issueRef: issue.id,
        state: 'In Progress',
        stateType: 'started',
        priority: 'High',
        project: 'ENG',
        site: 'acme.atlassian.net',
        assignee: 'Ada',
        assignees: ['Ada'],
        creator: 'Grace',
        author: 'Grace',
        labels: ['bug', 'backend'],
        createdAt: '2026-07-01T00:00:00Z',
        updatedAt: '2026-07-02T00:00:00Z',
      },
    });
  });
});
