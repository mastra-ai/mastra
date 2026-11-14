import { evaluateRuleGroup, explainRuleGroup } from '../rules/rule-group.js';
import type { FailedRuleCondition, RuleFacts } from '../rules/rule-group.js';
import { externalSourceForWorkItem } from '../rules/types.js';
import type { FactoryCommitDecision } from '../rules/types.js';
import type { IntakeEvaluator, StoredBoardsStorage, StoredIntakeRouteRecord } from '../storage/domains/boards/base.js';
import type { Card } from '../storage/domains/work-items/base.js';
import type { BoardEventFacts } from './board-events.js';
import { cardRuleFacts } from './card-facts.js';
import { deriveIntakeOrder, reconcileIntakeOrder } from './intake-order.js';
import type { BoardRegistry, InstalledBoard } from './registry.js';
import { boardFlow, boardForWorkItem, hasPullRequest, intakeTarget, isTerminalWorkItem } from './semantics.js';

/** Reads a project's intake routes and intake order, and logs how intake decided each arrival. */
export type IntakeRoutesReader = Pick<
  StoredBoardsStorage,
  'listIntakeRoutes' | 'readIntakeOrder' | 'recordIntakeDecision' | 'resolveNotRouted'
>;

type IntakeRoute = Pick<StoredIntakeRouteRecord, 'id' | 'enabled' | 'when' | 'target' | 'on'> &
  Partial<Pick<StoredIntakeRouteRecord, 'name'>>;

/** Whether the route places new cards, rather than only moving existing ones on later events. */
export function placesNewCards(route: Pick<StoredIntakeRouteRecord, 'on'>): boolean {
  return route.on.includes('work_item.created');
}

/**
 * Card metadata naming the intake route that placed the card. Label changes, rebinding its
 * source and replayed arrivals leave such a card where the route put it.
 */
export const INTAKE_ROUTE_METADATA_KEY = 'intakeRouteId';

/** Whether an intake route chose this card's board when it arrived. */
export function placedByIntakeRoute(item: Pick<Card, 'metadata'>): boolean {
  return typeof item.metadata?.[INTAKE_ROUTE_METADATA_KEY] === 'string';
}

export type IntakeTargetProblem = {
  code: 'unknown_board' | 'unknown_phase' | 'terminal_phase' | 'unreachable_phase' | 'join_on_event';
  message: string;
};

/**
 * Why a route's target can't take cards in this project, or undefined when it can. A route that
 * places new cards needs a phase they can reach; one that only moves existing cards on later
 * events, such as a close, may name any phase, terminal ones included.
 */
export function intakeTargetProblem(
  registry: BoardRegistry,
  route: { target: { boardKey: string; phaseKey?: string | null; joinClosedIssue?: boolean }; on: readonly string[] },
): IntakeTargetProblem | undefined {
  const { target } = route;
  const board = registry.get(target.boardKey);
  if (!board) {
    return { code: 'unknown_board', message: `Board "${target.boardKey}" is not installed in this project.` };
  }
  if (target.joinClosedIssue && route.on.some(event => event !== 'work_item.created')) {
    return {
      code: 'join_on_event',
      message:
        'A route that joins a pull request to the card of the issue it closes handles only arrivals: its `on` must be `work_item.created` alone.',
    };
  }
  if (!target.phaseKey) return undefined;
  if (target.joinClosedIssue && board.phaseKind(target.phaseKey) === 'terminal') {
    return {
      code: 'terminal_phase',
      message: `Phase "${target.phaseKey}" on board "${target.boardKey}" is terminal; a card a pull request joins can't move there.`,
    };
  }
  if (target.joinClosedIssue) {
    return board.phaseKind(target.phaseKey)
      ? undefined
      : { code: 'unknown_phase', message: `Board "${target.boardKey}" has no phase "${target.phaseKey}".` };
  }
  const kind = board.phaseKind(target.phaseKey);
  if (!kind) {
    return { code: 'unknown_phase', message: `Board "${target.boardKey}" has no phase "${target.phaseKey}".` };
  }
  if (!route.on.includes('work_item.created')) return undefined;
  if (kind === 'terminal') {
    return {
      code: 'terminal_phase',
      message: `Phase "${target.phaseKey}" on board "${target.boardKey}" is terminal; new cards can't land there.`,
    };
  }
  if (!board.allowsTransition(board.initialPhase, target.phaseKey)) {
    return {
      code: 'unreachable_phase',
      message: `Board "${target.boardKey}" doesn't allow moving a card from its first phase "${board.initialPhase}" to "${target.phaseKey}".`,
    };
  }
  return undefined;
}

/**
 * On a board that reviews pull requests a pull request card works only in the pull request review
 * phase (it may also rest or finish), and nothing else lands in that review: a card arriving here
 * carries no attached pull request yet, and an existing issue card enters it only with one on it.
 * `FactoryTransitionService` refuses any move that breaks this, so a route can't either.
 */
function placementTakesCard(
  board: InstalledBoard,
  phase: string,
  facts: RuleFacts,
  carriesPullRequest = false,
): boolean {
  const flow = boardFlow(board);
  const review = flow.pullRequestReview;
  if (!review) return true;
  if (facts['source.kind'] !== 'pull_request') {
    // A board that reviews pull requests but builds nothing (the retired Review board) holds only them.
    if (flow.build === undefined) return false;
    return phase !== review || carriesPullRequest;
  }
  return phase === review || board.phaseKind(phase) !== 'working';
}

/**
 * What an intake route can test about the issue a pull request closes: whether there is one with
 * a card, that card's phase, and whether a pull request already sits on it. `closedIssue` is the
 * card the provider rules found, read fresh; undefined when the pull request closes none.
 */
export function closedIssueRuleFacts(closedIssue: Pick<Card, 'stages' | 'workItem'> | undefined): RuleFacts {
  if (!closedIssue) return { 'pullRequest.closesIssue': false };
  return {
    'pullRequest.closesIssue': true,
    ...(closedIssue.stages.length === 1 ? { 'closedIssue.phase': closedIssue.stages[0] } : {}),
    'closedIssue.hasPullRequest': hasPullRequest(closedIssue),
  };
}

export type IntakeRouteResolution =
  | { type: 'place'; board: string; phase: string; routeId: string }
  | { type: 'join'; phase: string | null; routeId: string };

/**
 * What happens to an arrival: the first enabled route that places new cards, whose condition matches it and whose
 * target can take it. A placing route lands a new card on an installed board; one without a
 * phase, or whose phase has since gone, lands it in the board's initial phase. A joining route
 * matches only a pull request whose closed issue's card (`closedIssue`) is on the route's board;
 * the pull request joins that card, which moves to the route's phase when set. Undefined leaves
 * today's placement alone.
 */
export function resolveIntakeRoute(
  routes: readonly IntakeRoute[],
  facts: RuleFacts,
  registry: BoardRegistry,
  closedIssue?: Pick<Card, 'board'>,
): IntakeRouteResolution | undefined {
  for (const route of routes) {
    if (!route.enabled || !placesNewCards(route) || !evaluateRuleGroup(route.when, facts)) continue;
    const board = registry.get(route.target.boardKey);
    if (!board) continue;
    if (route.target.joinClosedIssue) {
      if (facts['source.kind'] !== 'pull_request' || !closedIssue || boardForWorkItem(closedIssue) !== board.id)
        continue;
      const phase = route.target.phaseKey;
      return {
        type: 'join',
        phase: phase && board.phaseKind(phase) && !board.isTerminal(phase) ? phase : null,
        routeId: route.id,
      };
    }
    const phase = landingPhase(board, route.target.phaseKey);
    if (!placementTakesCard(board, phase, facts)) continue;
    return { type: 'place', board: board.id, phase, routeId: route.id };
  }
  return undefined;
}

/** Where a new card lands, by {@link resolveIntakeRoute}, for an arrival no route can join to a card. */
export function resolveIntakePlacement(
  routes: readonly IntakeRoute[],
  facts: RuleFacts,
  registry: BoardRegistry,
): { board: string; phase: string; routeId: string } | undefined {
  const resolution = resolveIntakeRoute(routes, facts, registry);
  return resolution?.type === 'place'
    ? { board: resolution.board, phase: resolution.phase, routeId: resolution.routeId }
    : undefined;
}

/** Where intake sends an arrival: placed on a board, or Not routed with the reason. */
export type IntakeResolution =
  | { outcome: 'placed'; board: string; phase: string; routeId: string | null }
  | { outcome: 'not_routed'; reason: string };

export interface IntakeQuery {
  evaluator: IntakeEvaluator;
  routes: readonly IntakeRoute[];
  /** Board keys in intake order; only the `intake-order` evaluator reads it. */
  order: readonly string[];
  facts: RuleFacts;
  registry: BoardRegistry;
}

/**
 * What intake rules test of an arrival: its own facts and, for a pull request closing an issue, that
 * issue's card as it is now (a finished card or one of another project counts as none). The
 * dispatcher and Route again both read an arrival through this, so they decide alike.
 */
export async function arrivalRuleFacts(
  decision: Extract<FactoryCommitDecision, { type: 'upsertLinkedWorkItem' }>,
  context: { factoryProjectId: string; registry: BoardRegistry; card(id: string): Promise<Card | null> },
): Promise<RuleFacts> {
  const facts = cardRuleFacts({
    title: decision.title,
    metadata: decision.metadata ?? {},
    externalSource: externalSourceForWorkItem(decision.source, decision.sourceKey, decision.url ?? undefined),
  });
  if (!decision.closesIssue) return facts;
  const closed = await context.card(decision.closesIssue.workItemId);
  const open =
    closed && closed.factoryProjectId === context.factoryProjectId && !isTerminalWorkItem(context.registry, closed)
      ? closed
      : undefined;
  return { ...facts, ...closedIssueRuleFacts(open) };
}

/**
 * Prefixes the decision an admin's Route again commits. Such an arrival is resolved by intake order
 * whatever this replica's evaluator: only that evaluator leaves an item Not routed.
 */
export const ROUTE_AGAIN_KEY_PREFIX = 'intake-route-again:';

/** The env var naming the evaluator when the Factory's `intake.evaluator` option doesn't. */
export const INTAKE_EVALUATOR_ENV = 'FACTORY_INTAKE_EVALUATOR';

/**
 * The evaluator this process uses: the configured one, else `FACTORY_INTAKE_EVALUATOR`, else the
 * old `route-list`. Every replica must run one that knows `intake-order` before it is switched on.
 */
export function intakeEvaluatorFrom(
  configured: IntakeEvaluator | undefined,
  env: Record<string, string | undefined> = process.env,
): IntakeEvaluator {
  if (configured) return configured;
  return env[INTAKE_EVALUATOR_ENV] === 'intake-order' ? 'intake-order' : 'route-list';
}

/** Where intake sends an arrival, by the evaluator `query` names. Join routes never place here. */
export function resolveIntake(query: IntakeQuery): IntakeResolution {
  return query.evaluator === 'intake-order' ? resolveByIntakeOrder(query) : resolveByRouteList(query);
}

/** How many of a project's newest cards {@link compareIntakeOrder} reads. */
export const INTAKE_ORDER_SAMPLE = 200;

export interface IntakeOrderComparison {
  /** Cards compared: the project's newest, at most {@link INTAKE_ORDER_SAMPLE}. */
  compared: number;
  /** Of those, how many the intake order would place on another board than the route list does. */
  differing: number;
  /** Of those, how many no board's rules take under the intake order. */
  notRouted: number;
}

/**
 * Runs both evaluators over `cards` (newest first) as if each arrived now, so an admin sees what
 * switching to `order` changes before switching.
 */
export function compareIntakeOrder(
  query: Pick<IntakeQuery, 'routes' | 'order' | 'registry'> & { cards: readonly Card[] },
): IntakeOrderComparison {
  const sample = query.cards.slice(0, INTAKE_ORDER_SAMPLE);
  let differing = 0;
  let notRouted = 0;
  for (const card of sample) {
    const base = { routes: query.routes, order: query.order, registry: query.registry, facts: cardRuleFacts(card) };
    const old = resolveIntake({ ...base, evaluator: 'route-list' });
    const next = resolveIntake({ ...base, evaluator: 'intake-order' });
    if (next.outcome === 'not_routed') notRouted += 1;
    if (placedOn(old) !== placedOn(next)) differing += 1;
  }
  return { compared: sample.length, differing, notRouted };
}

function placedOn(resolution: IntakeResolution): string | null {
  return resolution.outcome === 'placed' ? resolution.board : null;
}

/** How one intake rule answered an item, in the order intake asked it. */
export type IntakeRuleVerdict =
  /** It took the item: the first enabled rule, in intake order, that matched and whose phase takes it. */
  | { outcome: 'took' }
  /** It matched and its phase takes the item, but a rule asked earlier took it first. */
  | { outcome: 'lost'; to: { boardKey: string; routeId: string } }
  /** Its condition failed; `failed` names the conditions it failed on. */
  | { outcome: 'no_match'; failed: FailedRuleCondition[] }
  /** It matched, but its phase can't hold this kind of item (such as an issue in a pull request review phase). */
  | { outcome: 'phase_refuses' }
  /** It is switched off. */
  | { outcome: 'disabled' };

export type IntakeRuleTrace = IntakeRuleVerdict & {
  routeId: string;
  name: string | null;
  /** The phase the item would land in from this rule. */
  phase: string;
};

export interface IntakeBoardTrace {
  boardKey: string;
  name: string;
  /** The board's rules that place new items, top to bottom. */
  rules: IntakeRuleTrace[];
}

export interface IntakeTrace {
  resolution: IntakeResolution;
  /** Boards in the order intake asked them; with `full`, every board, even after one took the item. */
  boards: IntakeBoardTrace[];
}

/**
 * Asks boards in intake order, and inside each board its own rules top to bottom: the first
 * enabled placing rule that matches and whose phase can take the card decides. Nothing names a
 * board to fall back to; an arrival no board takes is Not routed. Filing stops at the winner;
 * `full` keeps asking every rule after it, so the dry run and tester can show which rules
 * matched but lost. Both read the same verdicts, so what they show is what filing does.
 */
export function traceIntakeOrder(
  { routes, order, facts, registry }: Omit<IntakeQuery, 'evaluator'>,
  options: { full?: boolean } = {},
): IntakeTrace {
  const boards: IntakeBoardTrace[] = [];
  let resolution: Extract<IntakeResolution, { outcome: 'placed' }> | undefined;
  let winner: { boardKey: string; routeId: string } | undefined;
  // A code board isn't stored, so the stored order can lack it; it slots in as a new board does.
  const boardKeys = [...registry.keys()];
  const stored = order.length > 0 ? order : deriveIntakeOrder(routes, boardKeys);
  for (const boardKey of reconcileIntakeOrder(stored, boardKeys, routes)) {
    const board = registry.get(boardKey);
    if (!board) continue;
    const trace: IntakeBoardTrace = { boardKey: board.id, name: board.name, rules: [] };
    boards.push(trace);
    for (const route of routes) {
      if (route.target.boardKey !== boardKey || route.target.joinClosedIssue || !placesNewCards(route)) continue;
      const phase = landingPhase(board, route.target.phaseKey);
      const rule = { routeId: route.id, name: route.name ?? null, phase };
      if (!route.enabled) {
        trace.rules.push({ ...rule, outcome: 'disabled' });
        continue;
      }
      const explained = explainRuleGroup(route.when, facts);
      if (!explained.matched) {
        trace.rules.push({ ...rule, outcome: 'no_match', failed: explained.failed });
        continue;
      }
      if (!placementTakesCard(board, phase, facts)) {
        trace.rules.push({ ...rule, outcome: 'phase_refuses' });
        continue;
      }
      if (winner) {
        trace.rules.push({ ...rule, outcome: 'lost', to: winner });
        continue;
      }
      trace.rules.push({ ...rule, outcome: 'took' });
      winner = { boardKey: board.id, routeId: route.id };
      resolution = { outcome: 'placed', board: board.id, phase, routeId: route.id };
      if (!options.full) return { resolution, boards };
    }
  }
  if (resolution) return { resolution, boards };
  const checked = boards.map(board => board.name);
  return {
    resolution: {
      outcome: 'not_routed',
      reason:
        checked.length > 0
          ? `No board's intake rules match it (checked ${checked.join(', ')}).`
          : 'The project has no board to take it.',
    },
    boards,
  };
}

function resolveByIntakeOrder(query: IntakeQuery): IntakeResolution {
  return traceIntakeOrder(query).resolution;
}

/**
 * The old evaluator, kept behind the flag until every replica runs the new one: the first
 * matching route of the whole list, else the default board's first phase, else the first board.
 * The only place intake still names a default board; delete it with the flag.
 */
function resolveByRouteList({ routes, facts, registry }: IntakeQuery): IntakeResolution {
  const placement = resolveIntakePlacement(routes, facts, registry);
  if (placement) return { outcome: 'placed', ...placement };
  const fallback = intakeTarget(registry);
  return fallback
    ? { outcome: 'placed', board: fallback.board, phase: fallback.initialPhase, routeId: null }
    : { outcome: 'not_routed', reason: 'The project has no board to take it.' };
}

/** The phase a route's card lands in: its named phase when new cards can reach it, else the board's first. */
export function landingPhase(board: InstalledBoard, phase: string | null | undefined): string {
  const usable =
    phase &&
    board.phaseKind(phase) !== undefined &&
    !board.isTerminal(phase) &&
    board.allowsTransition(board.initialPhase, phase);
  return usable ? phase : board.initialPhase;
}

/** Whether any route on the board, enabled or not, handles the event: then the routes own it. */
export function routesHandleEvent(
  routes: readonly Pick<IntakeRoute, 'on' | 'target'>[],
  event: BoardEventFacts,
  board: Pick<InstalledBoard, 'id'>,
): boolean {
  return routes.some(route => route.target.boardKey === board.id && route.on.includes(event.type));
}

/**
 * Where a status event moves an existing card: the first enabled route whose `on` names the
 * event, whose `when` matches the card and the event, and whose board is the card's own and can
 * hold it there. A route without a phase moves the card to its board's first phase. Undefined
 * leaves the card where it is.
 */
export function resolveEventRoute(
  routes: readonly IntakeRoute[],
  event: BoardEventFacts,
  cardFacts: RuleFacts,
  board: InstalledBoard,
  carriesPullRequest = false,
): { phase: string; routeId: string } | undefined {
  const facts: RuleFacts = {
    ...cardFacts,
    'event.type': event.type,
    ...(event.reason ? { 'event.reason': event.reason } : {}),
  };
  for (const route of routes) {
    if (!route.enabled || !route.on.includes(event.type) || route.target.boardKey !== board.id) continue;
    if (!evaluateRuleGroup(route.when, facts)) continue;
    const phase = route.target.phaseKey ?? board.initialPhase;
    if (board.phaseKind(phase) === undefined || !placementTakesCard(board, phase, facts, carriesPullRequest)) continue;
    return { phase, routeId: route.id };
  }
  return undefined;
}
