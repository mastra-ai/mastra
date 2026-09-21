import type { WorkflowRunState } from '../workflows';
import type { WorkflowSnapshotHandoffCanonicalState, WorkflowSnapshotHandoffCursor } from './types';

const WORKFLOW_HANDOFF_UNSAFE_JSON_UNICODE_ESCAPE_RE = new RegExp(
  String.raw`(?<!\\)((?:\\\\)*)(?:(\\u[Dd][89AaBb][0-9A-Fa-f]{2}\\u[Dd][CcDdEeFf][0-9A-Fa-f]{2})|\\u(?:0000|[Dd][89A-Fa-f][0-9A-Fa-f]{2}))`,
  'g',
);

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
  // Compare on the exact JSON projection durable adapters persist. Plain
  // JSON.stringify keeps enumerable properties assigned onto an Error (name,
  // cause, custom fields) and honors custom toJSON, so a live value and its
  // stored JSONB round-trip canonicalize identically. The single exception is
  // `message`: in-memory snapshot clones always expose it as an enumerable own
  // property while a fresh Error's is non-enumerable, so it is normalized away
  // to keep both sides on the durable-adapter projection.
  const serialized = JSON.stringify(value, (_key, nestedValue: unknown) => {
    if (nestedValue instanceof Error && typeof (nestedValue as { toJSON?: unknown }).toJSON !== 'function') {
      return Object.fromEntries(Object.entries(nestedValue).filter(([key]) => key !== 'message'));
    }
    return nestedValue;
  });
  if (serialized === undefined) return undefined;
  const sanitized = serialized
    .replace(WORKFLOW_HANDOFF_UNSAFE_JSON_UNICODE_ESCAPE_RE, '$1$2')
    .replace(/(^|[^\\])(\\(?!["\\/bfnrtu]))/g, '$1\\\\');
  return sortCanonicalJson(JSON.parse(sanitized));
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
  // PostgreSQL orders these columns under COLLATE "C" (UTF-8 byte order), which
  // is code-point order. Iterate code points so in-memory ordering matches
  // exactly; UTF-16 code-unit comparison would invert astral characters.
  const leftPoints = Array.from(left);
  const rightPoints = Array.from(right);
  const shared = Math.min(leftPoints.length, rightPoints.length);
  for (let index = 0; index < shared; index++) {
    const leftPoint = leftPoints[index]!.codePointAt(0)!;
    const rightPoint = rightPoints[index]!.codePointAt(0)!;
    if (leftPoint !== rightPoint) return leftPoint - rightPoint;
  }
  return leftPoints.length - rightPoints.length;
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
