import { evaluateRuleGroup } from '../rules/rule-group.js';
import type { RuleFacts } from '../rules/rule-group.js';
import type { StoredIntakeRoute } from '../storage/domains/boards/base.js';
import type { BoardRegistry } from './registry.js';

/** Where a new card lands: an installed board and the phase it should end up in. */
export interface IntakeRouteTarget {
  board: string;
  phase: string;
}

/**
 * First enabled route, in order, whose condition matches and whose board is
 * installed. A route without a phase (or naming a phase the board lacks) lands
 * the card on the board's initial phase.
 */
/** The Work phases a pull request card can start in; from anywhere else it could never be reviewed. */
export const PULL_REQUEST_ENTRY_PHASES: readonly string[] = ['intake', 'triage', 'review'];

/**
 * The routes that may place a pull request: a condition, the Work board and an explicit entry phase.
 * Routes written for issues (no condition, or another phase) leave pull requests in Work › Triage.
 */
export function pullRequestIntakeRoutes(routes: readonly StoredIntakeRoute[]): StoredIntakeRoute[] {
  return routes.filter(
    route => route.when && route.boardKey === 'work' && PULL_REQUEST_ENTRY_PHASES.includes(route.phaseKey ?? ''),
  );
}

export function matchIntakeRoute(
  routes: readonly StoredIntakeRoute[],
  facts: RuleFacts,
  boards: BoardRegistry,
): IntakeRouteTarget | undefined {
  for (const route of routes) {
    if (!route.enabled || !evaluateRuleGroup(route.when, facts)) continue;
    const board = boards.get(route.boardKey);
    if (!board) continue;
    const phase =
      route.phaseKey && Object.prototype.hasOwnProperty.call(board.phases, route.phaseKey)
        ? route.phaseKey
        : board.initialPhase;
    return { board: board.id, phase };
  }
  return undefined;
}
