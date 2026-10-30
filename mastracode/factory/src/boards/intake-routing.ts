import { evaluateRuleGroup } from '../rules/rule-group.js';
import type { RuleFacts, RuleGroup } from '../rules/rule-group.js';
import type { IntakeRouteHold, StoredBoardsStorage, StoredIntakeRouteRecord } from '../storage/domains/boards/base.js';
import type { WorkItemRow } from '../storage/domains/work-items/base.js';
import { cardRuleFacts } from './card-facts.js';
import type { BoardRegistry } from './registry.js';

/** Reads a project's intake routes, in order. */
export type IntakeRoutesReader = Pick<StoredBoardsStorage, 'listIntakeRoutes'>;

type IntakeRoute = Pick<StoredIntakeRouteRecord, 'enabled' | 'when' | 'target' | 'hold'>;

/**
 * The built-in "needs a person" condition: a GitHub or GitLab card whose author is not
 * trusted (no `authorTrusted` or `factoryAuthored` stamp). A missing stamp fails closed.
 */
export const UNTRUSTED_AUTHOR_WHEN: RuleGroup = {
  operator: 'AND',
  conditions: [
    { field: 'source.integration', operator: 'in', value: ['github', 'gitlab'] },
    { field: 'author.trusted', operator: 'not_equals', value: true },
  ],
};

export type IntakeTargetProblem = { code: 'unknown_board' | 'unknown_phase' | 'terminal_phase'; message: string };

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
): { board: string; phase: string } | undefined {
  for (const route of routes) {
    if (!route.enabled || !route.target || !evaluateRuleGroup(route.when, facts)) continue;
    const board = registry.get(route.target.boardKey);
    if (!board || !boardTakesCard(board.id, facts)) continue;
    const phase = route.target.phaseKey;
    const usable = phase && board.phaseKind(phase) !== undefined && !board.isTerminal(phase);
    return { board: board.id, phase: usable ? phase : board.initialPhase };
  }
  return undefined;
}

/** The hold of the first enabled route whose condition matches the card, else `'untrusted'`. */
export function intakeHold(routes: readonly IntakeRoute[], facts: RuleFacts): IntakeRouteHold {
  return routes.find(route => route.enabled && evaluateRuleGroup(route.when, facts))?.hold ?? 'untrusted';
}

/**
 * Whether only a person may start work on `item`: the hold of the project's first matching
 * route — `'untrusted'` (also when no route matches, or no reader is wired) holds a GitHub or
 * GitLab card whose author is not trusted. Read live, so route edits and a reconcile's trust
 * backfill take effect at once.
 */
export async function heldForPerson(
  reader: IntakeRoutesReader | undefined,
  scope: { orgId: string; factoryProjectId: string },
  item: Pick<WorkItemRow, 'title' | 'metadata' | 'externalSource'>,
): Promise<IntakeRouteHold | false> {
  const facts = cardRuleFacts(item);
  const hold = intakeHold(reader ? await reader.listIntakeRoutes(scope) : [], facts);
  if (hold === 'always') return hold;
  return hold === 'untrusted' && evaluateRuleGroup(UNTRUSTED_AUTHOR_WHEN, facts) ? hold : false;
}
