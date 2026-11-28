import type { ExecutionContext } from '../types';

type OccurrenceContext = Pick<ExecutionContext, 'loopIteration' | 'foreachIndex'> & {
  parentWorkflow?: Pick<NonNullable<ExecutionContext['parentWorkflow']>, 'occurrenceScope'>;
};

/**
 * Scopes a durable operation id to the current occurrence of the operation.
 *
 * The same call site can run many times in one workflow run (loop iterations,
 * foreach items, or a nested workflow re-entered by an ancestor loop). Replay
 * engines memoize by operation id, so each occurrence needs a distinct id. The
 * first loop iteration outside of a foreach, with no ancestor scope, keeps the
 * legacy id unchanged so in-flight runs replay against the ids they recorded.
 */
export function scopeOperationId(operationId: string, executionContext: OccurrenceContext): string {
  const { loopIteration, foreachIndex } = executionContext;
  let scoped = operationId + (executionContext.parentWorkflow?.occurrenceScope ?? '');
  if (loopIteration !== undefined && loopIteration > 1) {
    scoped += `.iter.${loopIteration}`;
  }
  if (foreachIndex !== undefined) {
    scoped += `.fe.${foreachIndex}`;
  }
  return scoped;
}

/**
 * Appends only the ancestor occurrence scope. For control-flow ids that already encode
 * their own iteration or index, so a nested workflow re-entered by a parent loop still
 * gets distinct ids while ids outside nested loops stay unchanged.
 */
export function withAncestorScope(operationId: string, executionContext: OccurrenceContext): string {
  return operationId + (executionContext.parentWorkflow?.occurrenceScope ?? '');
}

/**
 * Occurrence scope handed to a nested workflow started by `stepId`.
 *
 * A nested workflow outside a foreach runs under the parent's run id, so its own
 * loop counters restart on every parent iteration. Carrying the full ancestor path
 * (`.p.<stepId>.iter.<n>` per level) keeps its operation ids distinct without
 * deriving a new child run id. Foreach items already get their own child run id.
 */
export function nestedOccurrenceScope(stepId: string, executionContext: OccurrenceContext): string | undefined {
  let scope = executionContext.parentWorkflow?.occurrenceScope ?? '';
  const { loopIteration, foreachIndex } = executionContext;
  if (foreachIndex === undefined && loopIteration !== undefined && loopIteration > 1) {
    scope += `.p.${stepId}.iter.${loopIteration}`;
  }
  return scope || undefined;
}
