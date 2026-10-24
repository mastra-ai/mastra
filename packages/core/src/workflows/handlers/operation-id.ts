import type { ExecutionContext } from '../types';

/**
 * Scopes a durable operation id to the current occurrence of the operation.
 *
 * The same call site can run many times in one workflow run (loop iterations,
 * foreach items). Replay engines memoize by operation id, so each occurrence
 * needs a distinct id. The first loop iteration outside of a foreach keeps the
 * legacy id unchanged so in-flight runs replay against the ids they recorded.
 */
export function scopeOperationId(
  operationId: string,
  executionContext: Pick<ExecutionContext, 'loopIteration' | 'foreachIndex'>,
): string {
  const { loopIteration, foreachIndex } = executionContext;
  let scoped = operationId;
  if (loopIteration !== undefined && loopIteration > 1) {
    scoped += `.iter.${loopIteration}`;
  }
  if (foreachIndex !== undefined) {
    scoped += `.fe.${foreachIndex}`;
  }
  return scoped;
}
