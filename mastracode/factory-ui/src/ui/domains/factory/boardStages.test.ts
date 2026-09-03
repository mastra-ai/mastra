import { FACTORY_RULE_STAGES } from '@mastra/factory/rules/types';

import { describe, expect, it } from 'vitest';

import { boardStages, currentItemStageLabel, itemAppearsInStage } from './boardStages';
import type { WorkItem, WorkItemSource } from './services/workItems';

function workItem(source: WorkItemSource, stages: string[]): WorkItem {
  return {
    id: 'item-1',
    orgId: 'org-1',
    createdBy: 'user-1',
    githubProjectId: 'project-1',
    source,
    sourceKey: null,
    parentWorkItemId: null,
    title: 'Add universal command search',
    url: null,
    stages,
    stageHistory: [],
    sessions: {},
    metadata: {},
    triageType: null,
    acceptedAt: null,
    commentCount: 0,
    feedActivityAt: null,
    revision: 1,
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
  };
}

describe('boardStages', () => {
  it('uses the canonical stage order for the work board', () => {
    expect(boardStages('work').map(stage => stage.id)).toEqual(FACTORY_RULE_STAGES);
  });

  it('selects and labels the review board columns', () => {
    expect(boardStages('review')).toEqual([
      { id: 'intake', label: 'Intake' },
      { id: 'review', label: 'Reviewing' },
      { id: 'done', label: 'Done' },
      { id: 'canceled', label: 'Canceled' },
    ]);
  });
});

describe('currentItemStageLabel', () => {
  it('reads the furthest column the item sits in', () => {
    expect(currentItemStageLabel(workItem('manual', ['triage', 'execute']))).toBe('Building');
  });

  it('ignores stages absent from the item board, which the board itself does not draw', () => {
    expect(currentItemStageLabel(workItem('manual', ['execute', 'obsolete']))).toBe('Building');
    expect(currentItemStageLabel(workItem('github-pr', ['execute', 'review']))).toBe('Reviewing');
  });

  it('falls back to Intake when no stage belongs to the item board', () => {
    expect(currentItemStageLabel(workItem('manual', []))).toBe('Intake');
    expect(currentItemStageLabel(workItem('github-pr', ['execute']))).toBe('Intake');
  });
});

describe('itemAppearsInStage', () => {
  it('leaves a canceled pull request out of the queue of PRs awaiting review', () => {
    const stages = boardStages('review');
    const canceled = workItem('github-pr', ['canceled']);
    expect(itemAppearsInStage(canceled, 'canceled', stages)).toBe(true);
    expect(itemAppearsInStage(canceled, 'intake', stages)).toBe(false);
  });
});
