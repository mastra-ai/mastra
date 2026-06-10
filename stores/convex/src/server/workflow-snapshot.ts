// NOTE: This mirrors packages/core/src/storage/workflow-snapshot.ts. The Convex
// server runtime can't import @mastra/core, so keep both copies in sync. Convex
// receives JSON-parsed payloads from the adapter, so serialization happens first.
const PENDING_MARKER_KEY = '__mastra_pending__';
const FOREACH_STEP_RESULT_KEY = '__mastra_foreach__';
const FOREACH_COMPLETED_INDEXES_KEY = '__mastra_foreach_completed_indexes__';

function isPendingMarker(val: unknown): boolean {
  return (
    val !== null &&
    typeof val === 'object' &&
    Object.prototype.hasOwnProperty.call(val, PENDING_MARKER_KEY) &&
    (val as Record<string, unknown>)[PENDING_MARKER_KEY] === true &&
    Object.keys(val).length === 1
  );
}

function isSuspendedStepResult(val: unknown): boolean {
  const result = val as Record<string, unknown> | null;
  const suspendPayload = result?.suspendPayload;

  return (
    val !== null &&
    typeof val === 'object' &&
    'status' in val &&
    result?.status === 'suspended' &&
    typeof result.suspendedAt === 'number' &&
    suspendPayload !== null &&
    typeof suspendPayload === 'object' &&
    '__workflow_meta' in suspendPayload
  );
}

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

function getForeachCompletedIndexes(result: unknown): Set<number> {
  const indexes = (result as Record<string, unknown> | null)?.[FOREACH_COMPLETED_INDEXES_KEY];
  if (!Array.isArray(indexes)) {
    return new Set();
  }

  return new Set(indexes.filter(index => Number.isInteger(index) && index >= 0));
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

export function createEmptyWorkflowSnapshot(runId: string): Record<string, any> {
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
  };
}

export function mergeWorkflowStepResult({
  snapshot,
  stepId,
  result,
  requestContext,
}: {
  snapshot: Record<string, any>;
  stepId: string;
  result: Record<string, any>;
  requestContext: Record<string, any>;
}): Record<string, any> {
  if (!snapshot?.context) {
    throw new Error(`Snapshot context not found for runId ${snapshot?.runId}`);
  }

  const existingResult = snapshot.context[stepId];
  const hasForeachMarker = hasForeachStepResultMarker(result);
  const completedIndexes = getForeachCompletedIndexes(result);
  const resultToStore = stripForeachStepResultMarker(result);
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
    snapshot.context[stepId] = {
      ...existingResult,
      // Pending-marker writes are reset commands built from an earlier snapshot,
      // so keep existing step-level fields and ignore sibling values they carry.
      ...(hasPendingMarker ? {} : resultToStore),
      ...(hasPendingMarker ? {} : completedIndexesToStore),
      output: mergedOutput,
    };
  } else {
    snapshot.context[stepId] = resultToStore;
  }

  snapshot.requestContext = { ...snapshot.requestContext, ...requestContext };
  return JSON.parse(JSON.stringify(snapshot.context));
}
