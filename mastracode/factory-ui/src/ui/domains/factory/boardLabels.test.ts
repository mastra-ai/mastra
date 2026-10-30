import { describe, expect, it } from 'vitest';

import { issueCandidate, linearCandidate } from './boardCandidates';
import { boardLabels, candidateMatchesLabels, workItemMatchesLabels } from './boardLabels';
import type { WorkItem } from './services/workItems';

const item: WorkItem = {
  id: 'item-1',
  orgId: 'org-1',
  createdBy: 'factory-rule-dispatcher',
  githubProjectId: 'factory-1',
  source: 'github-pr',
  sourceKey: 'github-pr:12',
  parentWorkItemId: null,
  title: 'Ship relevance filters',
  url: 'https://github.com/acme/app/pull/12',
  stages: ['review'],
  stageHistory: [],
  sessions: {
    review: {
      sessionId: 'session-1',
      threadId: 'thread-1',
      branch: 'review/relevance',
      startedBy: 'user-grace',
    },
  },
  metadata: {
    author: 'octocat',
    assignees: ['hubot'],
    requestedReviewers: ['monalisa'],
  },
  triageType: null,
  acceptedAt: null,
  commentCount: 0,
  feedActivityAt: null,
  revision: 1,
  createdAt: '2026-08-01T09:00:00.000Z',
  updatedAt: '2026-08-05T09:00:00.000Z',
};

describe('board labels', () => {
  it('collects labels across items and candidates and keeps only cards carrying every picked label', () => {
    const labelled: WorkItem = { ...item, metadata: { ...item.metadata, labels: ['bug', 'p1'] } };
    const candidate = issueCandidate({
      number: 8,
      title: 'Fix cache',
      url: 'https://github.com/acme/app/issues/8',
      author: 'hubot',
      assignee: null,
      labels: ['ux', 'p1'],
      comments: 0,
      createdAt: '2026-08-01T09:00:00.000Z',
      updatedAt: '2026-08-01T09:00:00.000Z',
    });

    const linear = linearCandidate({
      id: 'linear-2',
      identifier: 'ENG-13',
      title: 'Linear labels',
      url: 'https://linear.app/acme/issue/ENG-13',
      state: 'Todo',
      stateType: 'unstarted',
      priorityLabel: 'High',
      assignee: null,
      creator: null,
      team: 'Engineering',
      labels: ['frontend'],
      createdAt: '2026-08-01T09:00:00.000Z',
      updatedAt: '2026-08-01T09:00:00.000Z',
    });

    expect(boardLabels({ items: [labelled], candidates: [candidate, linear] })).toEqual([
      'bug',
      'frontend',
      'p1',
      'ux',
    ]);
    expect(candidateMatchesLabels(linear, new Set(['frontend']))).toBe(true);
    expect(workItemMatchesLabels(labelled, new Set())).toBe(true);
    expect(workItemMatchesLabels(labelled, new Set(['bug', 'p1']))).toBe(true);
    expect(workItemMatchesLabels(labelled, new Set(['bug', 'missing']))).toBe(false);
    expect(candidateMatchesLabels(candidate, new Set(['p1']))).toBe(true);
    expect(candidateMatchesLabels(candidate, new Set(['bug']))).toBe(false);
  });

  it('matches labels the live candidate gained since the item was stored', () => {
    const live = issueCandidate({
      number: 12,
      title: 'Ship relevance filters',
      url: 'https://github.com/acme/app/issues/12',
      author: 'octocat',
      assignee: null,
      labels: ['bug'],
      comments: 0,
      createdAt: '2026-08-01T09:00:00.000Z',
      updatedAt: '2026-08-02T09:00:00.000Z',
    });

    expect(workItemMatchesLabels(item, new Set(['bug']))).toBe(false);
    expect(workItemMatchesLabels(item, new Set(['bug']), live)).toBe(true);
  });
});
