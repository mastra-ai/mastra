import { evaluateRuleGroup } from '../rules/rule-group.js';
import type { RuleFacts } from '../rules/rule-group.js';
import type { StoredBoardsStorage, StoredIntakeRouteRecord } from '../storage/domains/boards/base.js';
import type { Card } from '../storage/domains/work-items/base.js';
import { exitsPhase, PHASE_EXITED_EVENT } from './board-events.js';
import type { BoardEventFacts } from './board-events.js';
import type { BoardRegistry, InstalledBoard } from './registry.js';
import { boardFlow, boardForWorkItem, hasPullRequest } from './semantics.js';

/** Reads a project's intake routes, in order. */
export type IntakeRoutesReader = Pick<StoredBoardsStorage, 'listIntakeRoutes'>;

type IntakeRoute = Pick<StoredIntakeRouteRecord, 'id' | 'enabled' | 'when' | 'target' | 'on'>;

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
  route: {
    target: { boardKey: string; phaseKey?: string | null; joinClosedIssue?: boolean };
    on: readonly string[];
    from?: { boardKey: string; phaseKey: string } | null;
  },
): IntakeTargetProblem | undefined {
  const { target } = route;
  const board = registry.get(target.boardKey);
  if (!board) {
    return { code: 'unknown_board', message: `Board "${target.boardKey}" is not installed in this project.` };
  }
  if (exitsPhase(route)) return phaseExitProblem(registry, board, route);
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

/** A `phase.exited` route listens on a phase cards leave and sends them to a phase they can keep working in. */
function phaseExitProblem(
  registry: BoardRegistry,
  board: InstalledBoard,
  route: {
    target: { boardKey: string; phaseKey?: string | null; joinClosedIssue?: boolean };
    from?: { boardKey: string; phaseKey: string } | null;
  },
): IntakeTargetProblem | undefined {
  const { target, from } = route;
  if (target.joinClosedIssue) {
    return {
      code: 'join_on_event',
      message: `A route that joins a pull request to the card of the issue it closes handles only arrivals, not ${PHASE_EXITED_EVENT}.`,
    };
  }
  // Storage refuses a phase-exit route without `from`, saying what it needs.
  if (!from) return undefined;
  const fromBoard = registry.get(from.boardKey);
  if (!fromBoard)
    return { code: 'unknown_board', message: `Board "${from.boardKey}" is not installed in this project.` };
  const fromKind = fromBoard.phaseKind(from.phaseKey);
  if (!fromKind) return { code: 'unknown_phase', message: `Board "${from.boardKey}" has no phase "${from.phaseKey}".` };
  if (fromKind === 'terminal') {
    return {
      code: 'terminal_phase',
      message: `Phase "${from.phaseKey}" on board "${from.boardKey}" is terminal; cards don't leave it to be routed.`,
    };
  }
  const phase = target.phaseKey ?? board.initialPhase;
  const kind = board.phaseKind(phase);
  if (!kind) return { code: 'unknown_phase', message: `Board "${target.boardKey}" has no phase "${phase}".` };
  if (kind === 'terminal') {
    return {
      code: 'terminal_phase',
      message: `Phase "${phase}" on board "${target.boardKey}" is terminal; a route run when a card leaves a phase sends it on to more work.`,
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
export function placementTakesCard(
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

type PhaseExitRoute = Pick<StoredIntakeRouteRecord, 'id' | 'name' | 'enabled' | 'when' | 'target' | 'on' | 'from'>;

/** The enabled `phase.exited` routes listening on a board's phase, in order. */
export function phaseExitRoutes<T extends PhaseExitRoute>(routes: readonly T[], board: string, phase: string): T[] {
  return routes.filter(
    route => route.enabled && exitsPhase(route) && route.from?.boardKey === board && route.from.phaseKey === phase,
  );
}

export interface PhaseExitResolution<T extends PhaseExitRoute> {
  /** The first route whose condition matches and whose target takes the card. */
  match?: { route: T; board: InstalledBoard; phase: string };
  /** Routes whose condition matched but whose target can't take the card, and why. */
  skipped: { route: T; problem: string }[];
}

/**
 * Where a card leaving a phase goes instead of where its mover asked: the first of `routes` (see
 * {@link phaseExitRoutes}) whose `when` matches the card's facts and whose target is a phase the
 * card can keep working in, on any installed board. The left phase's next phases don't bind a
 * route, as they don't bind any route move.
 */
export function resolvePhaseExitRoute<T extends PhaseExitRoute>(
  routes: readonly T[],
  facts: RuleFacts,
  registry: BoardRegistry,
  card: { standalonePullRequest: boolean; hasPullRequest: boolean },
  cardShapeProblem: (board: InstalledBoard, phase: string) => string | undefined,
): PhaseExitResolution<T> {
  const skipped: PhaseExitResolution<T>['skipped'] = [];
  for (const route of routes) {
    if (!evaluateRuleGroup(route.when, facts)) continue;
    const board = registry.get(route.target.boardKey);
    const phase = board ? (route.target.phaseKey ?? board.initialPhase) : undefined;
    const problem = !board
      ? `board "${route.target.boardKey}" is not installed`
      : !board.phaseKind(phase!)
        ? `board "${board.id}" has no phase "${phase}"`
        : board.isTerminal(phase!)
          ? `phase "${phase}" on board "${board.id}" is terminal`
          : !placementTakesCard(board, phase!, facts, card.hasPullRequest)
            ? `board "${board.id}" doesn't take this card in "${phase}"`
            : cardShapeProblem(board, phase!);
    if (problem) {
      skipped.push({ route, problem });
      continue;
    }
    return { match: { route, board: board!, phase: phase! }, skipped };
  }
  return { skipped };
}
