import { describe, expect, it } from 'vitest';

import { orderWorkItemsForStage } from './boardOrder';
import type { WorkItem, WorkItemStageEntry } from './services/workItems';

function item({
  id,
  createdAt,
  updatedAt = createdAt,
  stageHistory = [],
}: {
  id: string;
  createdAt: string;
  updatedAt?: string;
  stageHistory?: WorkItemStageEntry[];
}): WorkItem {
  return {
    id,
    orgId: 'org-1',
    createdBy: 'user-1',
    githubProjectId: 'factory-1',
    source: 'manual',
    sourceKey: null,
    parentWorkItemId: null,
    title: id,
    url: null,
    stages: ['triage'],
    stageHistory,
    sessions: {},
    metadata: {},
    triageType: null,
    acceptedAt: null,
    commentCount: 0,
    feedActivityAt: null,
    revision: 1,
    createdAt,
    updatedAt,
  };
}

describe('board column order', () => {
  it('places the card most recently entered into the column first', () => {
    const olderCardMovedRecently = item({
      id: 'older-card',
      createdAt: '2026-07-20T09:00:00.000Z',
      stageHistory: [{ stage: 'triage', enteredAt: '2026-07-23T11:00:00.000Z', by: 'user-1' }],
    });
    const newerCardMovedEarlier = item({
      id: 'newer-card',
      createdAt: '2026-07-22T09:00:00.000Z',
      stageHistory: [{ stage: 'triage', enteredAt: '2026-07-23T10:00:00.000Z', by: 'user-2' }],
    });

    expect(
      orderWorkItemsForStage([newerCardMovedEarlier, olderCardMovedRecently], 'triage').map(card => card.id),
    ).toEqual(['older-card', 'newer-card']);
  });

  it('does not move a card when an unrelated write changes updatedAt', () => {
    const recentlyPositioned = item({
      id: 'recently-positioned',
      createdAt: '2026-07-20T09:00:00.000Z',
      updatedAt: '2026-07-23T11:00:00.000Z',
      stageHistory: [{ stage: 'triage', enteredAt: '2026-07-23T10:00:00.000Z', by: 'user-1' }],
    });
    const recentlyWritten = item({
      id: 'recently-written',
      createdAt: '2026-07-21T09:00:00.000Z',
      updatedAt: '2026-07-24T12:00:00.000Z',
      stageHistory: [{ stage: 'triage', enteredAt: '2026-07-22T10:00:00.000Z', by: 'user-2' }],
    });

    expect(orderWorkItemsForStage([recentlyWritten, recentlyPositioned], 'triage').map(card => card.id)).toEqual([
      'recently-positioned',
      'recently-written',
    ]);
  });

  it('falls back to creation time for cards without a matching stage entry', () => {
    const oldest = item({ id: 'oldest', createdAt: '2026-07-20T09:00:00.000Z' });
    const newest = item({ id: 'newest', createdAt: '2026-07-22T09:00:00.000Z' });

    expect(orderWorkItemsForStage([oldest, newest], 'triage').map(card => card.id)).toEqual(['newest', 'oldest']);
  });

  it('can prioritize cards the current user most recently moved into the column', () => {
    const movedByMe = item({
      id: 'moved-by-me',
      createdAt: '2026-07-20T09:00:00.000Z',
      stageHistory: [{ stage: 'triage', enteredAt: '2026-07-22T10:00:00.000Z', by: 'user-1' }],
    });
    const movedByTeammate = item({
      id: 'moved-by-teammate',
      createdAt: '2026-07-21T09:00:00.000Z',
      stageHistory: [{ stage: 'triage', enteredAt: '2026-07-24T10:00:00.000Z', by: 'user-2' }],
    });

    expect(
      orderWorkItemsForStage([movedByTeammate, movedByMe], 'triage', 'recent-mine', 'user-1').map(card => card.id),
    ).toEqual(['moved-by-me', 'moved-by-teammate']);
  });

  it('can sort by Factory creation time in either direction', () => {
    const oldest = item({ id: 'oldest', createdAt: '2026-07-20T09:00:00.000Z' });
    const newest = item({ id: 'newest', createdAt: '2026-07-22T09:00:00.000Z' });

    expect(orderWorkItemsForStage([oldest, newest], 'triage', 'created-newest').map(card => card.id)).toEqual([
      'newest',
      'oldest',
    ]);
    expect(orderWorkItemsForStage([oldest, newest], 'triage', 'created-oldest').map(card => card.id)).toEqual([
      'oldest',
      'newest',
    ]);
  });
});
