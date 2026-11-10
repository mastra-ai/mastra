import { storedBoardInputSchema } from '@mastra/factory/boards/stored-board';
import { describe, expect, it } from 'vitest';

import type { StoredPhaseInfo } from '../../../../api/types';
import {
  canRemovePhase,
  keyFromName,
  keyProblem,
  movePhase,
  phaseHasProblem,
  removePhase,
  starterBoard,
  withKind,
} from '../boardDraft';

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

  it("keeps a phase Factory's code handles, and a first phase whose successor can't take its place", () => {
    expect(canRemovePhase(board, 'doing', { doing: { requiredNextPhases: [] } })).toBe(false);
    expect(canRemovePhase(board, 'backlog', null)).toBe(false);
    expect(canRemovePhase(board, 'doing', null)).toBe(true);
    expect(canRemovePhase(board.slice(0, 1), 'backlog', null)).toBe(false);
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

  it('counts JSON typed for a rule that the server could not read', () => {
    expect(phaseHasProblem(phase, { 'triage.autoStartWhen': '{"all": [' })).toBe(true);
    expect(phaseHasProblem(phase, { 'triage.autoStartWhen': '' })).toBe(false);
  });

  it("ignores a rule whose switch is off, and a goal's run count the server accepts", () => {
    expect(phaseHasProblem({ ...phase, autoStart: false }, { 'triage.autoStartWhen': '{' })).toBe(false);
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
