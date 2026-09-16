import type { GetWorkflowRunByIdResponse } from '@mastra/client-js';
import type { WorkflowRunState } from '@mastra/core/workflows';

import type { WorkflowRunStreamResult } from './context/workflow-run-context';

export function convertWorkflowRunStateToStreamResult(
  runState: WorkflowRunState | GetWorkflowRunByIdResponse,
): WorkflowRunStreamResult {
  const { input, ...recordedSteps } =
    'context' in runState ? runState.context : { ...runState.steps, input: runState.payload };
  const steps: WorkflowRunStreamResult['steps'] = {};

  for (const [stepId, stepResult] of Object.entries(recordedSteps)) {
    if (Array.isArray(stepResult)) continue;
    const hasTripwire = stepResult.status === 'failed' && 'tripwire' in stepResult && stepResult.tripwire !== undefined;
    steps[stepId] = { ...stepResult, ...(hasTripwire ? { error: undefined } : {}) };
  }

  const suspended = Object.entries(steps).flatMap(([stepId, step]) => {
    if (step.status !== 'suspended') return [];
    const nestedPath = step.suspendPayload?.__workflow_meta?.path;
    return [nestedPath ? [stepId, ...nestedPath] : [stepId]];
  });
  const suspendedStep = suspended[0]?.[0];
  const tripwire = 'tripwire' in runState ? runState.tripwire : undefined;

  return {
    input,
    steps,
    status: runState.status,
    ...(runState.status === 'success' ? { result: runState.result } : {}),
    ...(runState.status === 'failed' ? { error: runState.error } : {}),
    ...(runState.status === 'suspended'
      ? { suspended, suspendPayload: suspendedStep ? steps[suspendedStep]?.suspendPayload : undefined }
      : {}),
    ...(runState.status === 'tripwire' && tripwire ? { tripwire } : {}),
  };
}

export function isWorkflowRunFinished(status?: string) {
  return ['success', 'failed', 'canceled', 'bailed', 'tripwire'].includes(status ?? '');
}

export function getRunTimestamp(value: Date | string | number | undefined): number | undefined {
  if (value === undefined) return undefined;
  const timestamp = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : undefined;
}
