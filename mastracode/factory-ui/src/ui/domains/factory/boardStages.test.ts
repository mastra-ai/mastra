import { FACTORY_RULE_STAGES } from '@mastra/factory/rules/types';

import { describe, expect, it } from 'vitest';

import {
  boardStages,
  currentItemStageLabel,
  itemAppearsInStage,
  itemStageOptions,
  pullRequestMayEnter,
} from './boardStages';
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
    expect(currentItemStageLabel(workItem('gitlab-pr', ['execute', 'review']))).toBe('Reviewing');
  });

  it('falls back to Intake when no stage belongs to the item board', () => {
    expect(currentItemStageLabel(workItem('manual', []))).toBe('Intake');
    expect(currentItemStageLabel(workItem('github-pr', ['execute']))).toBe('Intake');
    expect(currentItemStageLabel(workItem('gitlab-pr', ['execute']))).toBe('Intake');
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

describe('pull request cards on the Work board', () => {
  it.each(['github-pr', 'gitlab-pr'] as const)('moves a %s card only through the lanes that review it', source => {
    const card = { ...workItem(source, ['intake']), board: 'work' };
    expect(itemStageOptions(card).map(stage => stage.id)).toEqual(['intake', 'pr-review', 'done', 'canceled']);
    expect(itemStageOptions(card).find(stage => stage.id === 'pr-review')?.label).toBe('PR review');
    // Review is the builder's self-review: a pull request card never enters it.
    for (const stage of ['triage', 'planning', 'execute', 'review'])
      expect(pullRequestMayEnter('work', source, stage)).toBe(false);
    for (const stage of ['intake', 'pr-review', 'done', 'canceled']) {
      expect(pullRequestMayEnter('work', source, stage)).toBe(true);
    }
  });

  it('leaves issues on Work every lane but PR review, and cards on other boards their full lanes', () => {
    const issueLanes = itemStageOptions({ ...workItem('github-issue', ['intake']), board: 'work' }).map(
      stage => stage.id,
    );
    expect(issueLanes).toEqual(boardStages('work').flatMap(stage => (stage.id === 'pr-review' ? [] : [stage.id])));
    expect(itemStageOptions(workItem('github-pr', ['intake']))).toBe(boardStages('review'));
    expect(pullRequestMayEnter('work', 'github-issue', 'execute')).toBe(true);
    // PR review is a pull request's own lane: an issue card is self-reviewed in Review instead.
    expect(pullRequestMayEnter('work', 'github-issue', 'pr-review')).toBe(false);
    expect(pullRequestMayEnter('release', 'github-pr', 'execute')).toBe(true);
  });
});
