/**
 * Utilities for evaluating condition definitions in workflow definitions.
 *
 * Conditions are used for branching (if/else) and loops (while/until).
 */

import {
  evaluateRef,
  evaluateValueOrRef,
  type EvaluationContext,
  type VariableRef,
  type ValueOrRef,
} from './evaluate-ref';

// Condition types - will be imported from storage/types.ts
export type ConditionOperator =
  | 'equals'
  | 'notEquals'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'contains'
  | 'startsWith'
  | 'endsWith'
  | 'matches'
  | 'in'
  | 'isNull'
  | 'isNotNull';

export type ConditionDef =
  | { type: 'compare'; field: VariableRef; operator: ConditionOperator; value?: ValueOrRef }
  | { type: 'and'; conditions: ConditionDef[] }
  | { type: 'or'; conditions: ConditionDef[] }
  | { type: 'not'; condition: ConditionDef }
  | { type: 'expr'; expression: string };

/**
 * Evaluates a condition definition against the execution context.
 *
 * @param condition - The condition definition to evaluate
 * @param context - The execution context
 * @returns true if condition is met, false otherwise
 */
export function evaluateCondition(condition: ConditionDef, context: EvaluationContext): boolean {
  switch (condition.type) {
    case 'compare':
      return evaluateCompare(condition, context);
    case 'and':
      return condition.conditions.every(c => evaluateCondition(c, context));
    case 'or':
      return condition.conditions.some(c => evaluateCondition(c, context));
    case 'not':
      return !evaluateCondition(condition.condition, context);
    case 'expr':
      return evaluateExpression(condition.expression, context);
    default:
      throw new Error(`Unknown condition type: ${(condition as { type: string }).type}`);
  }
}

/**
 * Evaluates a comparison condition.
 */
function evaluateCompare(
  condition: { field: VariableRef; operator: ConditionOperator; value?: ValueOrRef },
  context: EvaluationContext,
): boolean {
  const fieldValue = evaluateRef(condition.field.$ref, context);
  const compareValue = condition.value ? evaluateValueOrRef(condition.value, context) : undefined;

  switch (condition.operator) {
    case 'equals':
      return fieldValue === compareValue;
    case 'notEquals':
      return fieldValue !== compareValue;
    case 'gt':
      return typeof fieldValue === 'number' && typeof compareValue === 'number' && fieldValue > compareValue;
    case 'gte':
      return typeof fieldValue === 'number' && typeof compareValue === 'number' && fieldValue >= compareValue;
    case 'lt':
      return typeof fieldValue === 'number' && typeof compareValue === 'number' && fieldValue < compareValue;
    case 'lte':
      return typeof fieldValue === 'number' && typeof compareValue === 'number' && fieldValue <= compareValue;
    case 'contains':
      return typeof fieldValue === 'string' && typeof compareValue === 'string' && fieldValue.includes(compareValue);
    case 'startsWith':
      return typeof fieldValue === 'string' && typeof compareValue === 'string' && fieldValue.startsWith(compareValue);
    case 'endsWith':
      return typeof fieldValue === 'string' && typeof compareValue === 'string' && fieldValue.endsWith(compareValue);
    case 'matches':
      if (typeof fieldValue !== 'string' || typeof compareValue !== 'string') return false;
      try {
        return new RegExp(compareValue).test(fieldValue);
      } catch {
        return false;
      }
    case 'in':
      return Array.isArray(compareValue) && compareValue.includes(fieldValue);
    case 'isNull':
      return fieldValue === null || fieldValue === undefined;
    case 'isNotNull':
      return fieldValue !== null && fieldValue !== undefined;
    default:
      throw new Error(`Unknown operator: ${condition.operator}`);
  }
}

/**
 * Evaluates a JavaScript expression condition.
 *
 * WARNING: This uses Function constructor for evaluation.
 * The expression has access to input, steps, and state variables.
 */
function evaluateExpression(expression: string, context: EvaluationContext): boolean {
  try {
    // Create a sandboxed function with access to context variables
    const fn = new Function('input', 'steps', 'state', `return Boolean(${expression})`);
    return fn(context.input, context.steps, context.state);
  } catch (error) {
    throw new Error(`Failed to evaluate expression "${expression}": ${error instanceof Error ? error.message : error}`);
  }
}
