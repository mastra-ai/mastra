import type { WorkflowRunState } from '../workflows';

/** Raised when an ordinary native writer attempts to mutate a fenced run. */
export class WorkflowSnapshotHandoffFenceError extends TypeError {
  readonly code = 'WORKFLOW_SNAPSHOT_HANDOFF_FENCED';
  readonly workflowName: string;
  readonly runId: string;
  readonly handoffStatus: 'pending' | 'completed';

  constructor({
    workflowName,
    runId,
    handoffStatus,
  }: {
    workflowName: string;
    runId: string;
    handoffStatus: 'pending' | 'completed';
  }) {
    super(`Workflow snapshot handoff fence is held for ${workflowName}/${runId}`);
    this.name = 'WorkflowSnapshotHandoffFenceError';
    this.workflowName = workflowName;
    this.runId = runId;
    this.handoffStatus = handoffStatus;
  }
}

function canonicalize(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonicalize);
  const record = value as Record<string, unknown>;
  return Object.fromEntries(
    Object.keys(record)
      .sort()
      .map(key => [key, canonicalize(record[key])]),
  );
}

/** Compares the JSON-native snapshot representation independent of key order. */
export function workflowSnapshotHandoffSnapshotsEqual(left: WorkflowRunState, right: WorkflowRunState): boolean {
  try {
    return JSON.stringify(canonicalize(left)) === JSON.stringify(canonicalize(right));
  } catch {
    return false;
  }
}

export function validateWorkflowSnapshotHandoffFence(mutationFence: string): void {
  if (typeof mutationFence !== 'string' || mutationFence.length < 1 || mutationFence.length > 4096) {
    throw new TypeError('Workflow snapshot handoff mutationFence must be between 1 and 4096 characters');
  }
}

export function validateWorkflowSnapshotHandoffLimit(limit: number | undefined): number {
  const resolved = limit ?? 100;
  if (!Number.isSafeInteger(resolved) || resolved < 1 || resolved > 100) {
    throw new RangeError('Workflow snapshot handoff recovery limit must be between 1 and 100');
  }
  return resolved;
}
