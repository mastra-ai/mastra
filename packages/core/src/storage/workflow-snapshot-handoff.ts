import type { WorkflowRunState } from '../workflows';
import type { WorkflowSnapshotHandoffCanonicalState, WorkflowSnapshotHandoffCursor } from './types';

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

function sortCanonicalJson(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(sortCanonicalJson);
  const record = value as Record<string, unknown>;
  return Object.fromEntries(
    Object.keys(record)
      .sort()
      .map(key => [key, sortCanonicalJson(record[key])]),
  );
}

function canonicalize(value: unknown): unknown {
  const serialized = JSON.stringify(value, (_key, nestedValue: unknown) => {
    if (nestedValue instanceof Error && typeof (nestedValue as { toJSON?: unknown }).toJSON !== 'function') {
      return Object.fromEntries(
        Object.entries(nestedValue).filter(([key]) => !['cause', 'message', 'name', 'stack'].includes(key)),
      );
    }
    return nestedValue;
  });
  return serialized === undefined ? undefined : sortCanonicalJson(JSON.parse(serialized));
}

/** Materializes a handoff snapshot using the JSON representation persisted by durable adapters. */
export function materializeWorkflowSnapshotHandoffSnapshot(snapshot: WorkflowRunState): WorkflowRunState {
  const materialized = canonicalize(snapshot);
  if (materialized === undefined) throw new TypeError('Workflow snapshot handoff snapshot must be JSON-serializable');
  if (!materialized || typeof materialized !== 'object' || Array.isArray(materialized)) {
    throw new TypeError('Workflow snapshot handoff snapshot must be a JSON object');
  }
  return materialized as WorkflowRunState;
}

/** Compares the JSON-native snapshot representation independent of key order. */
export function workflowSnapshotHandoffSnapshotsEqual(left: WorkflowRunState, right: WorkflowRunState): boolean {
  try {
    const leftCanonical = canonicalize(left);
    const rightCanonical = canonicalize(right);
    if (leftCanonical === undefined || rightCanonical === undefined) return false;
    return JSON.stringify(leftCanonical) === JSON.stringify(rightCanonical);
  } catch {
    return false;
  }
}

export function workflowSnapshotHandoffCanonicalStatesEqual(
  left: WorkflowSnapshotHandoffCanonicalState,
  right: WorkflowSnapshotHandoffCanonicalState,
): boolean {
  if (left.kind !== right.kind) return false;
  if (left.kind === 'absent' || right.kind === 'absent') return true;
  return left.resourceId === right.resourceId && workflowSnapshotHandoffSnapshotsEqual(left.snapshot, right.snapshot);
}

function compareWorkflowSnapshotHandoffText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

/** Uses the same code-point tuple ordering for in-memory sort and cursor filtering. */
export function compareWorkflowSnapshotHandoffCursors(
  left: WorkflowSnapshotHandoffCursor,
  right: WorkflowSnapshotHandoffCursor,
): number {
  return (
    left.updatedAt - right.updatedAt ||
    compareWorkflowSnapshotHandoffText(left.workflowName, right.workflowName) ||
    compareWorkflowSnapshotHandoffText(left.runId, right.runId)
  );
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
