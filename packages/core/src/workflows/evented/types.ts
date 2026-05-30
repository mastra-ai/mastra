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

export function markForeachStepResult<T extends object>(
  result: T,
  completedIndex?: number,
): T & ForeachStepResultMarker {
  const prototype = Object.getPrototypeOf(result);
  const marked =
    prototype === Object.prototype || prototype === null
      ? ({ ...result } as T & ForeachStepResultMarker)
      : // Non-plain results may carry prototype serializers or private fields.
        // Keep the original reference so those serializers still execute correctly.
        (result as T & ForeachStepResultMarker);

  Object.defineProperty(marked, FOREACH_STEP_RESULT_KEY, {
    value: true,
    enumerable: true,
    configurable: true,
  });

  if (completedIndex !== undefined) {
    Object.defineProperty(marked, FOREACH_COMPLETED_INDEXES_KEY, {
      value: [completedIndex],
      enumerable: true,
      configurable: true,
    });
  }

  return marked;
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
