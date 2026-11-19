import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { isPersistedCandidate, itemSessionSpec, metadataLabelColors, persistedSourceKeys } from './boardItems';
import { workItemMeta } from './services/relationships';
import type { WorkItem } from './services/workItems';

function workItem(overrides: Partial<WorkItem> = {}): WorkItem {
  return {
    id: 'item-1',
    orgId: 'org1',
    githubProjectId: 'factory-1',
    createdBy: 'user-1',
    triageType: null,
    acceptedAt: null,
    board: 'review',
    source: 'github-pr',
    sourceKey: 'github-pr:22765',
    parentWorkItemId: null,
    title: 'docs: improve generated model page metadata',
    url: 'https://github.com/acme/repo/pull/22765',
    stages: ['intake', 'review'],
    stageHistory: [],
    sessions: {},
    metadata: { githubPullRequestNumber: 22765, author: 'LekoArts' },
    description: null,
    revision: 1,
    createdAt: '2026-09-02T12:00:00.000Z',
    updatedAt: '2026-09-02T12:00:00.000Z',
    ...overrides,
  };
}

describe('workItemMeta', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-02T12:00:30.000Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('ages the card from when the issue/PR was opened upstream, not when the factory imported it', () => {
    const item = workItem({
      metadata: { githubPullRequestNumber: 22765, author: 'LekoArts', sourceCreatedAt: '2026-08-30T12:00:00.000Z' },
    });
    expect(workItemMeta(item)).toEqual(['PR #22765', 'LekoArts', '3d']);
  });

  it('falls back to the factory import time when the source date is unknown', () => {
    expect(workItemMeta(workItem())).toEqual(['PR #22765', 'LekoArts', 'just now']);
  });

  it('falls back to the factory import time when the source date is not a valid timestamp', () => {
    const item = workItem({
      metadata: { githubPullRequestNumber: 22765, author: 'LekoArts', sourceCreatedAt: 'not-a-date' },
    });
    expect(workItemMeta(item)).toEqual(['PR #22765', 'LekoArts', 'just now']);
  });

  it('shows the Jira assignee instead of the reporter', () => {
    const item = workItem({
      source: 'jira-issue',
      sourceKey: 'jira-issue-1',
      metadata: { identifier: 'ENG-42', author: 'Grace', assignee: 'Ada' },
    });
    expect(workItemMeta(item)).toEqual(['ENG-42', 'Ada', 'just now']);
  });

  it('shows the incident.io identifier and assignee like other issue sources', () => {
    const item = workItem({
      source: 'incidentio-follow-up',
      sourceKey: 'incidentio:follow-up:01HFOLLOWUP',
      metadata: { identifier: 'INC-42', author: 'Ada Lovelace', assignee: 'Grace Hopper' },
    });
    expect(workItemMeta(item)).toEqual(['INC-42', 'Grace Hopper', 'just now']);
  });

  it('names a GitLab merge request by its IID', () => {
    expect(
      workItemMeta(workItem({ source: 'gitlab-pr', metadata: { gitlabMergeRequestIid: 5, author: 'Rhys' } })),
    ).toEqual(['MR !5', 'Rhys', 'just now']);
  });

  it('names a card filed by hand by its card number', () => {
    expect(
      workItemMeta(workItem({ source: 'manual', sourceKey: null, url: null, metadata: { cardNumber: 12 } })),
    ).toEqual(['#12', 'just now']);
  });
});

describe('itemSessionSpec', () => {
  it.each([
    ['linear-issue', 'ENG-42', 'factory/linear-eng-42'],
    ['jira-issue', 'OPS-42', 'factory/jira-ops-42'],
    ['incidentio-follow-up', 'INC-42', 'factory/incidentio-inc-42'],
    ['gitlab-issue', 'acme/app#42', 'factory/gitlab-acme-app-42-item1'],
  ] as const)('uses the normalized key for a %s session branch', (source, key, branch) => {
    const item = workItem({
      source,
      title: 'Repair source facts',
      metadata: { identifier: 'stale-key', authorTrusted: true },
      workItem: {
        provider: source,
        key,
        title: 'Repair source facts',
        url: null,
        state: 'open',
        labels: [],
        author: 'reporter',
        metadata: {},
      },
    });
    expect(itemSessionSpec(item)).toEqual({ branch, threadTitle: 'Repair source facts' });
  });

  it('keeps legacy provider numbers when only the key has been normalized', () => {
    const item = workItem({
      workItem: {
        provider: 'github',
        key: 'acme/app#22765',
        title: 'Repair source facts',
        url: null,
        state: 'open',
        labels: [],
        author: 'reporter',
        metadata: {},
      },
    });
    expect(itemSessionSpec(item)).toEqual({
      branch: 'factory/pr-22765-item1',
      threadTitle: 'PR #22765: docs: improve generated model page metadata',
    });
  });
});

describe('metadataLabelColors', () => {
  it('keeps safe provider colors and rejects arbitrary CSS values', () => {
    expect(
      metadataLabelColors({
        labelColors: {
          bug: '#d73a4a',
          documentation: 'rebeccapurple',
          unsafe: 'url(https://example.com/tracker)',
          malformed: '#12345',
        },
      }),
    ).toEqual({ bug: '#d73a4a', documentation: 'rebeccapurple' });
  });
});

describe('persistedSourceKeys', () => {
  it('keeps a same-numbered candidate from another linked repository visible', () => {
    const keys = persistedSourceKeys([
      workItem({ metadata: { githubPullRequestNumber: 22765, githubRepositoryId: 10 } }),
    ]);

    expect(
      isPersistedCandidate(keys, {
        sourceKey: 'github:10:pull-request:22765',
        url: 'https://github.com/acme/repo/pull/22765',
      }),
    ).toBe(true);
    expect(
      isPersistedCandidate(keys, {
        sourceKey: 'github:20:pull-request:22765',
        url: 'https://github.com/other/repo/pull/22765',
      }),
    ).toBe(false);
  });

  it('matches an unstamped legacy card to its candidate by URL', () => {
    const keys = persistedSourceKeys([workItem()]);

    expect(
      isPersistedCandidate(keys, {
        sourceKey: 'github:10:pull-request:22765',
        url: 'https://github.com/acme/repo/pull/22765',
      }),
    ).toBe(true);
  });

  it("counts a pull request attached to an issue card as filed, so Intake doesn't offer it again", () => {
    const pullRequest = {
      id: 'source-pr',
      workItemId: 'work-1',
      provider: 'github' as const,
      integrationId: 'github',
      sourceType: 'pull-request',
      workspaceId: null,
      externalId: 'pull-request:github:10:pull-request:2',
      sourceKey: 'github:pull-request:github:10:pull-request:2',
      key: null,
      url: 'https://github.com/acme/repo/pull/2',
      state: 'open',
      labels: [],
      author: null,
      metadata: { githubPullRequestNumber: 2 },
      revision: 1,
      syncedAt: null,
      createdAt: new Date('2026-09-02T12:00:00.000Z'),
      updatedAt: new Date('2026-09-02T12:00:00.000Z'),
    };
    const issueCard = workItem({
      source: 'github-issue',
      sourceKey: 'github:10:issue:1',
      url: 'https://github.com/acme/repo/issues/1',
      metadata: { githubIssueNumber: 1, githubRepositoryId: 10 },
      workItem: {
        provider: 'github',
        key: null,
        url: 'https://github.com/acme/repo/issues/1',
        title: 'init repo',
        state: 'open',
        labels: [],
        author: null,
        metadata: {},
        sources: [pullRequest],
      },
    });

    const keys = persistedSourceKeys([issueCard]);

    expect(isPersistedCandidate(keys, { sourceKey: 'github:10:pull-request:2', url: '' })).toBe(true);
    expect(isPersistedCandidate(keys, { sourceKey: 'none', url: 'https://github.com/acme/repo/pull/2' })).toBe(true);
    expect(
      isPersistedCandidate(keys, { sourceKey: 'github:10:pull-request:3', url: 'https://github.com/acme/repo/pull/3' }),
    ).toBe(false);
  });
});
