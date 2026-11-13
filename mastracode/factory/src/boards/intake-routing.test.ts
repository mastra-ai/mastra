import { describe, expect, it } from 'vitest';

import type { RuleGroup } from '../rules/rule-group.js';
import { cardRuleFacts } from './card-facts.js';
import { defineBoard } from './define-board.js';
import { intakeEvaluatorFrom, intakeTargetProblem, resolveIntake, resolveIntakePlacement } from './intake-routing.js';
import { boardRegistryOf, createBoardRegistry } from './registry.js';
import { createTestBoard, createTriageWorkRegistry } from './test-utils.js';

// Work with Triage, as projects stored before new projects' Work dropped it: routes here target Triage.
const registry = createTriageWorkRegistry(createTestBoard());

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
const stepwise = boardRegistryOf([
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
]);

const simpleBoard = (id: string, name = id.toUpperCase()) =>
  defineBoard({
    id,
    name,
    initialPhase: 'inbox',
    phases: {
      inbox: { name: 'Inbox', kind: 'resting' },
      done: { name: 'Done', kind: 'terminal' },
    },
  });

describe('resolveIntake', () => {
  const twoBoards = boardRegistryOf([simpleBoard('work'), simpleBoard('ship')]);
  const labelled = (id: string, boardKey: string, label: string) =>
    route({
      id,
      target: { boardKey, phaseKey: null },
      when: { operator: 'AND', conditions: [{ field: 'item.labels', operator: 'contains', value: label }] },
    });
  const everything = (id: string, boardKey: string) => route({ id, target: { boardKey, phaseKey: null } });
  const both = (routes: ReturnType<typeof route>[], order: string[], facts: ReturnType<typeof issue>) =>
    (['route-list', 'intake-order'] as const).map(evaluator =>
      resolveIntake({ evaluator, routes, order, facts, registry: twoBoards }),
    );

  it('places contiguous route lists exactly as the old evaluator did', () => {
    const routes = [labelled('ship', 'ship', 'ship'), labelled('bug', 'work', 'bug'), everything('all', 'work')];
    const order = ['ship', 'work'];
    for (const labels of [['ship'], ['bug'], ['ship', 'bug'], []]) {
      const [old, next] = both(routes, order, issue(labels));
      expect(next).toEqual(old);
    }
  });

  it('checks boards in intake order, so an interleaved list lands differently', () => {
    // Work route, Ship route, Work catch-all: the old list sends `ship` to Ship; Work goes first now.
    const routes = [labelled('bug', 'work', 'bug'), labelled('ship', 'ship', 'ship'), everything('all', 'work')];
    const [old, next] = both(routes, ['work', 'ship'], issue(['ship']));
    expect(old).toMatchObject({ outcome: 'placed', board: 'ship', routeId: 'ship' });
    expect(next).toMatchObject({ outcome: 'placed', board: 'work', routeId: 'all' });
  });

  it('leaves an arrival no board takes Not routed, where the old evaluator fell back to Work', () => {
    const routes = [labelled('ship', 'ship', 'ship')];
    const [old, next] = both(routes, ['ship', 'work'], issue(['docs']));
    expect(old).toEqual({ outcome: 'placed', board: 'work', phase: 'inbox', routeId: null });
    expect(next).toEqual({ outcome: 'not_routed', reason: "No board's intake rules match it (checked SHIP, WORK)." });
  });

  it('names no fallback board: without a `work` board, nothing matching is still Not routed', () => {
    const renamed = boardRegistryOf([simpleBoard('platform', 'Work'), simpleBoard('ship')]);
    const resolution = resolveIntake({
      evaluator: 'intake-order',
      routes: [labelled('ship', 'ship', 'ship')],
      order: ['platform', 'ship'],
      facts: issue(['docs']),
      registry: renamed,
    });
    expect(resolution).toMatchObject({ outcome: 'not_routed' });
  });

  it('places only with a board’s own rules, skips join and disabled rules, and boards not installed', () => {
    const routes = [
      route({ id: 'join', target: { boardKey: 'ship', phaseKey: null, joinClosedIssue: true } }),
      { ...everything('off', 'ship'), enabled: false },
      everything('gone', 'docs'),
      everything('all', 'work'),
    ];
    const resolution = resolveIntake({
      evaluator: 'intake-order',
      routes,
      order: ['docs', 'ship', 'work'],
      facts: pullRequest,
      registry: twoBoards,
    });
    expect(resolution).toMatchObject({ outcome: 'placed', board: 'work', routeId: 'all' });
  });

  it('reads the evaluator from the option first, then FACTORY_INTAKE_EVALUATOR, defaulting to the old one', () => {
    expect(intakeEvaluatorFrom(undefined, {})).toBe('route-list');
    expect(intakeEvaluatorFrom(undefined, { FACTORY_INTAKE_EVALUATOR: 'intake-order' })).toBe('intake-order');
    expect(intakeEvaluatorFrom(undefined, { FACTORY_INTAKE_EVALUATOR: 'nonsense' })).toBe('route-list');
    expect(intakeEvaluatorFrom('route-list', { FACTORY_INTAKE_EVALUATOR: 'intake-order' })).toBe('route-list');
  });
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

  it('lands pull requests on Work only in Intake or PR review, keeps everything else out of PR review, and never on the retired Review board', () => {
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
    // A route a user pointed at the retired Review board no longer matches anything.
    expect(resolveIntakePlacement(to('review', 'review'), issue(), registry)).toBeUndefined();
    expect(resolveIntakePlacement(to('review', 'review'), pullRequest, registry)).toBeUndefined();
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
