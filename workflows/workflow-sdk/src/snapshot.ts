import type { WorkflowRunState } from '@mastra/core/workflows';

/**
 * Key under which a run's Workflow SDK run id is mirrored into its Mastra
 * snapshot.
 *
 * `start()` assigns its own run id and will not take Mastra's, so the two id
 * spaces stay separate. Hook tokens are derived from the Mastra id and so work
 * from anywhere, but reading a run's event stream, cancelling it, and awaiting
 * its outcome all need the Workflow SDK id — which a process that did not start
 * the run has no other way to learn. Mirroring it onto the snapshot is what
 * makes `resume()`, `watch()` and `cancel()` work from a second process.
 */
export const SDK_RUN_ID_SNAPSHOT_KEY = 'workflowSdkRunId';

/** A Mastra snapshot carrying the Workflow SDK run id mirror. */
export type SnapshotWithSdkRunId = WorkflowRunState & {
  [SDK_RUN_ID_SNAPSHOT_KEY]?: string;
};

/**
 * Key under which each suspended step's live resume hook token is mirrored
 * into the snapshot, keyed by qualified step id.
 *
 * Hook tokens are single-use, so a step that suspends more than once in a run
 * (loop iterations, suspend-after-resume) parks on a fresh token each time.
 * `resume()` reads the current token from here instead of reconstructing the
 * first-park token from the run and step ids alone.
 */
export const SUSPEND_TOKENS_SNAPSHOT_KEY = 'suspendTokens';

/** Reads the mirrored suspend tokens back off a stored snapshot. */
export function readSuspendTokens(snapshot: WorkflowRunState | null | undefined): Record<string, string> {
  const value = (snapshot as (WorkflowRunState & { [SUSPEND_TOKENS_SNAPSHOT_KEY]?: unknown }) | null | undefined)?.[
    SUSPEND_TOKENS_SNAPSHOT_KEY
  ];
  return value && typeof value === 'object' ? (value as Record<string, string>) : {};
}

/** Reads the mirrored Workflow SDK run id back off a stored snapshot. */
export function readSdkRunId(snapshot: WorkflowRunState | null | undefined): string | undefined {
  const value = (snapshot as SnapshotWithSdkRunId | null | undefined)?.[SDK_RUN_ID_SNAPSHOT_KEY];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/**
 * Adds the mirror to a snapshot, leaving an already-stored id in place when the
 * caller has nothing better to write.
 *
 * Snapshots are persisted whole rather than patched, so an unconditional write
 * of an absent id would erase a mapping a previous write had established.
 */
export function withSdkRunId<T extends WorkflowRunState>(
  snapshot: T,
  sdkRunId: string | undefined,
): T & SnapshotWithSdkRunId {
  const existing = readSdkRunId(snapshot);
  const resolved = sdkRunId ?? existing;
  if (!resolved) {
    return snapshot;
  }
  return { ...snapshot, [SDK_RUN_ID_SNAPSHOT_KEY]: resolved };
}
