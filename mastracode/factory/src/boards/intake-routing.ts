import { evaluateRuleGroup } from '../rules/rule-group.js';
import type { RuleFacts } from '../rules/rule-group.js';
import type { StoredBoardsStorage, StoredIntakeRouteRecord } from '../storage/domains/boards/base.js';
import type { Card } from '../storage/domains/work-items/base.js';
import type { BoardRegistry, InstalledBoard } from './registry.js';

/** Reads a project's intake routes, in order. */
export type IntakeRoutesReader = Pick<StoredBoardsStorage, 'listIntakeRoutes'>;

type IntakeRoute = Pick<StoredIntakeRouteRecord, 'id' | 'enabled' | 'when' | 'target' | 'on'>;

/** Whether the route places new cards, rather than only moving existing ones on later events. */
export function placesNewCards(route: Pick<StoredIntakeRouteRecord, 'on'>): boolean {
  return route.on.includes('work_item.created');
}

/**
 * Card metadata naming the intake route that placed the card. Label routes, repository
 * bindings and replayed arrivals leave such a card where the route put it.
 */
export const INTAKE_ROUTE_METADATA_KEY = 'intakeRouteId';

/** Whether an intake route chose this card's board when it arrived. */
export function placedByIntakeRoute(item: Pick<Card, 'metadata'>): boolean {
  return typeof item.metadata?.[INTAKE_ROUTE_METADATA_KEY] === 'string';
}

export type IntakeTargetProblem = {
  code: 'unknown_board' | 'unknown_phase' | 'terminal_phase' | 'unreachable_phase';
  message: string;
};

/**
 * Why a route's target can't take cards in this project, or undefined when it can. A route that
 * places new cards needs a phase they can reach; one that only moves existing cards on later
 * events, such as a close, may name any phase, terminal ones included.
 */
export function intakeTargetProblem(
  registry: BoardRegistry,
  route: { target: { boardKey: string; phaseKey?: string | null }; on: readonly string[] },
): IntakeTargetProblem | undefined {
  const { target } = route;
  const board = registry.get(target.boardKey);
  if (!board) {
    return { code: 'unknown_board', message: `Board "${target.boardKey}" is not installed in this project.` };
  }
  if (!target.phaseKey) return undefined;
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
 * The built-in Review board holds only pull requests. On Work a new pull request card lands in
 * Intake or PR review, and nothing else lands in PR review. `FactoryTransitionService` refuses
 * any move that breaks this, so a route can't either.
 */
function placementTakesCard(boardId: string, phase: string, facts: RuleFacts): boolean {
  const pullRequest = facts['source.kind'] === 'pull_request';
  if (boardId === 'review') return pullRequest;
  if (boardId === 'work') return pullRequest ? phase === 'intake' || phase === 'pr-review' : phase !== 'pr-review';
  return true;
}

/**
 * Where a new card lands: the first enabled route that places new cards, whose condition matches the card and whose
 * board is installed and can hold it. A route without a phase, or whose phase has since gone,
 * lands the card in the board's initial phase. Undefined leaves today's placement alone.
 */
export function resolveIntakePlacement(
  routes: readonly IntakeRoute[],
  facts: RuleFacts,
  registry: BoardRegistry,
): { board: string; phase: string; routeId: string } | undefined {
  for (const route of routes) {
    if (!route.enabled || !placesNewCards(route) || !evaluateRuleGroup(route.when, facts)) continue;
    const board = registry.get(route.target.boardKey);
    if (!board) continue;
    const phase = landingPhase(board, route.target.phaseKey);
    if (!placementTakesCard(board.id, phase, facts)) continue;
    return { board: board.id, phase, routeId: route.id };
  }
  return undefined;
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
