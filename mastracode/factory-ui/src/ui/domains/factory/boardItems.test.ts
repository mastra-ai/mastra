import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  externalLinkLabel,
  isPersistedCandidate,
  itemThreadSession,
  itemSessionSpec,
  metadataLabelColors,
  persistedSourceKeys,
  workItemMeta,
} from './boardItems';
import type { WorkItem, WorkItemSessionRef } from './services/workItems';

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
    commentCount: 0,
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
    expect(workItemMeta(item)).toEqual(['#22765', 'LekoArts', '3d']);
  });

  it('falls back to the factory import time when the source date is unknown', () => {
    expect(workItemMeta(workItem())).toEqual(['#22765', 'LekoArts', 'just now']);
  });

  it('falls back to the factory import time when the source date is not a valid timestamp', () => {
    const item = workItem({
      metadata: { githubPullRequestNumber: 22765, author: 'LekoArts', sourceCreatedAt: 'not-a-date' },
    });
    expect(workItemMeta(item)).toEqual(['#22765', 'LekoArts', 'just now']);
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

  it('names a GitLab merge request by its IID and links to GitLab', () => {
    expect(
      workItemMeta(workItem({ source: 'gitlab-pr', metadata: { gitlabMergeRequestIid: 5, author: 'Rhys' } })),
    ).toEqual(['!5', 'Rhys', 'just now']);
    expect(externalLinkLabel('gitlab-pr')).toBe('Open in GitLab');
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

describe('itemThreadSession', () => {
  const session = (id: string): WorkItemSessionRef => ({
    sessionId: id,
    threadId: id,
    branch: 'factory/issue-24244',
    startedBy: 'user-1',
  });

  it('keeps the original triage conversation when session keys arrive in different orders', () => {
    const triage = session('triage-session');
    const work = session('work-session');

    expect(itemThreadSession({ triage, plan: work, work })).toBe(triage);
    expect(itemThreadSession({ work, plan: work, triage })).toBe(triage);
  });

  it('falls back to a custom role session', () => {
    const custom = session('custom-session');

    expect(itemThreadSession({ release: custom })).toBe(custom);
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
});
