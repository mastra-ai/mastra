import { describe, expect, it } from 'vitest';

import { releaseBoard, workBoard } from '../../../../e2e/ui/board-catalog';
import {
  cardContextSessions,
  cardThreadSession,
  contextLabel,
  externalLinkLabel,
  isPersistedCandidate,
  itemThreadSession,
  itemSessionSpec,
  metadataLabelColors,
  persistedSourceKeys,
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
    description: null,
    revision: 1,
    createdAt: '2026-09-02T12:00:00.000Z',
    updatedAt: '2026-09-02T12:00:00.000Z',
    ...overrides,
  };
}

describe('externalLinkLabel', () => {
  it('links a GitLab merge request to GitLab', () => {
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

describe('card sessions by context', () => {
  const session = (id: string): WorkItemSessionRef => ({
    sessionId: id,
    threadId: `${id}-thread`,
    branch: 'factory/issue-7',
    startedBy: 'user-1',
  });
  const visit = (stage: string, enteredAt: string) => ({ stage, enteredAt, by: 'agent' });
  const triage = session('triage-session');
  const work = session('work-session');
  const review = session('review-session');

  it('names a context after its only phase, else by its well-known name, else by its key', () => {
    expect(contextLabel('release-preparer', releaseBoard.phases)).toBe('Preparing');
    expect(contextLabel('triage', workBoard.phases)).toBe('Triage');
    expect(contextLabel('work', workBoard.phases)).toBe('Work');
    expect(contextLabel('review', workBoard.phases)).toBe('Review');
    expect(contextLabel('plan', workBoard.phases)).toBe('Planning');
    expect(contextLabel('deploy-check', workBoard.phases)).toBe('Deploy-check');
    expect(contextLabel('work', undefined)).toBe('Work');
  });

  it("lists the current phase's context first, then the most recently visited, then the rest", () => {
    const item = workItem({
      board: 'work',
      stages: ['execute'],
      sessions: { review, triage, work },
      stageHistory: [
        visit('intake', '2026-09-01T00:00:00Z'),
        visit('triage', '2026-09-02T00:00:00Z'),
        visit('execute', '2026-09-03T00:00:00Z'),
      ],
    });

    expect(cardContextSessions(item, workBoard.phases, 'execute')).toEqual([
      { context: 'work', label: 'Work', ref: work, current: true },
      { context: 'triage', label: 'Triage', ref: triage, current: false },
      { context: 'review', label: 'Review', ref: review, current: false },
    ]);
    expect(cardThreadSession(item, workBoard.phases, 'execute')).toBe(work);
  });

  it('opens the last visited context when the current phase holds no session', () => {
    const item = workItem({
      board: 'work',
      stages: ['intake'],
      sessions: { triage, work },
      stageHistory: [
        visit('triage', '2026-09-02T00:00:00Z'),
        visit('planning', '2026-09-03T00:00:00Z'),
        visit('intake', '2026-09-04T00:00:00Z'),
      ],
    });

    expect(cardThreadSession(item, workBoard.phases, 'intake')).toBe(work);
    expect(cardContextSessions(item, workBoard.phases, 'intake').map(entry => [entry.context, entry.current])).toEqual([
      ['work', false],
      ['triage', false],
    ]);
  });

  it('lists a session filed under a legacy plan key and work once, under the current context', () => {
    const item = workItem({ board: 'work', stages: ['planning'], sessions: { plan: work, work } });

    expect(cardContextSessions(item, workBoard.phases, 'planning')).toEqual([
      { context: 'work', label: 'Work', ref: work, current: true },
    ]);
  });

  it("opens a Work card's planner under the legacy plan key while it is in Planning", () => {
    const plan = session('plan-session');
    const item = workItem({ board: 'work', stages: ['planning'], sessions: { triage, plan } });

    expect(cardThreadSession(item, workBoard.phases, 'planning')).toBe(plan);
    expect(cardContextSessions(item, workBoard.phases, 'planning')).toEqual([
      { context: 'work', label: 'Work', ref: plan, current: true },
      { context: 'triage', label: 'Triage', ref: triage, current: false },
    ]);
  });

  it('keeps the lifecycle order without a board catalog', () => {
    const item = workItem({ board: 'work', stages: ['execute'], sessions: { work, triage } });

    expect(cardThreadSession(item, undefined, 'execute')).toBe(triage);
    expect(cardContextSessions(item, undefined, 'execute').map(entry => entry.label)).toEqual(['Work', 'Triage']);
  });

  it('falls back to the lifecycle order when no visited phase holds a session', () => {
    const plan = session('plan-session');
    const item = workItem({ board: 'work', stages: ['planning'], sessions: { chat: work, plan } });

    expect(cardThreadSession(item, workBoard.phases, 'planning')).toBe(plan);
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
