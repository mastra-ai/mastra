import type { WorkflowRunState } from './types';

/**
 * Statuses a run can never leave for `suspended`. Waiting on these would only
 * delay a legitimate error.
 */
const TERMINAL_STATUSES = new Set(['success', 'failed', 'canceled']);

/** How long resume will wait for an in-flight suspend write to land. */
export const RESUME_SNAPSHOT_WAIT_MS = 2000;

const POLL_INTERVAL_MS = 50;

/**
 * Loads a run snapshot for resume, tolerating a suspend write that is still in
 * flight (issue #20747).
 *
 * Suspending persists the snapshot, and approving a tool call reads it back.
 * Those are two separate round trips, and on a large run the write can take
 * seconds — so an approval arriving promptly (a UI click, or another instance
 * reacting to the suspend event) could read either no row at all or a row still
 * marked `running`, and resume would fail with "This workflow run was not
 * suspended" even though the run was about to be perfectly resumable. The
 * reporter hit exactly this: a 15.5 s final save against a 4 s validation
 * window, surfacing as a 500 on Approve.
 *
 * Polling storage rather than awaiting an in-process signal is deliberate:
 * approvals routinely land on a different instance from the one that ran the
 * suspend, so the store is the only shared source of truth.
 *
 * Returns as soon as the run is `suspended`, gives up immediately on a terminal
 * status, and otherwise returns whatever it last saw once the budget expires so
 * the caller can raise its own error.
 */
export async function loadSnapshotForResume({
  workflowsStore,
  workflowName,
  runId,
  timeoutMs = RESUME_SNAPSHOT_WAIT_MS,
}: {
  workflowsStore: { loadWorkflowSnapshot: (args: { workflowName: string; runId: string }) => Promise<any> } | undefined;
  workflowName: string;
  runId: string;
  timeoutMs?: number;
}): Promise<WorkflowRunState | undefined> {
  if (!workflowsStore) return undefined;

  const deadline = Date.now() + timeoutMs;
  let snapshot = (await workflowsStore.loadWorkflowSnapshot({ workflowName, runId })) as
    | WorkflowRunState
    | undefined
    | null;

  while (!snapshot || snapshot.status !== 'suspended') {
    if (snapshot?.status && TERMINAL_STATUSES.has(snapshot.status)) break;
    if (Date.now() >= deadline) break;
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
    snapshot = (await workflowsStore.loadWorkflowSnapshot({ workflowName, runId })) as
      | WorkflowRunState
      | undefined
      | null;
  }

  return snapshot ?? undefined;
}
