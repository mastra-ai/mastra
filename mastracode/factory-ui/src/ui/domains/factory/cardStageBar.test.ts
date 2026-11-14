import type { WorkItemSourceRow } from '@mastra/factory/storage/domains/work-items/work-item-schema';

import { describe, expect, it } from 'vitest';

import { newProjectWorkBoardInfo as work, releaseBoard, workBoardInfo } from '../../../../e2e/ui/board-catalog';
import { cardStages, stageDescription } from './cardStageBar';
import type { CardStages } from './cardStageBar';
import type { WorkItem, WorkItemSource } from './services/workItems';

function card(source: WorkItemSource, stages: string[], board = 'work'): WorkItem {
  return {
    id: 'item-1',
    orgId: 'org-1',
    createdBy: 'user-1',
    githubProjectId: 'project-1',
    board,
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
    description: null,
    revision: 1,
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
  };
}

function sourceRow(sourceType: string, externalId: string, url: string, metadata: Record<string, unknown>) {
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
    url,
    state: 'open',
    labels: [],
    author: null,
    metadata,
    revision: 1,
    syncedAt: null,
    createdAt: at,
    updatedAt: at,
  } satisfies WorkItemSourceRow;
}

/** An issue card with pull request #34 attached, as the board sends it once the builder opens one. */
function issueWithPullRequest(stages: string[]): WorkItem {
  return {
    ...card('github-issue', stages),
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
        sourceRow('issue', 'issue:github-issue:12', 'https://github.com/acme/app/issues/12', { number: 12 }),
        sourceRow('pull-request', 'pull-request:github-pr:34', 'https://github.com/acme/app/pull/34', {
          githubPullRequestNumber: 34,
        }),
      ],
    },
  };
}

function ids(stages: CardStages | undefined) {
  if (!stages) throw new Error('expected the card to sit on its board');
  return {
    current: stages.current.id,
    previous: stages.previous && { id: stages.previous.phase.id, blocked: stages.previous.blocked },
    next: stages.next && { id: stages.next.phase.id, blocked: stages.next.blocked },
    forward: stages.forward.map(phase => phase.id),
    back: stages.back.map(phase => phase.id),
    stop: stages.stop.map(phase => phase.id),
    notes: stages.notes,
  };
}

describe('cardStages', () => {
  it('offers a reviewed issue card its neighbours and every move the board declares from Review', () => {
    expect(ids(cardStages(issueWithPullRequest(['pr-review']), work))).toEqual({
      current: 'pr-review',
      previous: { id: 'execute', blocked: undefined },
      next: { id: 'done', blocked: undefined },
      forward: ['done'],
      back: ['intake', 'planning', 'execute'],
      stop: ['canceled'],
      notes: [],
    });
  });

  it("names the phases a board declares no move to, such as an older Work board's Triage", () => {
    const stages = ids(cardStages(issueWithPullRequest(['pr-review']), workBoardInfo));

    expect(stages.back).not.toContain('triage');
    expect(stages.notes).toEqual(["Triage can't be reached from Review"]);
  });

  it('holds an issue card without a pull request out of Review, and says why', () => {
    expect(ids(cardStages(card('github-issue', ['execute']), work))).toEqual({
      current: 'execute',
      previous: { id: 'planning', blocked: undefined },
      next: { id: 'pr-review', blocked: 'pull-request' },
      forward: ['done'],
      back: ['planning'],
      stop: ['canceled'],
      notes: ["Intake can't be reached from Building", 'Review needs a pull request'],
    });
  });

  it("keeps a pull request's own card out of the builder's phases", () => {
    expect(ids(cardStages(card('github-pr', ['pr-review']), work))).toEqual({
      current: 'pr-review',
      previous: { id: 'intake', blocked: undefined },
      next: { id: 'done', blocked: undefined },
      forward: ['done'],
      back: ['intake'],
      stop: ['canceled'],
      notes: ["Pull request cards don't enter Planning and Building"],
    });
  });

  it('points a pull request card waiting in Intake at PR review, past the phases it never enters', () => {
    const stages = ids(cardStages(card('github-pr', ['intake']), workBoardInfo));

    expect(stages.next).toEqual({ id: 'pr-review', blocked: undefined });
    expect(stages.previous).toBeUndefined();
  });

  it('takes a stopped card off the track and offers only the phases that reopen it', () => {
    expect(ids(cardStages(issueWithPullRequest(['canceled']), work))).toEqual({
      current: 'canceled',
      previous: undefined,
      next: undefined,
      forward: [],
      back: ['intake', 'pr-review'],
      stop: [],
      notes: ["Planning, Building, and Done can't be reached from Canceled"],
    });
  });

  it('follows a custom board that only declares outcome transitions and has no stop phase', () => {
    expect(ids(cardStages(card('manual', ['preparing'], 'release'), releaseBoard))).toEqual({
      current: 'preparing',
      previous: undefined,
      next: { id: 'shipping', blocked: undefined },
      forward: ['shipping'],
      back: [],
      stop: [],
      notes: ["Queued and Shipped can't be reached from Preparing"],
    });
  });

  it('has no stages for a card whose board has not loaded', () => {
    expect(cardStages(card('manual', ['execute']), undefined)).toBeUndefined();
  });
});

describe('stageDescription', () => {
  const phase = (id: string) => {
    const found = work.phases.find(candidate => candidate.id === id);
    if (!found) throw new Error(`no ${id} phase`);
    return found;
  };

  it('tells the session on screen apart from the session another phase runs in', () => {
    const item = issueWithPullRequest(['pr-review']);

    expect(stageDescription(work, item, phase('pr-review'), 'review')).toBe('Factory works on it in this session');
    expect(stageDescription(work, item, phase('execute'), 'review')).toBe('Factory works on it in the Work session');
  });

  it('expects the open pull request to finish the card, and parks or stops it otherwise', () => {
    expect(stageDescription(work, issueWithPullRequest(['pr-review']), phase('done'))).toBe(
      'Usually automatic when PR #34 merges',
    );
    expect(stageDescription(work, card('github-issue', ['execute']), phase('done'))).toBe('Marks it done');
    expect(stageDescription(work, card('github-issue', ['execute']), phase('intake'))).toBe(
      'Parks it until someone moves it on',
    );
    expect(stageDescription(work, card('github-issue', ['execute']), phase('canceled'))).toBe(
      'Stops all work on this card',
    );
  });

  it("prefers the description a board's author wrote for the phase", () => {
    const described = { ...phase('execute'), description: 'Ships the fix behind a flag' };

    expect(stageDescription(work, card('github-issue', ['planning']), described, 'work')).toBe(
      'Ships the fix behind a flag',
    );
  });
});
