import { isApprovedSubmitPlan } from '../rules/plan-approval.js';
import type { FactoryToolResultRuleContext } from '../rules/types.js';

// Interactive-session path only: factory-plan never calls submit_plan — it
// submits a durable Factory plan decision instead.
export function advanceApprovedPlan(context: FactoryToolResultRuleContext) {
  if (
    context.result.status !== 'success' ||
    context.item.stages.length !== 1 ||
    context.item.stages[0] !== 'planning' ||
    context.actor.type !== 'agent' ||
    context.actor.role !== 'plan' ||
    !isApprovedSubmitPlan(context.result.value)
  ) {
    return;
  }
  return {
    type: 'transition',
    idempotencyKey: `${context.ingress.id}:approved-plan`,
    board: 'work',
    stage: 'execute',
  } as const;
}
