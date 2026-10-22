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
