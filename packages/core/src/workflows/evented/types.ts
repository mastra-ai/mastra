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

/**
 * Type for the pending marker object used in forEach iteration tracking.
 */
export type PendingMarker = { [PENDING_MARKER_KEY]: true };

/**
 * Creates a new pending marker object.
 * Used to mark forEach iterations that are about to be resumed.
 */
export function createPendingMarker(): PendingMarker {
  return { [PENDING_MARKER_KEY]: true };
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
    PENDING_MARKER_KEY in val &&
    (val as Record<string, unknown>)[PENDING_MARKER_KEY] === true
  );
}
