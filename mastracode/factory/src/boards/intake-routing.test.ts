import { describe, expect, it } from 'vitest';

import type { RuleGroup } from '../rules/rule-group.js';
import { cardRuleFacts } from './card-facts.js';
import { defineBoard } from './define-board.js';
import { intakeTargetProblem, resolveIntakePlacement } from './intake-routing.js';
import { createBoardRegistry } from './registry.js';
import { createTestBoard } from './test-utils.js';

const registry = createBoardRegistry({ boards: [createTestBoard()], includeDefaultBoards: true });

const DOCS: RuleGroup = {
  operator: 'AND',
  conditions: [{ field: 'item.labels', operator: 'contains', value: 'docs' }],
};

function route(overrides: Partial<Parameters<typeof resolveIntakePlacement>[0][number]> = {}) {
  return {
    id: 'route',
    enabled: true,
    when: null,
    target: { boardKey: 'work', phaseKey: 'triage' },
    on: ['work_item.created'],
    ...overrides,
  } as Parameters<typeof resolveIntakePlacement>[0][number];
}

const placing = (target: { boardKey: string; phaseKey: string }) => ({ target, on: ['work_item.created'] });

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
      routeId: 'route',
    });
    expect(resolveIntakePlacement(target('fixing'), issue(), stepwise)).toEqual({
      board: 'stepwise',
      phase: 'reported',
      routeId: 'route',
    });
    expect(intakeTargetProblem(stepwise, placing({ boardKey: 'stepwise', phaseKey: 'fixing' }))).toMatchObject({
      code: 'unreachable_phase',
    });
    expect(intakeTargetProblem(stepwise, placing({ boardKey: 'stepwise', phaseKey: 'triaged' }))).toBeUndefined();
  });

  it('places nothing without routes', () => {
    expect(resolveIntakePlacement([], issue(), registry)).toBeUndefined();
  });

  it('takes the first enabled route that matches and whose board is installed', () => {
    const routes = [
      route({ id: 'disabled', enabled: false, target: { boardKey: 'release', phaseKey: 'shipping' } }),
      route({ id: 'docs', when: DOCS, target: { boardKey: 'work', phaseKey: 'planning' } }),
      route({ id: 'gone', target: { boardKey: 'gone', phaseKey: null } }),
      route({ id: 'release', target: { boardKey: 'release', phaseKey: null } }),
      route({ id: 'last' }),
    ];
    expect(resolveIntakePlacement(routes, issue(['docs']), registry)).toEqual({
      board: 'work',
      phase: 'planning',
      routeId: 'docs',
    });
    expect(resolveIntakePlacement(routes, issue(), registry)).toEqual({
      board: 'release',
      phase: 'queued',
      routeId: 'release',
    });
  });

  it('skips a board that is not installed and lands a missing or terminal phase in the initial phase', () => {
    expect(
      resolveIntakePlacement([route({ target: { boardKey: 'gone', phaseKey: null } }), route()], issue(), registry),
    ).toEqual({ board: 'work', phase: 'triage', routeId: 'route' });
    expect(
      resolveIntakePlacement([route({ target: { boardKey: 'work', phaseKey: 'gone' } })], issue(), registry),
    ).toEqual({ board: 'work', phase: 'intake', routeId: 'route' });
    expect(
      resolveIntakePlacement([route({ target: { boardKey: 'work', phaseKey: 'done' } })], issue(), registry),
    ).toEqual({ board: 'work', phase: 'intake', routeId: 'route' });
  });

  it('lands pull requests on Work only in Intake or PR review, keeps everything else out of PR review, and off the Review board', () => {
    const to = (boardKey: string, phaseKey: string) => [route({ target: { boardKey, phaseKey } })];
    expect(resolveIntakePlacement(to('work', 'pr-review'), pullRequest, registry)).toEqual({
      board: 'work',
      phase: 'pr-review',
      routeId: 'route',
    });
    expect(resolveIntakePlacement(to('work', 'intake'), pullRequest, registry)).toEqual({
      board: 'work',
      phase: 'intake',
      routeId: 'route',
    });
    // A pull request card never enters the builder's lanes, so the next route places it.
    expect(
      resolveIntakePlacement(
        [route({ id: 'triage' }), route({ id: 'next', target: { boardKey: 'work', phaseKey: 'pr-review' } })],
        pullRequest,
        registry,
      ),
    ).toEqual({ board: 'work', phase: 'pr-review', routeId: 'next' });
    expect(resolveIntakePlacement(to('work', 'pr-review'), issue(), registry)).toBeUndefined();
    expect(resolveIntakePlacement(to('review', 'review'), issue(), registry)).toBeUndefined();
    expect(resolveIntakePlacement(to('review', 'review'), pullRequest, registry)).toEqual({
      board: 'review',
      phase: 'review',
      routeId: 'route',
    });
  });

  it('places new cards only by routes that handle work_item.created', () => {
    const reopened = route({
      id: 'reopened',
      on: ['work_item.reopened'],
      target: { boardKey: 'work', phaseKey: 'intake' },
    });
    const both = route({ id: 'both', on: ['work_item.reopened', 'work_item.created'] });
    expect(resolveIntakePlacement([reopened], issue(), registry)).toBeUndefined();
    expect(resolveIntakePlacement([reopened, both], issue(), registry)).toEqual({
      board: 'work',
      phase: 'triage',
      routeId: 'both',
    });
  });
});

describe('intakeTargetProblem', () => {
  it('lets a route that only moves existing cards name a terminal or unreachable phase', () => {
    const closes = (boardKey: string, phaseKey: string) => ({
      target: { boardKey, phaseKey },
      on: ['work_item.closed'],
    });
    expect(intakeTargetProblem(registry, closes('work', 'done'))).toBeUndefined();
    expect(intakeTargetProblem(stepwise, closes('stepwise', 'fixing'))).toBeUndefined();
    expect(intakeTargetProblem(registry, placing({ boardKey: 'work', phaseKey: 'done' }))).toMatchObject({
      code: 'terminal_phase',
    });
    // The board and phase must still exist.
    expect(intakeTargetProblem(registry, closes('work', 'gone'))).toMatchObject({ code: 'unknown_phase' });
    expect(intakeTargetProblem(registry, closes('gone', 'done'))).toMatchObject({ code: 'unknown_board' });
  });
});
