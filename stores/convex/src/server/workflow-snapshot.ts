const PENDING_MARKER_KEY = '__mastra_pending__';

function isPendingMarker(val: unknown): boolean {
  return (
    val !== null &&
    typeof val === 'object' &&
    PENDING_MARKER_KEY in val &&
    (val as Record<string, unknown>)[PENDING_MARKER_KEY] === true
  );
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
    for (let i = 0; i < Math.max(existingOutput.length, newOutput.length); i++) {
      if (i < newOutput.length) {
        const newVal = newOutput[i];
        if (isPendingMarker(newVal)) {
          mergedOutput[i] = null;
        } else if (newVal !== null) {
          mergedOutput[i] = newVal;
        } else if (i >= existingOutput.length) {
          mergedOutput[i] = null;
        }
      }
    }
    snapshot.context[stepId] = {
      ...existingResult,
      ...result,
      output: mergedOutput,
    };
  } else {
    snapshot.context[stepId] = result;
  }

  snapshot.requestContext = { ...snapshot.requestContext, ...requestContext };
  return JSON.parse(JSON.stringify(snapshot.context));
}
