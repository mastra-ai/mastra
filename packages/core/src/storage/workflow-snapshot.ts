import type { StepResult, WorkflowRunState } from '../workflows';
import { serializeWorkflowSnapshotValue } from '../workflows/snapshot-serialization';
import type { UpdateWorkflowStateOptions } from './types';

export { serializeWorkflowSnapshotValue };

const PENDING_MARKER_KEY = '__mastra_pending__';

function isPendingMarker(val: unknown): boolean {
  return (
    val !== null &&
    typeof val === 'object' &&
    PENDING_MARKER_KEY in val &&
    (val as Record<string, unknown>)[PENDING_MARKER_KEY] === true
  );
}

function isSuspendedStepResult(value: unknown): boolean {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const result = value as {
    status?: unknown;
    suspendedAt?: unknown;
    suspendPayload?: unknown;
  };

  return (
    result.status === 'suspended' &&
    typeof result.suspendedAt === 'number' &&
    result.suspendPayload !== null &&
    typeof result.suspendPayload === 'object' &&
    '__workflow_meta' in result.suspendPayload
  );
}

function hasPartialForeachValue(output: unknown[]): boolean {
  return output.some(value => value === null || isPendingMarker(value) || isSuspendedStepResult(value));
}

function hasForeachPayload(result: unknown): boolean {
  return Array.isArray((result as { payload?: unknown })?.payload);
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

  const serializedResult = serializeWorkflowSnapshotValue(result);
  const existingResult = snapshot.context[stepId];
  if (
    existingResult &&
    'output' in existingResult &&
    Array.isArray(existingResult.output) &&
    serializedResult &&
    typeof serializedResult === 'object' &&
    'output' in serializedResult &&
    Array.isArray(serializedResult.output) &&
    (hasForeachPayload(existingResult) || hasForeachPayload(serializedResult)) &&
    (hasPartialForeachValue(existingResult.output) || hasPartialForeachValue(serializedResult.output))
  ) {
    const existingOutput = existingResult.output as unknown[];
    const newOutput = serializedResult.output as unknown[];
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
      ...(serializedResult as any),
      output: mergedOutput,
    };
  } else {
    snapshot.context[stepId] = serializedResult;
  }

  snapshot.requestContext = { ...snapshot.requestContext, ...requestContext };
  return JSON.parse(JSON.stringify(snapshot.context));
}

export function mergeWorkflowState({
  snapshot,
  opts,
}: {
  snapshot: WorkflowRunState;
  opts: UpdateWorkflowStateOptions;
}): WorkflowRunState {
  return serializeWorkflowSnapshotValue({ ...snapshot, ...opts }) as WorkflowRunState;
}
