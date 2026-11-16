import { describe, expect, it } from 'vitest';

import type { WorkItemSourceRow } from '../storage/domains/work-items/work-item-schema.js';
import { cardChangeRequest, cardChangeRequests, changeRequestNumber } from './change-requests.js';

const AT = new Date('2026-07-01T00:00:00.000Z');

function source(overrides: Partial<WorkItemSourceRow> = {}): WorkItemSourceRow {
  return {
    id: 'source-pr-34',
    workItemId: 'work-1',
    provider: 'github',
    integrationId: 'github',
    sourceType: 'pull-request',
    workspaceId: null,
    externalId: 'pull-request:github-pr:34',
    sourceKey: null,
    key: null,
    url: 'https://github.com/acme/app/pull/34',
    state: 'open',
    labels: [],
    author: null,
    metadata: { githubPullRequestNumber: 34 },
    revision: 1,
    syncedAt: AT,
    createdAt: AT,
    updatedAt: AT,
    ...overrides,
  };
}

const issueSource = source({
  id: 'source-issue-12',
  sourceType: 'issue',
  externalId: 'issue:github-issue:12',
  url: 'https://github.com/acme/app/issues/12',
  metadata: {},
});

function issueCard(sources: WorkItemSourceRow[], metadata: Record<string, unknown> = {}) {
  return {
    source: 'github-issue',
    url: 'https://github.com/acme/app/issues/12',
    metadata,
    workItem: { state: 'closed', metadata: {}, sources: [issueSource, ...sources] },
  };
}

function statusOf(overrides: Partial<WorkItemSourceRow>) {
  return cardChangeRequest(issueCard([source(overrides)]))?.status;
}

describe('change request status', () => {
  it('reads what the code host last reported on the source', () => {
    expect(statusOf({ state: 'open' })).toBe('open');
    expect(statusOf({ state: 'opened', provider: 'gitlab' })).toBe('open');
    expect(statusOf({ state: 'locked' })).toBe('open');
    expect(statusOf({ state: 'closed' })).toBe('closed');
    expect(statusOf({ state: 'merged' })).toBe('merged');
  });

  it('reads a draft only while the request is open', () => {
    const draft = { githubPullRequestNumber: 34, draft: true };
    expect(statusOf({ state: 'open', metadata: draft })).toBe('draft');
    expect(statusOf({ state: 'closed', metadata: draft })).toBe('closed');
  });

  it('takes a merged flag over a closed state, and metadata state when the source has none', () => {
    expect(statusOf({ state: 'closed', metadata: { merged: true } })).toBe('merged');
    expect(statusOf({ state: null, metadata: { state: 'closed' } })).toBe('closed');
  });

  it('leaves an unreported state unknown, never guessing open', () => {
    expect(statusOf({ state: null, metadata: {} })).toBeUndefined();
    expect(statusOf({ state: '' })).toBeUndefined();
  });

  it('keeps when the code host last reported, and nothing for a source never synced', () => {
    expect(cardChangeRequest(issueCard([source()]))?.syncedAt).toBe(AT.getTime());
    expect(cardChangeRequest(issueCard([source({ syncedAt: null })]))?.syncedAt).toBeUndefined();
  });
});

describe('cardChangeRequest', () => {
  const older = source({ id: 'pr-33', metadata: { githubPullRequestNumber: 33 }, state: 'open' });
  const closed = source({ id: 'pr-34', metadata: { githubPullRequestNumber: 34 }, state: 'closed' });
  const merged = source({ id: 'pr-35', metadata: { githubPullRequestNumber: 35 }, state: 'merged' });

  it("follows the issue card's pointer to the pull request it opened", () => {
    expect(cardChangeRequest(issueCard([older, closed, merged], { openPullRequestNumber: 34 }))?.number).toBe(34);
  });

  it('falls back to the newest open pull request, then the newest', () => {
    expect(cardChangeRequest(issueCard([older, closed, merged]))?.number).toBe(33);
    expect(cardChangeRequest(issueCard([closed, merged]))?.number).toBe(35);
  });

  it('names nothing for an issue card without pull requests', () => {
    expect(cardChangeRequest(issueCard([]))).toBeUndefined();
  });

  it("reads a pull request card's own request, not one attached later", () => {
    const own = source({ id: 'pr-34', metadata: { githubPullRequestNumber: 34 } });
    const card = {
      source: 'github-pr',
      url: 'https://github.com/acme/app/pull/34',
      metadata: { openPullRequestNumber: 35 },
      workItem: { state: 'open', metadata: {}, sources: [own, merged] },
    };

    expect(cardChangeRequest(card)?.number).toBe(34);
    expect(cardChangeRequests(card).map(request => request.number)).toEqual([34, 35]);
  });
});

describe('a pull request card filed before its sources were recorded', () => {
  it('reads the request from the work item facts', () => {
    const card = {
      source: 'gitlab-pr',
      url: 'https://gitlab.com/acme/app/-/merge_requests/7',
      metadata: { gitlabMergeRequestIid: 99, state: 'merged' },
      workItem: { state: 'opened', metadata: { gitlabMergeRequestIid: 7, draft: true }, sources: [] },
    };

    expect(cardChangeRequests(card)).toEqual([
      {
        url: 'https://gitlab.com/acme/app/-/merge_requests/7',
        provider: 'gitlab',
        number: 7,
        status: 'draft',
        draft: true,
      },
    ]);
  });

  it('reads the card metadata when the card carries no work item', () => {
    const card = {
      source: 'github-pr',
      url: 'https://github.com/acme/app/pull/42',
      metadata: { number: 42, state: 'closed', merged: true },
    };

    expect(cardChangeRequest(card)).toEqual({
      url: 'https://github.com/acme/app/pull/42',
      provider: 'github',
      number: 42,
      status: 'merged',
      draft: false,
    });
  });

  it('names nothing for a card that is no pull request', () => {
    expect(cardChangeRequests({ source: 'linear-issue', metadata: { number: 3, state: 'open' } })).toEqual([]);
  });
});

describe('changeRequestNumber', () => {
  it('reads a GitHub pull request number, preferring the explicit field', () => {
    expect(changeRequestNumber('github-pr', { githubPullRequestNumber: 12, number: 99 })).toBe(12);
    expect(changeRequestNumber('github-pr', { number: 99 })).toBe(99);
  });

  it('reads a GitLab merge request iid, never its global id', () => {
    expect(changeRequestNumber('gitlab-pr', { gitlabMergeRequestIid: 7, number: 99 })).toBe(7);
    expect(changeRequestNumber('gitlab-pr', { number: 99 })).toBeUndefined();
  });

  it('rejects numbers no code host issues, and cards that are no request', () => {
    expect(changeRequestNumber('github-pr', { githubPullRequestNumber: 0 })).toBeUndefined();
    expect(changeRequestNumber('github-pr', { githubPullRequestNumber: 1.5 })).toBeUndefined();
    expect(changeRequestNumber('github-pr', { githubPullRequestNumber: '12' })).toBeUndefined();
    expect(changeRequestNumber('gitlab-pr', { gitlabMergeRequestIid: -1 })).toBeUndefined();
    expect(changeRequestNumber('github-issue', { number: 12 })).toBeUndefined();
  });
});
