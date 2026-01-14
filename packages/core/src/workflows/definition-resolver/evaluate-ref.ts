/**
 * Utilities for evaluating variable references in workflow definitions.
 *
 * Variable references use a path-based syntax:
 * - "input.userId" - references workflow input
 * - "steps.step1.output.name" - references a step's output
 * - "state.counter" - references workflow state
 */

// Type imports - these will be defined in storage/types.ts
// For now, define locally until Agent A completes
export type VariableRef = { $ref: string };
export type LiteralValue = { $literal: unknown };
export type ValueOrRef = VariableRef | LiteralValue;

export interface EvaluationContext {
  input: Record<string, unknown>;
  steps: Record<string, { output: unknown }>;
  state: Record<string, unknown>;
}

/**
 * Evaluates a variable reference path against the execution context.
 *
 * @param ref - The reference path (e.g., "input.userId", "steps.step1.output.name")
 * @param context - The execution context containing input, steps, and state
 * @returns The resolved value, or undefined if path doesn't exist
 * @throws Error if the reference source is invalid
 *
 * @example
 * const context = {
 *   input: { userId: '123' },
 *   steps: { step1: { output: { name: 'John' } } },
 *   state: { counter: 5 }
 * };
 *
 * evaluateRef('input.userId', context) // => '123'
 * evaluateRef('steps.step1.output.name', context) // => 'John'
 * evaluateRef('state.counter', context) // => 5
 */
export function evaluateRef(ref: string, context: EvaluationContext): unknown {
  const parts = ref.split('.');
  const source = parts[0];

  let value: unknown;
  switch (source) {
    case 'input':
      value = context.input;
      break;
    case 'steps':
      value = context.steps;
      break;
    case 'state':
      value = context.state;
      break;
    default:
      throw new Error(`Unknown reference source: "${source}". Expected "input", "steps", or "state".`);
  }

  // Navigate the path
  for (let i = 1; i < parts.length; i++) {
    if (value === null || value === undefined) {
      return undefined;
    }
    if (typeof value !== 'object') {
      return undefined;
    }
    const key = parts[i] as string;
    value = (value as Record<string, unknown>)[key];
  }

  return value;
}

/**
 * Checks if a value is a VariableRef.
 */
export function isVariableRef(value: unknown): value is VariableRef {
  return typeof value === 'object' && value !== null && '$ref' in value;
}

/**
 * Checks if a value is a LiteralValue.
 */
export function isLiteralValue(value: unknown): value is LiteralValue {
  return typeof value === 'object' && value !== null && '$literal' in value;
}

/**
 * Evaluates a ValueOrRef to its actual value.
 *
 * @param valueOrRef - Either a variable reference or literal value
 * @param context - The execution context
 * @returns The resolved value
 */
export function evaluateValueOrRef(valueOrRef: ValueOrRef, context: EvaluationContext): unknown {
  if (isVariableRef(valueOrRef)) {
    return evaluateRef(valueOrRef.$ref, context);
  }
  if (isLiteralValue(valueOrRef)) {
    return valueOrRef.$literal;
  }
  throw new Error('Invalid ValueOrRef: expected object with $ref or $literal property');
}

/**
 * Evaluates an input mapping object, resolving all references.
 *
 * @param mapping - Object where values are either VariableRef or LiteralValue
 * @param context - The execution context
 * @returns Object with all references resolved to actual values
 *
 * @example
 * const mapping = {
 *   userId: { $ref: 'input.userId' },
 *   greeting: { $literal: 'Hello' }
 * };
 * evaluateInputMapping(mapping, context)
 * // => { userId: '123', greeting: 'Hello' }
 */
export function evaluateInputMapping(
  mapping: Record<string, ValueOrRef>,
  context: EvaluationContext,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, valueOrRef] of Object.entries(mapping)) {
    result[key] = evaluateValueOrRef(valueOrRef, context);
  }
  return result;
}
