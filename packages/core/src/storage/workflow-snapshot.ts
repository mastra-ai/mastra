import type { StepResult, WorkflowRunState } from '../workflows';
import {
  FOREACH_COMPLETED_INDEXES_KEY,
  FOREACH_STEP_RESULT_KEY,
  getForeachCompletedIndexes,
  isPendingMarker,
  isSuspendedStepResult,
} from '../workflows/evented/types';
import { serializeWorkflowSnapshotValue } from '../workflows/snapshot-serialization';
import type { UpdateWorkflowStateOptions } from './types';

export { serializeWorkflowSnapshotValue };

// NOTE: This merge logic is mirrored by stores that merge server-side and cannot
// import @mastra/core there: stores/convex/src/server/workflow-snapshot.ts,
// stores/mongodb (aggregation pipeline in domains/workflows) and stores/upstash
// (Lua script in domains/workflows). Keep all copies in sync when changing
// foreach marker or merge semantics.
//
// Foreach slot states, as seen by this merge (output[i] for iteration i):
// - missing / `null`            → pending: iteration not started, or reset for resume.
//                                 Exception: `null` with i in completed-indexes is a
//                                 completed iteration whose user output was null.
// - `{ __mastra_pending__ }`    → reset command: incoming-only value asking to null
//                                 out a resumable slot; never stored.
// - suspended step result       → iteration suspended (strict shape: numeric
//                                 suspendedAt + suspendPayload.__workflow_meta, so
//                                 user outputs shaped like { status: 'suspended' }
//                                 don't match).
// - anything else (non-null)    → completed iteration output.
// Writers tag foreach updates with `__mastra_foreach__` (stripped before storing)
// and record completed slots in `__mastra_foreach_completed_indexes__` (persisted)
// so stale concurrent writes can't clobber completed work.

function canResetWithPendingMarker(val: unknown): boolean {
  if (val == null || isPendingMarker(val)) {
    return true;
  }

  return isSuspendedStepResult(val);
}

function hasPartialForeachValue(output: unknown[]): boolean {
  for (let i = 0; i < output.length; i++) {
    if (!(i in output)) return true;
    const value = output[i];
    if (value === null || value === undefined || isPendingMarker(value) || isSuspendedStepResult(value)) return true;
  }
  return false;
}

function hasForeachStepResultMarker(result: unknown): boolean {
  return (result as Record<string, unknown> | null)?.[FOREACH_STEP_RESULT_KEY] === true;
}

function stripForeachStepResultMarker<T>(result: T): T {
  if (!hasForeachStepResultMarker(result)) {
    return result;
  }

  const { [FOREACH_STEP_RESULT_KEY]: _marker, ...rest } = result as Record<string, unknown>;
  return rest as T;
}

function mergeForeachCompletedIndexes(existingResult: unknown, incomingIndexes: Set<number>): number[] | undefined {
  const indexes = new Set([...getForeachCompletedIndexes(existingResult), ...incomingIndexes]);
  return indexes.size > 0 ? [...indexes].sort((a, b) => a - b) : undefined;
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
}: {
  snapshot: WorkflowRunState;
  stepId: string;
  result: StepResult<any, any, any, any>;
  requestContext: Record<string, any>;
}): Record<string, StepResult<any, any, any, any>> {
  if (!snapshot?.context) {
    throw new Error(`Snapshot context not found for runId ${snapshot?.runId}`);
  }

  const hasForeachMarker = hasForeachStepResultMarker(result);
  const completedIndexes = getForeachCompletedIndexes(result);
  const incomingResult = stripForeachStepResultMarker(result);
  const existingResult = snapshot.context[stepId];
  const existingCompletedIndexes = getForeachCompletedIndexes(existingResult);
  const mergedCompletedIndexes = mergeForeachCompletedIndexes(existingResult, completedIndexes);
  const completedIndexesToStore =
    mergedCompletedIndexes && hasForeachMarker
      ? { [FOREACH_COMPLETED_INDEXES_KEY]: mergedCompletedIndexes }
      : undefined;
  const existingOutput =
    existingResult && 'output' in existingResult && Array.isArray(existingResult.output)
      ? (existingResult.output as unknown[])
      : undefined;
  const newOutput =
    result && typeof result === 'object' && 'output' in result && Array.isArray(result.output)
      ? (result.output as unknown[])
      : undefined;
  const hasPendingMarker = newOutput?.some(isPendingMarker) ?? false;
  let mergedResult: StepResult<any, any, any, any>;
  if (
    existingResult &&
    existingOutput &&
    result &&
    typeof result === 'object' &&
    newOutput &&
    hasForeachMarker &&
    (hasPendingMarker || hasPartialForeachValue(existingOutput) || hasPartialForeachValue(newOutput))
  ) {
    const mergedOutput = [...existingOutput];
    for (let i = 0; i < Math.max(existingOutput.length, newOutput.length); i++) {
      if (i < newOutput.length) {
        const newVal = newOutput[i];
        if (isPendingMarker(newVal)) {
          if (i >= existingOutput.length || canResetWithPendingMarker(existingOutput[i])) {
            mergedOutput[i] = null;
          }
        } else if (completedIndexes.has(i) && !hasPendingMarker) {
          mergedOutput[i] = newVal;
        } else if (existingCompletedIndexes.has(i) && !hasPendingMarker) {
          continue;
        } else if (newVal !== null && newVal !== undefined && !hasPendingMarker) {
          mergedOutput[i] = newVal;
        } else if (i >= existingOutput.length) {
          mergedOutput[i] = null;
        }
      }
    }
    mergedResult = {
      ...existingResult,
      // Pending-marker writes are reset commands built from an earlier snapshot,
      // so keep existing step-level fields and ignore sibling values they carry.
      ...(hasPendingMarker ? {} : (incomingResult as any)),
      ...(hasPendingMarker ? {} : completedIndexesToStore),
      output: mergedOutput,
    };
  } else {
    mergedResult = incomingResult;
  }

  // The snapshot object is what storage adapters persist, so it gets the serialized
  // view (per-step response-message deltas, toJSON-applied values). The returned
  // context feeds back into engine runtime state via updateWorkflowResults, so the
  // merged step result must NOT be the serialized view there — replacing live values
  // with snapshot-serialized ones mid-run would, for example, swap cumulative AI SDK
  // response messages for per-step deltas in stream chunk payloads. A plain JSON
  // clone of the raw merged result keeps the pre-existing runtime contract.
  snapshot.context[stepId] = serializeWorkflowSnapshotValue(mergedResult);

  snapshot.requestContext = { ...snapshot.requestContext, ...requestContext };
  try {
    // Clone the other entries and the raw merged result separately — the stored
    // [stepId] entry would be cloned only to be overwritten.
    const { [stepId]: _storedEntry, ...otherEntries } = snapshot.context;
    const runtimeContext: Record<string, StepResult<any, any, any, any>> = JSON.parse(JSON.stringify(otherEntries));
    runtimeContext[stepId] = JSON.parse(JSON.stringify(mergedResult));
    return runtimeContext;
  } catch {
    // Step results may contain non-serializable values (circular refs, functions, etc.)
    // when the workflow opts out of full persistence. Return a shallow copy so the
    // caller still gets a usable context without crashing.
    return { ...snapshot.context, [stepId]: mergedResult };
  }
}

/**
 * Builds the runtime view of an `updateWorkflowResults` return for stores that
 * merge server-side (MongoDB aggregation, Upstash Lua, Convex server runtime)
 * and can therefore only hand back the serialized stored context. For
 * non-foreach results the stored entry is exactly the serialized incoming
 * result, so the raw result (JSON-cloned, matching `mergeWorkflowStepResult`'s
 * return contract) is the more faithful runtime value — e.g. it keeps
 * cumulative AI SDK response messages where the stored form holds per-step
 * deltas. Foreach-marked results are left alone: the server-side merge across
 * concurrent iteration writes is authoritative there.
 */
export function withRuntimeStepResult(
  context: Record<string, StepResult<any, any, any, any>>,
  stepId: string,
  result: StepResult<any, any, any, any>,
): Record<string, StepResult<any, any, any, any>> {
  if (hasForeachStepResultMarker(result)) {
    return context;
  }

  try {
    return { ...context, [stepId]: JSON.parse(JSON.stringify(result)) };
  } catch {
    return context;
  }
}

export function mergeWorkflowState({
  snapshot,
  opts,
}: {
  snapshot: WorkflowRunState;
  opts: UpdateWorkflowStateOptions;
}): WorkflowRunState {
  return {
    ...snapshot,
    ...(serializeWorkflowSnapshotValue(opts) as UpdateWorkflowStateOptions),
  } as WorkflowRunState;
}
