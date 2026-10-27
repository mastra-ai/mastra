import type {
  FactoryRuleDecision,
  FactoryRuleHandler,
  FactoryStageRuleContext,
  FactoryToolResultRuleContext,
} from '../rules/types.js';
import type { BoardToolRule } from './define-board.js';
import { resultContent } from './work-tool-rules.js';

/** Starts the phase's skill in its context, for sources the phase gives no `onEnter` handler. */
export function startSkill(skill: string, context: string): FactoryRuleHandler<FactoryStageRuleContext> {
  return rule => ({
    type: 'invokeSkill',
    idempotencyKey: `${rule.ingress.id}:${skill}`,
    role: context,
    skillName: skill,
    arguments: rule.item.url ? `Work item (${rule.item.url})` : rule.item.title,
  });
}

function withInstructions(decision: FactoryRuleDecision, instructions: string): FactoryRuleDecision {
  if (decision.type !== 'invokeSkill') return decision;
  if (decision.prompt !== undefined) return { ...decision, prompt: `${decision.prompt}\n\n${instructions}` };
  return { ...decision, arguments: decision.arguments ? `${decision.arguments}\n\n${instructions}` : instructions };
}

const instructedHandlers = new WeakMap<FactoryRuleHandler<FactoryStageRuleContext>, string>();

/**
 * Appends the phase's instructions to every run its handler starts. A handler that already
 * carries them, because a defined phase was declared again, is returned as is.
 */
export function addInstructions(
  handler: FactoryRuleHandler<FactoryStageRuleContext>,
  instructions: string,
): FactoryRuleHandler<FactoryStageRuleContext> {
  if (instructedHandlers.get(handler) === instructions) return handler;
  const instructed: FactoryRuleHandler<FactoryStageRuleContext> = async context => {
    const decision = await handler(context);
    return decision ? withInstructions(decision, instructions) : decision;
  };
  instructedHandlers.set(instructed, instructions);
  return instructed;
}

/**
 * Moves the card on when an agent in the phase's context completes its exit tool. `submit_plan`
 * only ends the phase once the plan is approved.
 */
export function exitToolRule(options: {
  board: string;
  phase: string;
  context: string;
  tool: string;
  to: string;
}): BoardToolRule {
  return {
    onResult: (rule: Readonly<FactoryToolResultRuleContext>) => {
      if (
        rule.result.status !== 'success' ||
        rule.item.stages.length !== 1 ||
        rule.item.stages[0] !== options.phase ||
        rule.actor.type !== 'agent' ||
        rule.actor.role !== options.context ||
        (options.tool === 'submit_plan' && !resultContent(rule.result.value)?.startsWith('Plan approved.'))
      ) {
        return;
      }
      return {
        type: 'transition',
        idempotencyKey: `${rule.ingress.id}:exit-${options.phase}`,
        board: options.board,
        stage: options.to,
      };
    },
  };
}
