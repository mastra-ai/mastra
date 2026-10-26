import type { StepResult, WorkflowRunState } from '../workflows';

// NOTE: This merge logic is duplicated in stores/convex/src/server/workflow-snapshot.ts
// for the Convex server runtime. Keep both copies in sync.
const PENDING_MARKER_KEY = '__mastra_pending__';

function isPendingMarker(val: unknown): boolean {
  return (
    val !== null &&
    typeof val === 'object' &&
    Object.prototype.hasOwnProperty.call(val, PENDING_MARKER_KEY) &&
    (val as Record<string, unknown>)[PENDING_MARKER_KEY] === true &&
    Object.keys(val).length === 1
  );
}

// Suspended forEach iteration results may come from multiple engines. Treat
// StepResult-shaped suspended entries as resettable without relying only on
// evented __workflow_meta, but avoid matching plain user outputs with only
// status/payload fields.
function isSuspendedStepResult(val: unknown): boolean {
  const result = val as Record<string, unknown> | null;

  return (
    val !== null &&
    typeof val === 'object' &&
    'status' in val &&
    result?.status === 'suspended' &&
    ('suspendPayload' in val || 'suspendedAt' in val)
  );
}

function canResetWithPendingMarker(val: unknown): boolean {
  if (val == null || isPendingMarker(val)) {
    return true;
  }

  return (
    isSuspendedStepResult(val) ||
    (typeof val === 'object' && '__mastra_foreach_queued__' in val && val.__mastra_foreach_queued__ === true)
  );
}

export function createEmptyWorkflowSnapshot(runId: string): WorkflowRunState {
  return {
    context: {},
    activePaths: [],
    activeStepsPath: {},
    timestamp: Date.now(),
    suspendedPaths: {},
    resumeLabels: {},
    serializedStepGraph: [],
    value: {},
    waitingPaths: {},
    status: 'pending',
    runId,
  } as WorkflowRunState;
}

export function mergeWorkflowStepResult({
  snapshot,
  stepId,
  result,
  requestContext,
  state,
}: {
  snapshot: WorkflowRunState;
  stepId: string;
  result: StepResult<any, any, any, any>;
  requestContext: Record<string, any>;
  state?: Record<string, any>;
}): Record<string, StepResult<any, any, any, any>> {
  if (!snapshot?.context) {
    throw new Error(`Snapshot context not found for runId ${snapshot?.runId}`);
  }

  const existingResult = snapshot.context[stepId];
  if (
    existingResult &&
    'output' in existingResult &&
    Array.isArray(existingResult.output) &&
    result &&
    typeof result === 'object' &&
    'output' in result &&
    Array.isArray(result.output)
  ) {
    const existingOutput = existingResult.output as unknown[];
    const newOutput = result.output as unknown[];
    const mergedOutput = [...existingOutput];
    const hasPendingMarker = newOutput.some(isPendingMarker);
    for (let i = 0; i < Math.max(existingOutput.length, newOutput.length); i++) {
      if (i < newOutput.length) {
        const newVal = newOutput[i];
        if (isPendingMarker(newVal)) {
          if (i >= existingOutput.length || canResetWithPendingMarker(existingOutput[i])) {
            mergedOutput[i] = null;
          }
        } else if (newVal !== null && newVal !== undefined && !hasPendingMarker) {
          mergedOutput[i] = newVal;
        } else if (i >= existingOutput.length) {
          mergedOutput[i] = null;
        }
      }
    }
    snapshot.context[stepId] = {
      ...existingResult,
      // Pending-marker writes are reset commands built from an earlier snapshot,
      // so keep existing step-level fields and ignore sibling values they carry.
      ...(hasPendingMarker ? {} : (result as any)),
      output: mergedOutput,
    };
  } else {
    snapshot.context[stepId] = result;
  }

  // Concurrent child starts and completions carry partial/stale foreach metadata.
  // Preserve the durable identity of every sibling, not just the last writer's child.
  if (existingResult?.metadata?.foreachNestedRunIds || result.metadata?.foreachNestedRunIds) {
    snapshot.context[stepId]!.metadata = {
      ...snapshot.context[stepId]!.metadata,
      foreachNestedRunIds: {
        ...existingResult?.metadata?.foreachNestedRunIds,
        ...snapshot.context[stepId]!.metadata?.foreachNestedRunIds,
      },
    };
  }

  if (state !== undefined) {
    (snapshot.context as Record<string, unknown>).__state = state;
  }

  snapshot.requestContext = { ...snapshot.requestContext, ...requestContext };
  try {
    return JSON.parse(JSON.stringify(snapshot.context));
  } catch {
    // Step results may contain non-serializable values (circular refs, functions, etc.)
    // when the workflow opts out of full persistence. Return a shallow copy so the
    // caller still gets a usable context without crashing.
    return { ...snapshot.context };
  }
}

/**
 * A successful run's `result` is usually the output of the step that ran last, so writing both
 * stores that output twice in one snapshot. When `result` is that same value, store the producing
 * step id in `resultFromStep` instead. `hydrateWorkflowSnapshotResult` restores `result` on read.
 */
export function dedupeWorkflowSnapshotResult(snapshot: WorkflowRunState): WorkflowRunState {
  const { result, context } = snapshot ?? {};
  if (snapshot?.status !== 'success' || result === undefined || result === null || typeof result !== 'object') {
    return snapshot;
  }
  if (!context || typeof context !== 'object') {
    return snapshot;
  }

  for (const [stepId, stepResult] of Object.entries(context)) {
    if (stepResult?.status === 'success' && 'output' in stepResult && stepResult.output === result) {
      const { result: _result, ...rest } = snapshot;
      return { ...rest, resultFromStep: stepId };
    }
  }
  return snapshot;
}

/**
 * Restore the `result` that `dedupeWorkflowSnapshotResult` replaced with a step reference.
 * Snapshots that still carry `result` inline are returned unchanged.
 */
export function hydrateWorkflowSnapshotResult<T extends WorkflowRunState | string | null | undefined>(snapshot: T): T {
  if (!snapshot || typeof snapshot !== 'object') {
    return snapshot;
  }
  const { resultFromStep, result, context } = snapshot as WorkflowRunState;
  if (resultFromStep === undefined) {
    return snapshot;
  }

  const { resultFromStep: _resultFromStep, ...rest } = snapshot as WorkflowRunState;
  if (result !== undefined) {
    return rest as T;
  }
  const stepResult = context?.[resultFromStep];
  if (stepResult?.status !== 'success') {
    return rest as T;
  }
  return { ...rest, result: stepResult.output } as T;
}
