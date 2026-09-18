import { describe, expect, it } from 'vitest';

import type { IncidentioIssue } from './services/incidentio';
import type { JiraIssue } from './services/jira';
import { incidentioCandidate, jiraCandidate } from './boardCandidates';

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

const followUp: IncidentioIssue = {
  id: 'incidentio:follow-up:01HFOLLOWUP',
  identifier: 'INC-42',
  title: 'Add database failover alert',
  url: 'https://app.incident.io/org/follow-ups/01HFOLLOWUP',
  author: 'Ada Lovelace',
  state: 'outstanding',
  stateType: 'unstarted',
  priorityLabel: 'Urgent',
  assignee: 'Grace Hopper',
  incident: 'incident-1',
  labels: ['reliability'],
  createdAt: '2026-09-02T10:00:00Z',
  updatedAt: '2026-09-02T12:00:00Z',
  sourceId: 'incidentio:follow-ups',
};

describe('incidentioCandidate', () => {
  it('preserves incident.io metadata when the follow-up becomes a work card', () => {
    expect(incidentioCandidate(followUp)).toMatchObject({
      source: 'incidentio-follow-up',
      sourceKey: followUp.id,
      meta: 'INC-42 · outstanding · Grace Hopper',
      metadata: {
        identifier: 'INC-42',
        issueRef: followUp.id,
        state: 'outstanding',
        stateType: 'unstarted',
        priority: 'Urgent',
        incident: 'incident-1',
        assignee: 'Grace Hopper',
        assignees: ['Grace Hopper'],
        creator: 'Ada Lovelace',
        author: 'Ada Lovelace',
        labels: ['reliability'],
        createdAt: '2026-09-02T10:00:00Z',
        updatedAt: '2026-09-02T12:00:00Z',
      },
    });
  });
});

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
