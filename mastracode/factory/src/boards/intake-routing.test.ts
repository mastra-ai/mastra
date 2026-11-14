import { describe, expect, it } from 'vitest';

import type { RuleGroup } from '../rules/rule-group.js';
import type { Card } from '../storage/domains/work-items/base.js';
import { cardRuleFacts } from './card-facts.js';
import { defineBoard } from './define-board.js';
import {
  compareIntakeOrder,
  INTAKE_ORDER_SAMPLE,
  intakeEvaluatorFrom,
  intakeTargetProblem,
  resolveIntake,
  resolveIntakePlacement,
  traceIntakeOrder,
} from './intake-routing.js';
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

describe('compareIntakeOrder', () => {
  const twoBoards = boardRegistryOf([simpleBoard('work'), simpleBoard('ship')]);
  const labelled = (id: string, boardKey: string, label: string) =>
    route({
      id,
      target: { boardKey, phaseKey: null },
      when: { operator: 'AND', conditions: [{ field: 'item.labels', operator: 'contains', value: label }] },
    });
  const everything = (id: string, boardKey: string) => route({ id, target: { boardKey, phaseKey: null } });
  /** The facts intake reads of a card: its title, labels and source. */
  const card = (labels: string[]) =>
    ({
      title: 'Card',
      metadata: { labels },
      externalSource: { integrationId: 'github', type: 'issue', externalId: '1' },
    }) as unknown as Card;
  const compare = (routes: ReturnType<typeof route>[], order: string[], cards: Card[]) =>
    compareIntakeOrder({ routes, order, registry: twoBoards, cards });

  it('finds no difference where each board’s rules sit together', () => {
    const routes = [labelled('ship', 'ship', 'ship'), labelled('bug', 'work', 'bug'), everything('all', 'work')];
    expect(compare(routes, ['ship', 'work'], [card(['ship']), card(['bug']), card([])])).toEqual({
      compared: 3,
      differing: 0,
      notRouted: 0,
    });
  });

  it('counts the cards the order would place elsewhere, and those no board takes', () => {
    // Work is asked first, and its catch-all takes the `ship` cards the old list sent to Ship.
    const interleaved = [labelled('bug', 'work', 'bug'), labelled('ship', 'ship', 'ship'), everything('all', 'work')];
    const cards = [card(['ship']), card(['ship', 'x']), card(['bug']), card([])];
    expect(compare(interleaved, ['work', 'ship'], cards)).toEqual({ compared: 4, differing: 2, notRouted: 0 });
    // The same rules with Ship asked first route as before.
    expect(compare(interleaved, ['ship', 'work'], cards)).toMatchObject({ differing: 0 });
    // The old list filed unmatched cards on Work; now no board takes them.
    expect(
      compare([labelled('ship', 'ship', 'ship')], ['ship', 'work'], [card(['ship']), card(['docs']), card([])]),
    ).toEqual({
      compared: 3,
      differing: 2,
      notRouted: 2,
    });
  });

  it('compares only the newest cards', () => {
    const cards = Array.from({ length: INTAKE_ORDER_SAMPLE + 50 }, () => card([]));
    expect(compare([everything('all', 'work')], ['work', 'ship'], cards)).toMatchObject({
      compared: INTAKE_ORDER_SAMPLE,
    });
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

describe('traceIntakeOrder', () => {
  const twoBoards = boardRegistryOf([simpleBoard('work', 'Work'), simpleBoard('ship', 'Ship')]);
  const labelled = (id: string, boardKey: string, label: string) =>
    route({
      id,
      name: `Labelled ${label}`,
      target: { boardKey, phaseKey: null },
      when: { operator: 'AND', conditions: [{ field: 'item.labels', operator: 'contains', value: label }] },
    });
  const everything = (id: string, boardKey: string) =>
    route({ id, name: 'Everything else', target: { boardKey, phaseKey: null } });
  const routes = [
    labelled('ship-bug', 'ship', 'ship'),
    { ...everything('ship-off', 'ship'), enabled: false },
    labelled('work-bug', 'work', 'bug'),
    everything('work-all', 'work'),
    route({ id: 'work-closed', on: ['work_item.closed'], target: { boardKey: 'work', phaseKey: null } }),
  ];

  it('names, board by board and rule by rule, what each rule answered and why', () => {
    const trace = traceIntakeOrder(
      { routes, order: ['ship', 'work'], facts: issue(['bug']), registry: twoBoards },
      { full: true },
    );
    expect(trace.resolution).toEqual({ outcome: 'placed', board: 'work', phase: 'inbox', routeId: 'work-bug' });
    expect(trace.boards).toEqual([
      {
        boardKey: 'ship',
        name: 'Ship',
        rules: [
          {
            routeId: 'ship-bug',
            name: 'Labelled ship',
            phase: 'inbox',
            outcome: 'no_match',
            failed: [{ field: 'item.labels', operator: 'contains', value: 'ship', actual: ['bug'] }],
          },
          { routeId: 'ship-off', name: 'Everything else', phase: 'inbox', outcome: 'disabled' },
        ],
      },
      {
        boardKey: 'work',
        name: 'Work',
        rules: [
          { routeId: 'work-bug', name: 'Labelled bug', phase: 'inbox', outcome: 'took' },
          {
            routeId: 'work-all',
            name: 'Everything else',
            phase: 'inbox',
            outcome: 'lost',
            to: { boardKey: 'work', routeId: 'work-bug' },
          },
        ],
      },
    ]);
  });

  it('shows a matching rule whose phase can’t hold the item', () => {
    const review = route({ id: 'review', target: { boardKey: 'work', phaseKey: 'pr-review' } });
    const trace = traceIntakeOrder({ routes: [review], order: [], facts: issue(), registry }, { full: true });
    expect(trace.resolution.outcome).toBe('not_routed');
    expect(trace.boards.flatMap(board => board.rules)).toEqual([
      { routeId: 'review', name: null, phase: 'pr-review', outcome: 'phase_refuses' },
    ]);
  });

  it('stops at the winner when filing, and decides exactly as filing does either way', () => {
    const factSets = [issue(['ship']), issue(['bug']), issue(['ship', 'bug']), issue([]), pullRequest];
    for (const order of [
      ['ship', 'work'],
      ['work', 'ship'],
    ]) {
      for (const facts of factSets) {
        for (const set of [routes, routes.slice(0, 3), []]) {
          const query = { routes: set, order, facts, registry: twoBoards };
          const filed = resolveIntake({ ...query, evaluator: 'intake-order' });
          expect(traceIntakeOrder(query).resolution).toEqual(filed);
          expect(traceIntakeOrder(query, { full: true }).resolution).toEqual(filed);
        }
      }
    }
    const short = traceIntakeOrder({ routes, order: ['ship', 'work'], facts: issue(['ship']), registry: twoBoards });
    expect(short.boards).toHaveLength(1);
    expect(short.boards[0]!.rules.at(-1)).toMatchObject({ routeId: 'ship-bug', outcome: 'took' });
  });
});
