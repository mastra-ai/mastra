const FRAMEWORK_CONDITION = Symbol.for('mastra.workflows.frameworkCondition');

/**
 * Marks a loop condition built by the framework, such as an agent loop. It does its own
 * I/O and error delivery, so engines leave its errors alone: the default engine rethrows
 * them, and the evented engine redelivers them unless the condition marked them
 * non-redeliverable.
 */
export function markFrameworkCondition<T extends object>(condition: T): T {
  Object.defineProperty(condition, FRAMEWORK_CONDITION, { value: true });
  return condition;
}

export function isFrameworkCondition(condition: unknown): boolean {
  return typeof condition === 'function' && (condition as any)[FRAMEWORK_CONDITION] === true;
}
