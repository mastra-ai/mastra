import { evaluateRuleGroup, explainRuleGroup } from '../rules/rule-group.js';
import type { FailedRuleCondition, RuleFacts, RuleGroup } from '../rules/rule-group.js';
import { externalSourceForWorkItem } from '../rules/types.js';
import type { FactoryCommitDecision } from '../rules/types.js';
import type { IntakeEvaluator, StoredBoardsStorage, StoredIntakeRouteRecord } from '../storage/domains/boards/base.js';
import type { Card } from '../storage/domains/work-items/base.js';
import type { BoardEventFacts, RouteArrivals } from './board-events.js';
import { arrivalKind, arrivalKinds, eventRuleFacts, isPullRequestEvent, LEGACY_ARRIVAL_EVENT } from './board-events.js';
import { cardRuleFacts } from './card-facts.js';
import { deriveIntakeOrder, reconcileIntakeOrder } from './intake-order.js';
import type { BoardRegistry, InstalledBoard } from './registry.js';
import { boardFlow, boardForWorkItem, hasPullRequest, intakeTarget, isTerminalWorkItem } from './semantics.js';

/** Reads a project's intake routes and intake order, and logs how intake decided each arrival. */
export type IntakeRoutesReader = Pick<
  StoredBoardsStorage,
  'listIntakeRoutes' | 'readIntakeOrder' | 'recordIntakeDecision' | 'resolveNotRouted' | 'intakeEvaluator'
>;

type IntakeRoute = Pick<StoredIntakeRouteRecord, 'id' | 'enabled' | 'when' | 'on' | 'pullRequestOpenedMovesOnly'> & {
  target: Pick<StoredIntakeRouteRecord['target'], 'boardKey' | 'phaseKey' | 'joinClosedIssue'> & {
    moveToBoardKey?: string | null;
  };
} & Partial<Pick<StoredIntakeRouteRecord, 'name'>>;

/** Whether the route places new cards, rather than only moving existing ones on later events. */
export function placesNewCards(route: RouteArrivals): boolean {
  return arrivalKinds(route).size > 0;
}

/**
 * Whether the route files this arrival: an issue by a `work_item.opened` route, a pull request with
 * no card by a `pull_request.opened` one, either by a legacy `work_item.created` one.
 */
export function placesArrival(route: RouteArrivals, facts: RuleFacts): boolean {
  return arrivalKinds(route).has(arrivalKind(facts));
}

/**
 * Why a route that files only issues, or only pull requests, passes over this arrival, put as the
 * `source.kind` condition it amounts to; undefined when the route files this kind.
 */
function arrivalKindFailure(route: { on: readonly string[] }, facts: RuleFacts): FailedRuleCondition | undefined {
  if (placesArrival(route, facts)) return undefined;
  const actual = (facts['source.kind'] as FailedRuleCondition['actual'] | undefined) ?? null;
  return arrivalKind(facts) === 'pull_request'
    ? { field: 'source.kind', operator: 'not_equals', value: 'pull_request', actual }
    : { field: 'source.kind', operator: 'equals', value: 'pull_request', actual };
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
  code:
    | 'unknown_board'
    | 'unknown_phase'
    | 'terminal_phase'
    | 'unreachable_phase'
    | 'join_on_event'
    | 'move_on_arrival';
  message: string;
};

/**
 * Why a route's target can't take cards in this project, or undefined when it can. A route that
 * places new cards needs a phase they can reach; one that only moves existing cards on later
 * events, such as a close, may name any phase, terminal ones included.
 */
export function intakeTargetProblem(
  registry: BoardRegistry,
  route: RouteArrivals & {
    target: { boardKey: string; phaseKey?: string | null; joinClosedIssue?: boolean; moveToBoardKey?: string | null };
  },
): IntakeTargetProblem | undefined {
  const { target } = route;
  const owner = registry.get(target.boardKey);
  if (!owner) {
    return { code: 'unknown_board', message: `Board "${target.boardKey}" is not installed in this project.` };
  }
  if (target.moveToBoardKey && (target.joinClosedIssue || placesNewCards(route))) {
    return {
      code: 'move_on_arrival',
      message:
        'Only a route moving existing cards on later events can send them to another board: its `on` must not name an arrival event (`work_item.opened`, `pull_request.opened` or `work_item.created`).',
    };
  }
  const board = target.moveToBoardKey ? registry.get(target.moveToBoardKey) : owner;
  if (!board) {
    return { code: 'unknown_board', message: `Board "${target.moveToBoardKey}" is not installed in this project.` };
  }
  if (
    target.joinClosedIssue &&
    route.on.some(event => event !== 'pull_request.opened' && event !== LEGACY_ARRIVAL_EVENT)
  ) {
    return {
      code: 'join_on_event',
      message:
        'A route that joins a pull request to the card of the issue it closes handles only pull requests arriving: its `on` must be `pull_request.opened` alone.',
    };
  }
  if (!target.phaseKey) return undefined;
  if (target.joinClosedIssue && board.phaseKind(target.phaseKey) === 'terminal') {
    return {
      code: 'terminal_phase',
      message: `Phase "${target.phaseKey}" on board "${board.id}" is terminal; a card a pull request joins can't move there.`,
    };
  }
  if (target.joinClosedIssue) {
    return board.phaseKind(target.phaseKey)
      ? undefined
      : { code: 'unknown_phase', message: `Board "${board.id}" has no phase "${target.phaseKey}".` };
  }
  const kind = board.phaseKind(target.phaseKey);
  if (!kind) {
    return { code: 'unknown_phase', message: `Board "${board.id}" has no phase "${target.phaseKey}".` };
  }
  if (!placesNewCards(route)) return undefined;
  if (kind === 'terminal') {
    return {
      code: 'terminal_phase',
      message: `Phase "${target.phaseKey}" on board "${board.id}" is terminal; new cards can't land there.`,
    };
  }
  if (!board.allowsTransition(board.initialPhase, target.phaseKey)) {
    return {
      code: 'unreachable_phase',
      message: `Board "${board.id}" doesn't allow moving a card from its first phase "${board.initialPhase}" to "${target.phaseKey}".`,
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
    'item.hasIssue': true,
    ...(closedIssue.stages.length === 1 ? { 'closedIssue.phase': closedIssue.stages[0] } : {}),
    'closedIssue.hasPullRequest': hasPullRequest(closedIssue),
  };
}

/**
 * Where a new card lands: the first enabled route that places new cards, whose condition matches
 * it and whose target can take it, on an installed board; a route without a phase, or whose phase
 * has since gone, lands it in the board's initial phase. Routes that once joined a pull request to
 * the card of the issue it closes place nothing: pull requests link to that card on their own.
 * Undefined leaves today's placement alone.
 */
export function resolveIntakePlacement(
  routes: readonly IntakeRoute[],
  facts: RuleFacts,
  registry: BoardRegistry,
): { board: string; phase: string; routeId: string } | undefined {
  for (const route of routes) {
    if (!route.enabled || route.target.joinClosedIssue || !placesArrival(route, facts)) continue;
    if (!evaluateRuleGroup(route.when, facts)) continue;
    const board = registry.get(route.target.boardKey);
    if (!board) continue;
    const phase = landingPhase(board, route.target.phaseKey);
    if (!placementTakesCard(board, phase, facts)) continue;
    return { board: board.id, phase, routeId: route.id };
  }
  return undefined;
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

/** The env var that forces an evaluator on every project when the Factory's `intake.evaluator` option doesn't. */
export const INTAKE_EVALUATOR_ENV = 'FACTORY_INTAKE_EVALUATOR';

/** An evaluator this process forces on every project, and what forced it. */
export interface ForcedIntakeEvaluator {
  evaluator: IntakeEvaluator;
  source: 'option' | 'env';
}

/** Where a project's evaluator came from: forced, its own setting, or none (an older project). */
export type IntakeEvaluatorSource = ForcedIntakeEvaluator['source'] | 'project' | 'legacy';

/**
 * The evaluator this process forces on every project: the configured one, else a valid
 * `FACTORY_INTAKE_EVALUATOR`. Undefined when neither is set: each project uses its own.
 */
export function intakeEvaluatorFrom(
  configured: IntakeEvaluator | undefined,
  env: Record<string, string | undefined> = process.env,
): ForcedIntakeEvaluator | undefined {
  if (configured) return { evaluator: configured, source: 'option' };
  const value = env[INTAKE_EVALUATOR_ENV];
  return value === 'intake-order' || value === 'route-list' ? { evaluator: value, source: 'env' } : undefined;
}

/**
 * The evaluator that decides a project's arrivals: the forced one, else the project's setting
 * (`intake-order` for a project created since it shipped), else `route-list`.
 */
export async function projectIntakeEvaluator(
  forced: IntakeEvaluator | undefined,
  storage: Pick<StoredBoardsStorage, 'intakeEvaluator'>,
  scope: { orgId: string; factoryProjectId: string },
): Promise<IntakeEvaluator> {
  return forced ?? (await storage.intakeEvaluator(scope)) ?? 'route-list';
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
      const kindFailed = arrivalKindFailure(route, facts);
      if (kindFailed) {
        trace.rules.push({ ...rule, outcome: 'no_match', failed: [kindFailed] });
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

const SETTLING_PULL_REQUEST_EVENTS = new Set<string>(['pull_request.merged', 'pull_request.closed']);

function testsField(group: RuleGroup | null, field: string): boolean {
  return (
    group?.conditions.some(member => ('field' in member ? member.field === field : testsField(member, field))) ?? false
  );
}

/** A card-move route that matched but can't take the card where it points, and why. */
export interface SkippedEventRoute {
  routeId: string;
  /** The board the rule points the card to. */
  boardKey: string;
  reason: string;
}

/**
 * Where a status event moves an existing card: the first enabled route on the card's board whose
 * `on` names the event, whose `when` matches the card and the event, and whose target can hold the
 * card. The target is the route's own board unless it names another (`moveToBoardKey`); a route
 * without a phase moves the card to the target board's first phase. A matching route whose target
 * is gone or can't take the card is skipped and reported through `onSkip`. Undefined leaves the
 * card where it is.
 */
export function resolveEventRoute(
  routes: readonly IntakeRoute[],
  event: BoardEventFacts,
  cardFacts: RuleFacts,
  board: InstalledBoard,
  options: { registry: BoardRegistry; carriesPullRequest?: boolean; onSkip?: (skipped: SkippedEventRoute) => void },
): { board: string; phase: string; routeId: string } | undefined {
  const { 'pullRequest.trusted': workingPullRequestTrusted, ...rest } = cardFacts;
  // On a pull request event, `pullRequest.trusted` is that pull request's author, not the card's
  // working pull request's; an event that doesn't say is untrusted.
  const pullRequestTrusted = isPullRequestEvent(event.type) ? event.pullRequestTrusted : workingPullRequestTrusted;
  const facts: RuleFacts = {
    ...rest,
    ...(pullRequestTrusted !== undefined ? { 'pullRequest.trusted': pullRequestTrusted } : {}),
    ...eventRuleFacts(event),
    ...(event.closedIssue
      ? {
          'pullRequest.closesIssue': true,
          ...(event.closedIssue.phase !== null ? { 'closedIssue.phase': event.closedIssue.phase } : {}),
          'closedIssue.hasPullRequest': event.closedIssue.hasPullRequest,
        }
      : {}),
  };
  // An outsider's pull request linked to an issue's card moves the card only by a rule that asks
  // about the pull request's trust; one that doesn't was never written with outsiders in mind.
  // Merging and closing settle the pull request either way, so those still move the card.
  const untrustedLinkedPullRequest =
    isPullRequestEvent(event.type) &&
    !SETTLING_PULL_REQUEST_EVENTS.has(event.type) &&
    cardFacts['source.kind'] !== 'pull_request' &&
    pullRequestTrusted !== true;
  for (const route of routes) {
    if (!route.enabled || !route.on.includes(event.type) || route.target.boardKey !== board.id) continue;
    if (untrustedLinkedPullRequest && !testsField(route.when, 'pullRequest.trusted')) continue;
    if (!evaluateRuleGroup(route.when, facts)) continue;
    const targetKey = route.target.moveToBoardKey ?? board.id;
    const skip = (reason: string) => options.onSkip?.({ routeId: route.id, boardKey: targetKey, reason });
    const target = targetKey === board.id ? board : options.registry.get(targetKey);
    if (!target) {
      skip(`board "${targetKey}" is not installed`);
      continue;
    }
    const phase = route.target.phaseKey ?? target.initialPhase;
    if (target.phaseKind(phase) === undefined) {
      skip(`board "${target.id}" has no phase "${phase}"`);
      continue;
    }
    if (!placementTakesCard(target, phase, facts, options.carriesPullRequest ?? false)) {
      skip(`phase "${phase}" on board "${target.id}" can't hold this card`);
      continue;
    }
    return { board: target.id, phase, routeId: route.id };
  }
  return undefined;
}
