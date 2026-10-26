import type { FactoryToolResultRuleContext } from '../rules/types.js';
import type { BoardToolRule } from './define-board.js';

function resultContent(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return;
  const content = (value as { content?: unknown }).content;
  return typeof content === 'string' ? content : undefined;
}

/**
 * A phase's exit tool: a successful call by the phase's own agent while the card
 * sits in that phase moves it to `nextPhase`. `submit_plan` only counts once the
 * plan was approved (by a person, or by the dispatcher when auto-approval applies).
 */
export function exitToolRule(input: { tool: string; phase: string; nextPhase: string; role?: string }): BoardToolRule {
  const { tool, phase, nextPhase, role } = input;
  return {
    onResult(context: FactoryToolResultRuleContext) {
      if (
        context.result.status !== 'success' ||
        context.item.stages.length !== 1 ||
        context.item.stages[0] !== phase ||
        context.actor.type !== 'agent' ||
        (role !== undefined && context.actor.role !== role)
      ) {
        return;
      }
      if (tool === 'submit_plan' && !resultContent(context.result.value)?.startsWith('Plan approved.')) return;
      return {
        type: 'transition',
        idempotencyKey: `${context.ingress.id}:${tool === 'submit_plan' ? 'approved-plan' : `exit-${phase}`}`,
        board: context.board,
        stage: nextPhase,
      } as const;
    },
  };
}
