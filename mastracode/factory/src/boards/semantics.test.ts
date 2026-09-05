import { describe, expect, it } from 'vitest';

import { defineBoard } from './define-board.js';
import { createBoardRegistry } from './registry.js';
import { boardForWorkItem, resolvePhaseSemantics, workItemPhaseSemantics } from './semantics.js';
import { createTestBoard } from './test-utils.js';

describe('boardForWorkItem', () => {
  it('prefers the persisted board', () => {
    expect(boardForWorkItem({ board: 'release', externalSource: null })).toBe('release');
    expect(
      boardForWorkItem({
        board: 'release',
        externalSource: { integrationId: 'github', type: 'pull-request', externalId: '1' },
      }),
    ).toBe('release');
  });

  it('infers Review for legacy pull-request rows and Work otherwise', () => {
    expect(
      boardForWorkItem({
        board: null,
        externalSource: { integrationId: 'github', type: 'pull-request', externalId: '1' },
      }),
    ).toBe('review');
    expect(boardForWorkItem({ board: null, externalSource: null })).toBe('work');
  });
});

describe('resolvePhaseSemantics', () => {
  const boards = createBoardRegistry({ boards: [createTestBoard()] });

  it('reads kind and role from the installed board', () => {
    expect(resolvePhaseSemantics(boards, 'release', 'queued')).toEqual({ kind: 'resting' });
    expect(resolvePhaseSemantics(boards, 'release', 'shipping')).toEqual({ kind: 'working', role: 'release' });
    expect(resolvePhaseSemantics(boards, 'release', 'shipped')).toEqual({ kind: 'terminal' });
    expect(resolvePhaseSemantics(boards, 'work', 'planning')).toEqual({ kind: 'working', role: 'plan' });
    expect(resolvePhaseSemantics(boards, 'work', 'done')).toEqual({ kind: 'terminal' });
  });

  it('returns undefined for uninstalled boards and undeclared phases instead of guessing by name', () => {
    expect(resolvePhaseSemantics(boards, 'missing', 'done')).toBeUndefined();
    expect(resolvePhaseSemantics(boards, 'release', 'done')).toBeUndefined();
    expect(resolvePhaseSemantics(boards, 'release', 'intake')).toBeUndefined();
    const only = createBoardRegistry({ boards: [createTestBoard()], includeDefaultBoards: false });
    expect(resolvePhaseSemantics(only, 'work', 'done')).toBeUndefined();
  });

  it('gives a board that reuses Work phase names its own declarations', () => {
    const board = defineBoard({
      id: 'bot',
      title: 'Bot',
      initialPhase: 'intake',
      phases: {
        intake: { title: 'Intake', kind: 'resting', next: 'done' },
        done: { title: 'Done', kind: 'working', role: 'bot', next: 'intake' },
      },
    });
    const registry = createBoardRegistry({ boards: [board] });
    expect(resolvePhaseSemantics(registry, 'bot', 'done')).toEqual({ kind: 'working', role: 'bot' });
    expect(resolvePhaseSemantics(registry, 'work', 'done')).toEqual({ kind: 'terminal' });
  });
});

describe('workItemPhaseSemantics', () => {
  const boards = createBoardRegistry({ boards: [createTestBoard()] });

  it('resolves through the item board and single stage', () => {
    expect(workItemPhaseSemantics(boards, { board: 'release', externalSource: null, stages: ['shipped'] })).toEqual({
      kind: 'terminal',
    });
    expect(
      workItemPhaseSemantics(boards, {
        board: null,
        externalSource: { integrationId: 'github', type: 'pull-request', externalId: '1' },
        stages: ['review'],
      }),
    ).toEqual({ kind: 'working', role: 'review' });
  });

  it('is undefined for multi-stage rows', () => {
    expect(
      workItemPhaseSemantics(boards, { board: 'work', externalSource: null, stages: ['review', 'done'] }),
    ).toBeUndefined();
  });
});
