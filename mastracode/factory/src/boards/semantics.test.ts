import { describe, expect, it } from 'vitest';

import { defineBoard } from './define-board.js';
import { createBoardRegistry } from './registry.js';
import { boardForWorkItem, resolveBoardToolRule, resolvePhaseSemantics, workItemPhaseSemantics } from './semantics.js';
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

  it('infers Review for a legacy merge-request row too', () => {
    // A proposed change belongs in review whichever provider named it;
    // inferring Work would strand a GitLab card on a board with no reviewer.
    expect(
      boardForWorkItem({
        board: null,
        externalSource: { integrationId: 'gitlab', type: 'merge-request', externalId: '42!12' },
      }),
    ).toBe('review');
    // A GitLab issue is still work to be done.
    expect(
      boardForWorkItem({
        board: null,
        externalSource: { integrationId: 'gitlab', type: 'issue', externalId: '42!7' },
      }),
    ).toBe('work');
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

describe('resolveBoardToolRule', () => {
  it('resolves only from the installed board that declares the tool', () => {
    const onResult = () => undefined;
    const release = defineBoard({
      id: 'release',
      title: 'Release',
      initialPhase: 'queued',
      phases: {
        queued: { title: 'Queued', kind: 'resting', next: 'shipped' },
        shipped: { title: 'Shipped', kind: 'terminal' },
      },
      tools: { ship_it: { onResult } },
    });
    const boards = createBoardRegistry({ boards: [release] });
    expect(resolveBoardToolRule(boards, 'release', 'ship_it')).toBe(onResult);
    expect(resolveBoardToolRule(boards, 'work', 'submit_plan')).toBeTypeOf('function');
    expect(resolveBoardToolRule(boards, 'review', 'submit_plan')).toBeUndefined();
    expect(resolveBoardToolRule(boards, 'release', 'submit_plan')).toBeUndefined();
    expect(resolveBoardToolRule(boards, 'work', 'ship_it')).toBeUndefined();
    expect(resolveBoardToolRule(boards, 'missing', 'ship_it')).toBeUndefined();
    expect(
      resolveBoardToolRule(createBoardRegistry({ boards: [], includeDefaultBoards: false }), 'work', 'submit_plan'),
    ).toBeUndefined();
  });
});
