/**
 * Types and utilities for evented workflow execution.
 */

/**
 * String key used to mark pending forEach iterations.
 * Using a string key (not Symbol) ensures the marker survives JSON serialization
 * which is critical for distributed execution where state is persisted to storage
 * and loaded by different engine instances.
 */
export const PENDING_MARKER_KEY = '__mastra_pending__' as const;
export const FOREACH_STEP_RESULT_KEY = '__mastra_foreach__' as const;
export const FOREACH_COMPLETED_INDEXES_KEY = '__mastra_foreach_completed_indexes__' as const;

/**
 * Type for the pending marker object used in forEach iteration tracking.
 */
export type PendingMarker = { [PENDING_MARKER_KEY]: true };
export type ForeachStepResultMarker = {
  [FOREACH_STEP_RESULT_KEY]: true;
  [FOREACH_COMPLETED_INDEXES_KEY]?: number[];
};

/**
 * Creates a new pending marker object.
 * Used to mark forEach iterations that are about to be resumed.
 */
export function createPendingMarker(): PendingMarker {
  return { [PENDING_MARKER_KEY]: true };
}

/**
 * Tags a foreach step result with the transport-only `__mastra_foreach__` marker
 * (plus optionally the completed iteration index) that storage merge logic uses
 * to apply element-wise output merging. Foreach step results are plain JSON-safe
 * objects, so this always shallow-copies — never mutates the input.
 */
export function markForeachStepResult<T extends object>(
  result: T,
  completedIndex?: number,
): T & ForeachStepResultMarker {
  return {
    ...result,
    [FOREACH_STEP_RESULT_KEY]: true,
    ...(completedIndex !== undefined ? { [FOREACH_COMPLETED_INDEXES_KEY]: [completedIndex] } : {}),
  } as T & ForeachStepResultMarker;
}

/**
 * Type guard to check if a value is a pending marker.
 * Works correctly after JSON serialization/deserialization.
 * @param val - The value to check
 * @returns True if the value is a PendingMarker
 */
export function isPendingMarker(val: unknown): val is PendingMarker {
  return (
    val !== null &&
    typeof val === 'object' &&
    Object.prototype.hasOwnProperty.call(val, PENDING_MARKER_KEY) &&
    (val as Record<string, unknown>)[PENDING_MARKER_KEY] === true &&
    Object.keys(val).length === 1
  );
}

/**
 * Identifies engine-produced suspended step results (as opposed to user outputs
 * that merely look like `{ status: 'suspended' }`). Engine suspends always carry
 * a numeric `suspendedAt` and a `suspendPayload.__workflow_meta` object, so all
 * three are required. Works after JSON serialization/deserialization.
 */
export function isSuspendedStepResult(val: unknown): boolean {
  const result = val as Record<string, unknown> | null;
  const suspendPayload = result?.suspendPayload;

  return (
    val !== null &&
    typeof val === 'object' &&
    'status' in val &&
    result?.status === 'suspended' &&
    typeof result.suspendedAt === 'number' &&
    suspendPayload !== null &&
    typeof suspendPayload === 'object' &&
    '__workflow_meta' in suspendPayload
  );
}

/**
 * Reads the completed iteration indexes recorded on a foreach step result.
 * Returns an empty set for results without the marker (e.g. legacy snapshots).
 */
export function getForeachCompletedIndexes(result: unknown): Set<number> {
  const indexes = (result as Record<string, unknown> | null)?.[FOREACH_COMPLETED_INDEXES_KEY];
  if (!Array.isArray(indexes)) {
    return new Set();
  }

  return new Set(indexes.filter(index => Number.isInteger(index) && index >= 0));
}

/**
 * Removes the internal completed-indexes bookkeeping from a foreach step result
 * before it is exposed outside the merge machinery (final results, watch events).
 */
export function stripForeachCompletedIndexes<T>(result: T): T {
  if (!result || typeof result !== 'object' || !(FOREACH_COMPLETED_INDEXES_KEY in result)) {
    return result;
  }

  const { [FOREACH_COMPLETED_INDEXES_KEY]: _completedIndexes, ...cleanResult } = result as Record<string, unknown>;
  return cleanResult as T;
}
