/**
 * RuleEvaluator: Evaluates recursive RuleGroup conditions against a context object.
 *
 * Supports:
 *   - Leaf rules with operators: equals, not_equals, contains, not_contains,
 *     greater_than, less_than, greater_than_or_equal, less_than_or_equal,
 *     in, not_in, exists, not_exists
 *   - Recursive AND / OR grouping via RuleGroup
 */

import type { Rule, RuleGroup } from '@mastra/core/storage';

/**
 * Resolves a dot-notation path against a context object.
 */
function resolvePath(context: Record<string, unknown>, path: string): unknown {
  const segments = path.split('.');
  let current: unknown = context;

  for (const segment of segments) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }

  return current;
}

/**
 * Evaluates a single leaf rule against a context object.
 */
function evaluateRule(rule: Rule, context: Record<string, unknown>): boolean {
  const fieldValue = resolvePath(context, rule.field);

  switch (rule.operator) {
    case 'equals':
      return fieldValue === rule.value;

    case 'not_equals':
      return fieldValue !== rule.value;

    case 'contains': {
      if (typeof fieldValue === 'string' && typeof rule.value === 'string') {
        return fieldValue.includes(rule.value);
      }
      if (Array.isArray(fieldValue)) {
        return fieldValue.includes(rule.value);
      }
      return false;
    }

    case 'not_contains': {
      if (typeof fieldValue === 'string' && typeof rule.value === 'string') {
        return !fieldValue.includes(rule.value);
      }
      if (Array.isArray(fieldValue)) {
        return !fieldValue.includes(rule.value);
      }
      return true;
    }

    case 'greater_than':
      return typeof fieldValue === 'number' && typeof rule.value === 'number' && fieldValue > rule.value;

    case 'less_than':
      return typeof fieldValue === 'number' && typeof rule.value === 'number' && fieldValue < rule.value;

    case 'greater_than_or_equal':
      return typeof fieldValue === 'number' && typeof rule.value === 'number' && fieldValue >= rule.value;

    case 'less_than_or_equal':
      return typeof fieldValue === 'number' && typeof rule.value === 'number' && fieldValue <= rule.value;

    case 'in':
      return Array.isArray(rule.value) && rule.value.includes(fieldValue);

    case 'not_in':
      return Array.isArray(rule.value) && !rule.value.includes(fieldValue);

    case 'exists':
      return fieldValue !== undefined && fieldValue !== null;

    case 'not_exists':
      return fieldValue === undefined || fieldValue === null;

    default:
      return false;
  }
}

/**
 * Evaluates a RuleGroup (which may contain nested RuleGroups) against a context object.
 *
 * @param ruleGroup - The rule group to evaluate (AND/OR with nested conditions)
 * @param context - The context object to evaluate against
 * @returns true if the rule group passes, false otherwise
 */
export function evaluateRuleGroup(ruleGroup: RuleGroup, context: Record<string, unknown>): boolean {
  if (ruleGroup.conditions.length === 0) {
    // Empty conditions = always true (no constraints)
    return true;
  }

  const results = ruleGroup.conditions.map(condition => {
    if ('conditions' in condition) {
      // Nested RuleGroup
      return evaluateRuleGroup(condition, context);
    }
    // Leaf Rule
    return evaluateRule(condition, context);
  });

  if (ruleGroup.operator === 'AND') {
    return results.every(Boolean);
  }

  // OR
  return results.some(Boolean);
}
