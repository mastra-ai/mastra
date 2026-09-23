import type { WorkflowCardCondition } from '../../types';

export function conditionExpression(condition: WorkflowCardCondition) {
  if (condition.fnString !== undefined) return condition.fnString;
  return JSON.stringify({ ref: condition.ref, query: condition.query, conj: condition.conj }, null, 2);
}
