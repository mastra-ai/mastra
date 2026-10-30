import type { RuleGroup } from '../rules/rule-group.js';
import type { BoardRegistry } from './registry.js';

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
