import type { ProcessorGraphCondition } from '@mastra/core/storage';

import { evaluateRuleGroup } from './rule-evaluator';

export function matchesAnyConditionRule(
  conditions: ProcessorGraphCondition[],
  inputData: Record<string, unknown>,
): boolean {
  return conditions.some(condition => condition.rules && evaluateRuleGroup(condition.rules, inputData));
}
