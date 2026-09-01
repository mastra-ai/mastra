import { describe, expect, it } from 'vitest';

import { issueCandidate, linearCandidate, pullRequestCandidate } from './boardCandidates';
import {
  boardLabels,
  boardLabelsFromQuery,
  boardLabelsQueryValues,
  boardParticipants,
  boardRelevanceFromQuery,
  boardRelevanceOptions,
  boardRelevanceQueryValue,
  candidateMatchesLabels,
  candidateMatchesRelevance,
  workItemMatchesLabels,
  workItemMatchesRelevance,
  workItemRelevance,
} from './boardRelevance';
import type { AuditEventPage } from './services/audit';
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
  commentCount: 0,
  feedActivityAt: null,
  revision: 1,
  createdAt: '2026-08-01T09:00:00.000Z',
  updatedAt: '2026-08-05T09:00:00.000Z',
};

const activityPage: AuditEventPage = {
  events: [
    {
      id: 'event-1',
      actorId: 'user-ada',
      actorType: 'human',
      action: 'factory.work_item.stage_moved',
      targets: [{ type: 'work_item', id: item.id }],
      metadata: {},
      occurredAt: '2026-08-05T09:00:00.000Z',
    },
  ],
  actors: {
    'user-ada': { id: 'user-ada', name: 'Ada Lovelace', avatarUrl: 'https://avatars.example/ada.png' },
    'user-grace': { id: 'user-grace', name: 'Grace Hopper' },
  },
};

describe('board relevance', () => {
  it('tracks Factory activity separately from provider authorship, assignment, and review requests', () => {
    const relevance = workItemRelevance(item, activityPage);

    expect([...relevance.worked]).toEqual(expect.arrayContaining(['factory:user-ada', 'factory:user-grace']));
    expect([...relevance.authored]).toEqual(['github:octocat']);
    expect([...relevance.assigned]).toEqual(['github:hubot']);
    expect([...relevance['review-requested']]).toEqual(['github:monalisa']);
  });

  it('matches any selected relevance type for the selected teammate', () => {
    expect(workItemMatchesRelevance(item, activityPage, 'github:octocat', new Set(['authored']))).toBe(true);
    expect(workItemMatchesRelevance(item, activityPage, 'github:octocat', new Set(['assigned']))).toBe(false);
    expect(
      workItemMatchesRelevance(item, activityPage, 'github:monalisa', new Set(['authored', 'review-requested'])),
    ).toBe(true);
    expect(workItemMatchesRelevance(item, activityPage, undefined, new Set())).toBe(true);
  });

  it('filters intake candidates by GitHub and Linear provider metadata', () => {
    const githubIssue = issueCandidate({
      number: 7,
      title: 'Fix login bug',
      url: 'https://github.com/acme/app/issues/7',
      author: 'octocat',
      assignee: 'hubot',
      labels: [],
      comments: 0,
      createdAt: '2026-08-01T09:00:00.000Z',
      updatedAt: '2026-08-01T09:00:00.000Z',
    });
    const githubPr = pullRequestCandidate({
      number: 12,
      title: 'Ship relevance filters',
      url: 'https://github.com/acme/app/pull/12',
      author: 'octocat',
      assignees: ['hubot'],
      requestedReviewers: ['monalisa'],
      baseBranch: 'main',
      headBranch: 'feat/relevance',
      createdAt: '2026-08-01T09:00:00.000Z',
      updatedAt: '2026-08-01T09:00:00.000Z',
    });
    const linear = linearCandidate({
      id: 'linear-1',
      identifier: 'ENG-12',
      title: 'Filter the board',
      url: 'https://linear.app/acme/issue/ENG-12',
      state: 'Todo',
      stateType: 'unstarted',
      priorityLabel: 'High',
      assignee: 'Grace Hopper',
      creator: 'Ada Lovelace',
      team: 'Engineering',
      labels: [],
      createdAt: '2026-08-01T09:00:00.000Z',
      updatedAt: '2026-08-01T09:00:00.000Z',
    });

    expect(candidateMatchesRelevance(githubIssue, 'github:hubot', new Set(['assigned']))).toBe(true);
    expect(candidateMatchesRelevance(githubPr, 'github:monalisa', new Set(['review-requested']))).toBe(true);
    expect(candidateMatchesRelevance(linear, 'linear:ada lovelace', new Set(['authored']))).toBe(true);
    expect(candidateMatchesRelevance(linear, 'linear:grace hopper', new Set(['assigned']))).toBe(true);
  });

  it('builds a named teammate list from auth, audit, and provider metadata without raw Factory ids', () => {
    const participants = boardParticipants({
      items: [item],
      candidates: [],
      activityPage,
      currentUser: { userId: 'user-current', name: 'Katherine Johnson' },
    });

    expect(participants.map(participant => participant.id)).toEqual([
      'factory:user-ada',
      'factory:user-grace',
      'github:hubot',
      'factory:user-current',
      'github:monalisa',
      'github:octocat',
    ]);
    expect(participants.find(participant => participant.id === 'github:octocat')?.avatarUrl).toContain(
      'github.com/octocat.png',
    );
    expect(participants.some(participant => participant.name === 'user-current')).toBe(false);
  });

  it('parses and serializes shareable relevance query values', () => {
    expect([...boardRelevanceFromQuery(null, 'work')]).toEqual(['worked', 'authored', 'assigned']);
    expect([...boardRelevanceFromQuery('assigned,review-requested', 'work')]).toEqual(['assigned']);
    expect([...boardRelevanceFromQuery('none', 'review')]).toEqual([]);
    expect(boardRelevanceQueryValue(new Set(['worked', 'assigned']), 'work')).toBe('worked,assigned');
    expect(boardRelevanceQueryValue(new Set(), 'review')).toBe('none');
    expect(boardRelevanceQueryValue(new Set(['worked', 'authored', 'assigned']), 'work')).toBeUndefined();
  });

  it('collects and matches labels across items and candidates and serializes the label query', () => {
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

    expect(boardLabels({ items: [labelled], candidates: [candidate] })).toEqual(['bug', 'p1', 'ux']);
    expect(workItemMatchesLabels(labelled, new Set())).toBe(true);
    expect(workItemMatchesLabels(labelled, new Set(['bug', 'p1']))).toBe(true);
    expect(workItemMatchesLabels(labelled, new Set(['bug', 'missing']))).toBe(false);
    expect(candidateMatchesLabels(candidate, new Set(['p1']))).toBe(true);
    expect(candidateMatchesLabels(candidate, new Set(['bug']))).toBe(false);
    expect(boardLabelsFromQuery([])).toEqual(new Set());
    expect([...boardLabelsFromQuery(['bug', 'p1'])]).toEqual(['bug', 'p1']);
    expect(boardLabelsQueryValues(new Set())).toEqual([]);
    expect(boardLabelsQueryValues(new Set(['p1', 'bug']))).toEqual(['bug', 'p1']);
  });

  it('round-trips labels containing commas through repeated query values', () => {
    // Regression: a single-value comma-joined format would split `needs,review`
    // into two labels on reload and never match the original.
    const selected = new Set(['needs,review', 'priority:p0']);
    const values = boardLabelsQueryValues(selected);
    // Repeated params preserve each label as its own value.
    const params = new URLSearchParams();
    for (const value of values) params.append('label', value);
    const restored = boardLabelsFromQuery(params.getAll('label'));
    expect(restored).toEqual(selected);
    // And a URL-encoded round trip.
    const encoded = new URLSearchParams(params.toString());
    expect(boardLabelsFromQuery(encoded.getAll('label'))).toEqual(selected);
  });

  it('offers review-requested only on review boards', () => {
    expect(boardRelevanceOptions('work').map(option => option.id)).toEqual(['worked', 'authored', 'assigned']);
    expect(boardRelevanceOptions('review').map(option => option.id)).toEqual([
      'worked',
      'authored',
      'assigned',
      'review-requested',
    ]);
  });
});
