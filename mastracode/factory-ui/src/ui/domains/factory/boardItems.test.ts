import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { workItemMeta } from './boardItems';
import type { WorkItem } from './services/workItems';

function workItem(overrides: Partial<WorkItem> = {}): WorkItem {
  return {
    id: 'item-1',
    orgId: 'org1',
    factoryProjectId: 'factory-1',
    board: 'review',
    source: 'github-pr',
    sourceKey: 'github-pr:22765',
    parentWorkItemId: null,
    title: 'docs: improve generated model page metadata',
    stage: 'intake',
    url: 'https://github.com/acme/repo/pull/22765',
    stages: ['intake', 'review'],
    stageHistory: [],
    sessions: {},
    metadata: { githubPullRequestNumber: 22765, author: 'LekoArts' },
    commentCount: 0,
    feedActivityAt: null,
    revision: 1,
    createdAt: '2026-09-02T12:00:00.000Z',
    updatedAt: '2026-09-02T12:00:00.000Z',
    ...overrides,
  } as WorkItem;
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
    expect(workItemMeta(item)).toBe('#22765 · LekoArts · 3d');
  });

  it('falls back to the factory import time when the source date is unknown', () => {
    expect(workItemMeta(workItem())).toBe('#22765 · LekoArts · just now');
  });

  it('falls back to the factory import time when the source date is not a valid timestamp', () => {
    const item = workItem({
      metadata: { githubPullRequestNumber: 22765, author: 'LekoArts', sourceCreatedAt: 'not-a-date' },
    });
    expect(workItemMeta(item)).toBe('#22765 · LekoArts · just now');
  });
});
