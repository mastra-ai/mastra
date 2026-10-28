import type { FactoryRuleDecision, FactoryRuleHandler, FactoryStageRuleContext } from '../rules/types.js';

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
