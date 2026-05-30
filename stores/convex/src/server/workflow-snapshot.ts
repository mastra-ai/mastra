// NOTE: This mirrors packages/core/src/storage/workflow-snapshot.ts. The Convex
// server runtime can't import @mastra/core, so keep both copies in sync.
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

function hasForeachPayload(result: unknown): boolean {
  return Array.isArray((result as { payload?: unknown })?.payload);
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
    (hasPendingMarker ||
      ((hasForeachPayload(existingResult) || hasForeachPayload(result)) &&
        (hasPartialForeachValue(existingOutput) || hasPartialForeachValue(newOutput))))
  ) {
    const mergedOutput = [...existingOutput];
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
      ...(hasPendingMarker ? {} : result),
      output: mergedOutput,
    };
  } else {
    snapshot.context[stepId] = result;
  }

  snapshot.requestContext = { ...snapshot.requestContext, ...requestContext };
  return JSON.parse(JSON.stringify(snapshot.context));
}
