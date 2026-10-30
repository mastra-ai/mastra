import { describe, expect, it } from 'vitest';

import type { RuleGroup } from '../rules/rule-group.js';
import { cardRuleFacts } from './card-facts.js';
import { defineBoard } from './define-board.js';
import { intakeHold, intakeTargetProblem, resolveIntakePlacement } from './intake-routing.js';
import { createBoardRegistry } from './registry.js';
import { createTestBoard } from './test-utils.js';

const registry = createBoardRegistry({ boards: [createTestBoard()], includeDefaultBoards: true });

const DOCS: RuleGroup = {
  operator: 'AND',
  conditions: [{ field: 'item.labels', operator: 'contains', value: 'docs' }],
};

function route(overrides: Partial<Parameters<typeof intakeHold>[0][number]> = {}) {
  return {
    enabled: true,
    when: null,
    target: { boardKey: 'work', phaseKey: 'triage' },
    hold: 'untrusted',
    ...overrides,
  } as const;
}

const issue = (labels: string[] = []) =>
  cardRuleFacts({
    title: 'Card',
    metadata: { labels },
    externalSource: { integrationId: 'github', type: 'issue', externalId: '1' },
  });

const pullRequest = cardRuleFacts({
  title: 'Patch',
  metadata: {},
  externalSource: { integrationId: 'github', type: 'pull-request', externalId: '2' },
});

/** A board whose first phase can't reach `fixing` directly: cards go through `triaged`. */
const stepwise = createBoardRegistry({
  boards: [
    defineBoard({
      id: 'stepwise',
      name: 'Stepwise',
      initialPhase: 'reported',
      phases: {
        reported: { name: 'Reported', kind: 'resting', nextPhases: ['triaged'] },
        triaged: { name: 'Triaged', kind: 'resting', nextPhases: ['fixing'] },
        fixing: { name: 'Fixing', kind: 'working', nextPhases: ['fixed'] },
        fixed: { name: 'Fixed', kind: 'terminal' },
      },
    }),
  ],
  includeDefaultBoards: false,
});

describe('resolveIntakePlacement', () => {
  it("lands a card in the first phase when the route's phase can't be reached from it", () => {
    const target = (phaseKey: string) => [route({ target: { boardKey: 'stepwise', phaseKey } })];
    expect(resolveIntakePlacement(target('triaged'), issue(), stepwise)).toEqual({
      board: 'stepwise',
      phase: 'triaged',
    });
    expect(resolveIntakePlacement(target('fixing'), issue(), stepwise)).toEqual({
      board: 'stepwise',
      phase: 'reported',
    });
    expect(intakeTargetProblem(stepwise, { boardKey: 'stepwise', phaseKey: 'fixing' })).toMatchObject({
      code: 'unreachable_phase',
    });
    expect(intakeTargetProblem(stepwise, { boardKey: 'stepwise', phaseKey: 'triaged' })).toBeUndefined();
  });

  it('places nothing without routes', () => {
    expect(resolveIntakePlacement([], issue(), registry)).toBeUndefined();
  });

  it('takes the first enabled route that matches and has a target', () => {
    const routes = [
      route({ enabled: false, target: { boardKey: 'release', phaseKey: 'shipping' } }),
      route({ when: DOCS, target: { boardKey: 'work', phaseKey: 'planning' } }),
      route({ target: null, hold: 'always' }),
      route({ target: { boardKey: 'release', phaseKey: null } }),
      route(),
    ];
    expect(resolveIntakePlacement(routes, issue(['docs']), registry)).toEqual({ board: 'work', phase: 'planning' });
    expect(resolveIntakePlacement(routes, issue(), registry)).toEqual({ board: 'release', phase: 'queued' });
  });

  it('skips a board that is not installed and lands a missing or terminal phase in the initial phase', () => {
    expect(
      resolveIntakePlacement([route({ target: { boardKey: 'gone', phaseKey: null } }), route()], issue(), registry),
    ).toEqual({ board: 'work', phase: 'triage' });
    expect(
      resolveIntakePlacement([route({ target: { boardKey: 'work', phaseKey: 'gone' } })], issue(), registry),
    ).toEqual({ board: 'work', phase: 'intake' });
    expect(
      resolveIntakePlacement([route({ target: { boardKey: 'work', phaseKey: 'done' } })], issue(), registry),
    ).toEqual({ board: 'work', phase: 'intake' });
  });

  it('keeps pull requests off the Work board and everything else off the Review board', () => {
    expect(resolveIntakePlacement([route()], pullRequest, registry)).toBeUndefined();
    expect(
      resolveIntakePlacement([route({ target: { boardKey: 'review', phaseKey: 'review' } })], issue(), registry),
    ).toBeUndefined();
    expect(
      resolveIntakePlacement([route({ target: { boardKey: 'review', phaseKey: 'review' } })], pullRequest, registry),
    ).toEqual({ board: 'review', phase: 'review' });
  });
});

describe('intakeHold', () => {
  it("is 'untrusted' without a matching route", () => {
    expect(intakeHold([], issue())).toBe('untrusted');
    expect(intakeHold([route({ when: DOCS, hold: 'never' })], issue())).toBe('untrusted');
  });

  it("is the first enabled matching route's hold, whether or not its target is usable", () => {
    const routes = [
      route({ enabled: false, hold: 'never' }),
      route({ when: DOCS, target: { boardKey: 'gone', phaseKey: null }, hold: 'always' }),
      route({ hold: 'never' }),
    ];
    expect(intakeHold(routes, issue(['docs']))).toBe('always');
    expect(intakeHold(routes, issue())).toBe('never');
  });
});
