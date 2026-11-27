import { storedBoardInputSchema } from '@mastra/factory/boards/stored-board';
import { describe, expect, it } from 'vitest';

import type { StoredPhaseInfo } from '../../../../api/types';
import {
  exitToolOutcome,
  canRemovePhase,
  defaultOutcomes,
  newOutcome,
  outcomeProblems,
  keyFromName,
  keyProblem,
  movePhase,
  phaseHasProblem,
  removePhase,
  starterBoard,
  withKind,
  withNextPhases,
} from '../boardDraft';
import type { CardRule } from '../boardDraft';

const phases: StoredPhaseInfo[] = ['intake', 'triage', 'planning', 'done'].map(key => ({
  key,
  name: key,
  kind: 'working',
}));
const keys = (list: StoredPhaseInfo[]) => list.map(phase => phase.key);

describe('movePhase', () => {
  it('moves a phase to a new position', () => {
    expect(keys(movePhase(phases, 3, 1))).toEqual(['intake', 'done', 'triage', 'planning']);
    expect(keys(movePhase(phases, 1, 2))).toEqual(['intake', 'planning', 'triage', 'done']);
  });

  it('keeps the first phase first', () => {
    expect(keys(movePhase(phases, 0, 2))).toEqual(keys(phases));
    expect(keys(movePhase(phases, 2, 0))).toEqual(['intake', 'planning', 'triage', 'done']);
  });

  it('returns the same list when the move would not change the order', () => {
    expect(movePhase(phases, 1, 0)).toBe(phases);
    expect(movePhase(phases, 3, 4)).toBe(phases);
  });

  it('stops at the last position', () => {
    expect(keys(movePhase(phases, 1, 9))).toEqual(['intake', 'planning', 'done', 'triage']);
  });
});

describe('removing a phase', () => {
  const board: StoredPhaseInfo[] = [
    { key: 'backlog', name: 'Backlog', kind: 'resting', nextPhases: ['doing', 'done'] },
    { key: 'doing', name: 'Doing', kind: 'working', nextPhases: ['done'] },
    { key: 'done', name: 'Done', kind: 'terminal', nextPhases: [] },
  ];

  it('takes the phase out of every move other phases list', () => {
    expect(removePhase(board, 'done')).toEqual([
      { key: 'backlog', name: 'Backlog', kind: 'resting', nextPhases: ['doing'] },
      { key: 'doing', name: 'Doing', kind: 'working', nextPhases: [] },
    ]);
  });

  it('drops the outcomes that went to it, so the board still saves', () => {
    const building: StoredPhaseInfo = {
      key: 'doing',
      name: 'Doing',
      kind: 'working',
      nextPhases: ['review', 'done'],
      outcomes: [
        { key: 'review', label: 'Ready for review', to: 'review' },
        { key: 'done', label: 'Nothing to change', to: 'done' },
      ],
    };
    const [, doing] = removePhase(
      [board[0], building, { key: 'review', name: 'Review', kind: 'working' }, board[2]],
      'review',
    );
    expect(doing).toEqual({ ...building, nextPhases: ['done'], outcomes: [building.outcomes![1]] });
    const saved = storedBoardInputSchema.safeParse({
      key: 'flow',
      name: 'Flow',
      phases: [board[0], doing, board[2]],
    });
    expect(saved.success).toBe(true);
  });

  it("keeps a phase Factory's code handles, and a first phase whose successor can't take its place", () => {
    expect(canRemovePhase(board, 'doing', { doing: { requiredNextPhases: [] } })).toBe(false);
    expect(canRemovePhase(board, 'backlog', null)).toBe(false);
    expect(canRemovePhase(board, 'doing', null)).toBe(true);
    expect(canRemovePhase(board.slice(0, 1), 'backlog', null)).toBe(false);
  });
});

describe('withNextPhases', () => {
  it('drops the outcomes going to a phase the moves no longer list, and the list once it is empty', () => {
    const doing: StoredPhaseInfo = {
      key: 'doing',
      name: 'Doing',
      kind: 'working',
      nextPhases: ['review', 'done'],
      outcomes: [{ key: 'review', label: 'Ready for review', to: 'review' }],
    };
    expect(withNextPhases(doing, ['review'])).toEqual({ ...doing, nextPhases: ['review'] });
    expect(withNextPhases(doing, ['done'])).toEqual({ ...doing, nextPhases: ['done'], outcomes: null });
    // A phase without outcomes of its own reports one per next phase, so only its moves change.
    expect(withNextPhases({ ...doing, outcomes: undefined }, ['done'])).toEqual({
      ...doing,
      outcomes: undefined,
      nextPhases: ['done'],
    });
  });
});

describe('withKind', () => {
  const planning: StoredPhaseInfo = {
    key: 'planning',
    name: 'Planning',
    kind: 'working',
    runner: { skill: 'factory-plan', context: 'work' },
    exitTool: { id: 'submit_plan', autoApprove: true },
    tools: ['factory_review_source'],
    autoStart: true,
    nextPhases: ['done'],
  };

  it("drops what only a working phase has, and a terminal phase's moves", () => {
    expect(withKind(planning, 'terminal', [planning])).toEqual({
      key: 'planning',
      name: 'Planning',
      description: undefined,
      kind: 'terminal',
      nextPhases: [],
    });
  });

  it('gives a phase that becomes working a fresh runner', () => {
    const done: StoredPhaseInfo = { key: 'done', name: 'Done', kind: 'terminal', nextPhases: [] };
    expect(withKind(done, 'working', [done])).toMatchObject({ kind: 'working', runner: { context: 'work' } });
  });
});

describe('phaseHasProblem', () => {
  const phase: StoredPhaseInfo = { key: 'triage', name: 'Triage', kind: 'working', autoStart: true };
  const colour: CardRule = {
    operator: 'AND',
    conditions: [{ field: 'item.colour', operator: 'equals', value: 'red' }],
  };

  it('counts a drafted rule the server could not read', () => {
    expect(phaseHasProblem({ ...phase, autoStartWhen: colour })).toBe(true);
    expect(phaseHasProblem({ ...phase, autoStartWhen: null })).toBe(false);
  });

  it("ignores a rule whose switch is off, and a goal's run count the server accepts", () => {
    expect(phaseHasProblem({ ...phase, autoStart: false, autoStartWhen: colour })).toBe(false);
    expect(phaseHasProblem({ ...phase, runner: { goal: { objective: 'Fix it', maxRuns: 50 } } })).toBe(false);
    expect(phaseHasProblem({ ...phase, runner: { goal: { objective: 'Fix it', maxRuns: 51 } } })).toBe(true);
  });
});

describe('board keys', () => {
  it('derives a key the server accepts from a board name', () => {
    expect(keyFromName('Bug Triage')).toBe('bug-triage');
    expect(keyFromName('  --Émile’s board!  ')).toBe('mile-s-board');
    expect(keyFromName('release_2')).toBe('release_2');
    expect(keyFromName('!!!')).toBe('');
    const long = keyFromName(`${'a'.repeat(127)} b`);
    expect(long).toBe('a'.repeat(127));
    expect(keyProblem(long)).toBeUndefined();
  });

  it('says why a key would be refused', () => {
    expect(keyProblem('')).toBe('Enter a key.');
    expect(keyProblem('-bugs')).toMatch(/starting with a letter or digit/);
    expect(keyProblem('bug triage')).toMatch(/letters, digits/);
    expect(keyProblem('a'.repeat(129))).toBe('Use at most 128 characters.');
    expect(keyProblem('bugs', ['work', 'bugs'])).toBe('This key is already in use.');
    expect(keyProblem('Bugs_2-x')).toBeUndefined();
  });
});

describe('starterBoard', () => {
  it('is a board the server stores as it is', () => {
    const parsed = storedBoardInputSchema.safeParse({ ...starterBoard(), key: 'bugs', name: 'Bugs' });
    expect(parsed.error?.issues).toBeUndefined();
  });
});

describe('phase outcomes', () => {
  const board: StoredPhaseInfo[] = [
    { key: 'backlog', name: 'Backlog', kind: 'resting', nextPhases: ['doing'] },
    { key: 'doing', name: 'Doing', kind: 'working', runner: { context: 'work' } },
    { key: 'done', name: 'Done', kind: 'terminal', nextPhases: [] },
  ];
  const doing = board[1];

  it('offers one outcome per next phase when a phase lists none, as the server does', () => {
    expect(defaultOutcomes(doing, board)).toEqual([
      { key: 'backlog', label: 'Backlog', to: 'backlog' },
      { key: 'done', label: 'Done', to: 'done' },
    ]);
  });

  it('adds an outcome for a move no outcome takes yet, under a free key', () => {
    expect(newOutcome(doing, board, [{ key: 'backlog', label: 'Back', to: 'backlog' }])).toEqual({
      key: 'done',
      label: 'Done',
      to: 'done',
    });
    const both = defaultOutcomes(doing, board);
    expect(newOutcome(doing, board, both)).toEqual({ key: 'backlog-2', label: 'Backlog', to: 'backlog' });
  });

  it('keeps an added key within the identifier limit when its name is already at it', () => {
    const long = 'a'.repeat(128);
    const phases: StoredPhaseInfo[] = [
      { ...doing, nextPhases: ['done'] },
      { ...board[2], name: long },
    ];
    const added = newOutcome(phases[0], phases, [{ key: long, label: 'Done', to: 'done' }]);
    expect(added?.key).toBe(`${'a'.repeat(126)}-2`);
    expect(outcomeProblems([{ key: long, label: 'Done', to: 'done' }, added!])).toEqual([{}, {}]);
  });

  it("picks the outcome an exit tool's success reports as the server does", () => {
    const phases: StoredPhaseInfo[] = [
      ...board,
      { key: 'review', name: 'Review', kind: 'working', runner: { context: 'work' } },
      { key: 'fixing', name: 'Fixing', kind: 'working', runner: { context: 'work' } },
    ];
    const review = { key: 'review', label: 'Review', to: 'review' };
    const fixing = { key: 'fix', label: 'Fix', to: 'fixing' };
    const done = { key: 'done', label: 'Done', to: 'done' };
    expect(exitToolOutcome([done, { key: 'advance', label: 'Ship', to: 'done' }], phases)?.key).toBe('advance');
    expect(exitToolOutcome([done, review], phases)).toBe(review);
    expect(exitToolOutcome([done, review, fixing], phases)).toBeUndefined();
    expect(exitToolOutcome([done], phases)).toBeUndefined();
  });

  it('flags keys and labels the server would refuse, and holds the phase back', () => {
    const outcomes = [
      { key: 'ship', label: 'Shipped', to: 'done' },
      { key: 'ship', label: ' ', to: 'backlog' },
      { key: 'bad key', label: 'Back', to: 'backlog' },
    ];
    expect(outcomeProblems(outcomes)).toEqual([
      { key: 'This key is already in use.' },
      { key: 'This key is already in use.', label: 'Enter a label.' },
      { key: 'Use letters, digits, hyphens and underscores, starting with a letter or digit.' },
    ]);
    expect(phaseHasProblem({ ...doing, outcomes })).toBe(true);
    expect(phaseHasProblem({ ...doing, outcomes: outcomes.slice(0, 1) })).toBe(false);
  });

  it('drops an outcome going to a removed phase even when moves are unset', () => {
    const custom = { ...doing, outcomes: [{ key: 'ship', label: 'Shipped', to: 'done' }] };
    const [, kept] = removePhase([board[0], custom, board[2]], 'done');
    expect(kept).toEqual({ ...doing, outcomes: null });
  });
});
