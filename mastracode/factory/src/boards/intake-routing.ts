import { evaluateRuleGroup } from '../rules/rule-group.js';
import type { RuleFacts } from '../rules/rule-group.js';
import type { StoredBoardsStorage, StoredIntakeRouteRecord } from '../storage/domains/boards/base.js';
import type { WorkItemRow } from '../storage/domains/work-items/base.js';
import type { BoardRegistry, InstalledBoard } from './registry.js';

/** Reads a project's intake routes, in order. */
export type IntakeRoutesReader = Pick<StoredBoardsStorage, 'listIntakeRoutes'>;

type IntakeRoute = Pick<StoredIntakeRouteRecord, 'id' | 'enabled' | 'when' | 'target'>;

/**
 * Card metadata naming the intake route that placed the card. Label routes, repository
 * bindings and replayed arrivals leave such a card where the route put it.
 */
export const INTAKE_ROUTE_METADATA_KEY = 'intakeRouteId';

/** Whether an intake route chose this card's board when it arrived. */
export function placedByIntakeRoute(item: Pick<WorkItemRow, 'metadata'>): boolean {
  return typeof item.metadata?.[INTAKE_ROUTE_METADATA_KEY] === 'string';
}

export type IntakeTargetProblem = {
  code: 'unknown_board' | 'unknown_phase' | 'terminal_phase' | 'unreachable_phase';
  message: string;
};

/** Why a route's target can't take cards in this project, or undefined when it can. */
export function intakeTargetProblem(
  registry: BoardRegistry,
  target: { boardKey: string; phaseKey?: string | null },
): IntakeTargetProblem | undefined {
  const board = registry.get(target.boardKey);
  if (!board) {
    return { code: 'unknown_board', message: `Board "${target.boardKey}" is not installed in this project.` };
  }
  if (!target.phaseKey) return undefined;
  const kind = board.phaseKind(target.phaseKey);
  if (!kind) {
    return { code: 'unknown_phase', message: `Board "${target.boardKey}" has no phase "${target.phaseKey}".` };
  }
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
 * The built-in Work board holds no pull requests and the built-in Review board nothing else;
 * `FactoryTransitionService` refuses any move that breaks this, so a route can't either.
 */
function boardTakesCard(boardId: string, facts: RuleFacts): boolean {
  const pullRequest = facts['source.kind'] === 'pull_request';
  if (boardId === 'work') return !pullRequest;
  if (boardId === 'review') return pullRequest;
  return true;
}

/**
 * Where a new card lands: the first enabled route whose condition matches the card and whose
 * board is installed and can hold it. A route without a phase, or whose phase has since gone,
 * lands the card in the board's initial phase. Undefined leaves today's placement alone.
 */
export function resolveIntakePlacement(
  routes: readonly IntakeRoute[],
  facts: RuleFacts,
  registry: BoardRegistry,
): { board: string; phase: string; routeId: string } | undefined {
  for (const route of routes) {
    if (!route.enabled || !evaluateRuleGroup(route.when, facts)) continue;
    const board = registry.get(route.target.boardKey);
    if (!board || !boardTakesCard(board.id, facts)) continue;
    return { board: board.id, phase: landingPhase(board, route.target.phaseKey), routeId: route.id };
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
