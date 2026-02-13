import type { Rule, RuleGroup } from '../types';

/**
 * Type guard: checks if a condition is a leaf Rule
 */
export const isRule = (condition: Rule | RuleGroup): condition is Rule => 'field' in condition;

/**
 * Type guard: checks if a condition is a nested RuleGroup
 */
export const isRuleGroup = (condition: Rule | RuleGroup): condition is RuleGroup => 'conditions' in condition;

/**
 * Recursively counts the number of leaf Rule nodes in a RuleGroup
 */
export const countLeafRules = (group: RuleGroup | undefined): number => {
  if (!group) return 0;
  return group.conditions.reduce((count, condition) => {
    if (isRule(condition)) return count + 1;
    return count + countLeafRules(condition);
  }, 0);
};

/**
 * Creates a default empty rule
 */
export const createDefaultRule = (): Rule => ({
  field: '',
  operator: 'equals',
  value: '',
});

/**
 * Creates a default empty rule group
 */
export const createDefaultRuleGroup = (operator: 'AND' | 'OR' = 'AND'): RuleGroup => ({
  operator,
  conditions: [createDefaultRule()],
});
