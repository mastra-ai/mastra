import { workBoard } from '@mastra/factory/boards';
import type { WorkItemSourceRow } from '@mastra/factory/storage/domains/work-items/work-item-schema';

import { describe, expect, it } from 'vitest';

import {
  boardLoadingStages,
  currentItemStageLabel,
  itemAppearsInStage,
  itemStageOptions,
  pullRequestMayEnter,
} from './boardStages';
import type { WorkItem, WorkItemSource } from './services/workItems';
import { selfReviewWorkBoardInfo, shipBoard, workBoardInfo as work } from '../../../../e2e/ui/board-catalog';
import { BOARD_STAGES } from './stages';

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
    revision: 1,
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
  };
}

function source(sourceType: string, externalId: string, metadata: Record<string, unknown>): WorkItemSourceRow {
  const at = new Date('2026-07-01T00:00:00.000Z');
  return {
    id: externalId,
    workItemId: 'item-1',
    provider: 'github',
    integrationId: 'github',
    sourceType,
    workspaceId: null,
    externalId,
    sourceKey: null,
    key: null,
    url: null,
    state: 'open',
    labels: [],
    author: null,
    metadata,
    revision: 1,
    syncedAt: null,
    createdAt: at,
    updatedAt: at,
  };
}

describe('board stages', () => {
  it('draws every Work lane in the canonical stage order, plus the self-review lane older projects hold', () => {
    expect(BOARD_STAGES.map(stage => stage.id).filter(id => id !== 'review')).toEqual(Object.keys(workBoard.phases));
    expect(BOARD_STAGES.map(stage => stage.label)).toEqual([
      'Intake',
      'Triage',
      'Planning',
      'Building',
      'Self-review',
      'Review',
      'Done',
      'Canceled',
    ]);
  });
});

describe('currentItemStageLabel', () => {
  it('reads the furthest column the item sits in', () => {
    expect(currentItemStageLabel(workItem('manual', ['triage', 'execute']), work)).toBe('Building');
  });

  it('ignores stages absent from the item board, which the board itself does not draw', () => {
    expect(currentItemStageLabel(workItem('manual', ['execute', 'obsolete']), work)).toBe('Building');
    // A pull request's own card never sits in the build lanes, so only Review counts.
    expect(currentItemStageLabel(workItem('github-pr', ['execute', 'pr-review']), work)).toBe('Review');
    expect(currentItemStageLabel(workItem('gitlab-pr', ['execute', 'pr-review']), work)).toBe('Review');
  });

  it('falls back to Intake when no stage belongs to the item board', () => {
    expect(currentItemStageLabel(workItem('manual', []), work)).toBe('Intake');
    expect(currentItemStageLabel(workItem('github-pr', ['execute']), work)).toBe('Intake');
    expect(currentItemStageLabel(workItem('gitlab-pr', ['execute']), work)).toBe('Intake');
  });
});

describe('itemAppearsInStage', () => {
  it('leaves a canceled pull request out of the queue of PRs awaiting review', () => {
    const stages = BOARD_STAGES;
    const canceled = workItem('github-pr', ['canceled']);
    expect(itemAppearsInStage(canceled, 'canceled', stages)).toBe(true);
    expect(itemAppearsInStage(canceled, 'intake', stages)).toBe(false);
  });
});

describe('pull request cards on the Work board', () => {
  it.each(['github-pr', 'gitlab-pr'] as const)('moves a %s card only through the lanes that review it', source => {
    const card = { ...workItem(source, ['intake']), board: 'work' };
    expect(itemStageOptions(card, work).map(stage => stage.id)).toEqual(['intake', 'pr-review', 'done', 'canceled']);
    expect(itemStageOptions(card, work).find(stage => stage.id === 'pr-review')?.label).toBe('Review');
    for (const stage of ['triage', 'planning', 'execute']) expect(pullRequestMayEnter(work, card, stage)).toBe(false);
    // An older project's Work still has its self-review phase, which a pull request card never enters.
    expect(pullRequestMayEnter(selfReviewWorkBoardInfo, card, 'review')).toBe(false);
    for (const stage of ['intake', 'pr-review', 'done', 'canceled']) {
      expect(pullRequestMayEnter(work, card, stage)).toBe(true);
    }
  });

  it('leaves issues on Work every lane but PR review, and cards on other boards their full lanes', () => {
    const issueLanes = itemStageOptions({ ...workItem('github-issue', ['intake']), board: 'work' }, work).map(
      stage => stage.id,
    );
    expect(issueLanes).toEqual(Object.keys(workBoard.phases).filter(id => id !== 'pr-review'));
    const issue = workItem('github-issue', ['intake']);
    expect(pullRequestMayEnter(work, issue, 'execute')).toBe(true);
    // An issue card enters Review only once it carries a pull request.
    expect(pullRequestMayEnter(work, issue, 'pr-review')).toBe(false);
    expect(pullRequestMayEnter(undefined, workItem('github-pr', ['intake']), 'execute')).toBe(true);
  });

  it('opens PR review and the build lanes to an issue card once a pull request is attached to it', () => {
    const issue: WorkItem = {
      ...workItem('github-issue', ['execute']),
      board: 'work',
      workItem: {
        provider: 'github',
        key: null,
        url: null,
        title: 'Add universal command search',
        state: 'open',
        labels: [],
        author: null,
        metadata: {},
        sources: [
          source('issue', 'issue:github-issue:12', { number: 12 }),
          source('pull-request', 'pull-request:github-pr:34', { githubPullRequestNumber: 34 }),
        ],
      },
    };
    expect(itemStageOptions(issue, work).map(stage => stage.id)).toEqual(Object.keys(workBoard.phases));
    expect(pullRequestMayEnter(work, issue, 'pr-review')).toBe(true);
    expect(pullRequestMayEnter(work, issue, 'execute')).toBe(true);
  });
});

describe('pull request cards on a board with its own phase names', () => {
  it("keeps a pull request's card out of the builder's phases, and an issue without one out of review", () => {
    const pullRequest = { ...workItem('github-pr', ['inbox']), board: 'ship' };
    expect(itemStageOptions(pullRequest, shipBoard).map(stage => stage.id)).toEqual([
      'inbox',
      'pr',
      'shipped',
      'dropped',
    ]);
    const issue = { ...workItem('github-issue', ['inbox']), board: 'ship' };
    expect(pullRequestMayEnter(shipBoard, issue, 'pr')).toBe(false);
    expect(pullRequestMayEnter(shipBoard, issue, 'make')).toBe(true);
    expect(currentItemStageLabel({ ...issue, stages: ['think', 'make'] }, shipBoard)).toBe('Make');
  });
});

describe('boardLoadingStages', () => {
  it("shows the intake feed loading in the board's own rest and triage columns", () => {
    const loading = boardLoadingStages({
      board: shipBoard,
      stages: shipBoard.phases.map(phase => ({ id: phase.id, label: phase.title })),
      itemsPending: false,
      intakePending: true,
      triagePending: true,
    });
    expect([...loading]).toEqual(['inbox', 'think']);
  });
});
