import { safeStringify } from '@mastra/core/utils/safe-stringify';
import type { WorkflowCardCondition } from '../../types';

export function conditionExpression(condition: WorkflowCardCondition) {
  if (condition.fnString !== undefined) return condition.fnString;
  return safeStringify({ ref: condition.ref, query: condition.query, conj: condition.conj }, 2);
}
