// this is temporary
/** Derived status of a trace, computed from the root span's error and endedAt fields. */
export enum TraceStatus {
  SUCCESS = 'success',
  ERROR = 'error',
  RUNNING = 'running',
}

/**
 * Computes the trace status from a root span's error and endedAt fields.
 * - ERROR: if error is present (regardless of endedAt)
 * - RUNNING: if endedAt is null/undefined and no error
 * - SUCCESS: if endedAt is present and no error
 */
export function computeTraceStatus(span: { error?: unknown; endedAt?: Date | string | null }): TraceStatus {
  if (span.error != null) return TraceStatus.ERROR;
  if (span.endedAt == null) return TraceStatus.RUNNING;
  return TraceStatus.SUCCESS;
}
