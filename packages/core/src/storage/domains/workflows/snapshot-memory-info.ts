import type { WorkflowRunState } from '../../../workflows';

/**
 * Thread/resource memory info embedded in a persisted workflow-run snapshot.
 */
export type WorkflowSnapshotMemoryInfo = {
  threadId?: string;
  resourceId?: string;
};

/**
 * Extracts the memory info (threadId/resourceId) embedded in a workflow-run
 * snapshot. This is the canonical extraction: any storage adapter that
 * implements the best-effort `threadId` filter on `listWorkflowRuns` MUST
 * mirror these exact JSON paths in its query predicate (see
 * `StorageListWorkflowRunsInput['threadId']`).
 *
 * The snapshot stores memory info at one of two locations depending on which
 * loop produced it:
 *
 * 1. `agentic-loop` (dynamic step key):
 *    `context.<step where status === 'suspended'>.suspendPayload.__streamState.messageList.memoryInfo`
 * 2. Durable agentic-loop (fixed path):
 *    `context.input.messageListState.memoryInfo`
 *
 * If either path changes, update the SQL predicates in `@mastra/pg` and
 * `@mastra/libsql` (`listWorkflowRuns`) to match — otherwise they will wrongly
 * exclude rows that this extraction would match.
 */
export function getSnapshotMemoryInfo(
  snapshot: WorkflowRunState | null | undefined,
): WorkflowSnapshotMemoryInfo | undefined {
  for (const key in snapshot?.context) {
    const step = snapshot?.context[key];
    if (step && step.status === 'suspended' && step.suspendPayload?.__streamState) {
      return step.suspendPayload?.__streamState?.messageList?.memoryInfo;
    }
  }

  // Durable agentic-loop snapshots don't embed `__streamState` in suspend
  // payloads; their thread/resource info lives on the serialized workflow
  // input's message-list state instead.
  const durableMemoryInfo = (snapshot?.context as Record<string, any> | undefined)?.input?.messageListState?.memoryInfo;
  if (durableMemoryInfo && typeof durableMemoryInfo === 'object') {
    return durableMemoryInfo as WorkflowSnapshotMemoryInfo;
  }

  return undefined;
}
