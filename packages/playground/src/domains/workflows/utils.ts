import type { GetWorkflowRunByIdResponse } from '@mastra/client-js';
import type { WorkflowRunState } from '@mastra/core/workflows';

import type { WorkflowRunStreamResult } from './context/workflow-run-context';

export function convertWorkflowRunStateToStreamResult(
  runState: WorkflowRunState | GetWorkflowRunByIdResponse,
): WorkflowRunStreamResult {
  const { input, ...recordedSteps } =
    'context' in runState ? runState.context : { ...runState.steps, input: runState.payload };
  const steps: WorkflowRunStreamResult['steps'] = Object.fromEntries(
    Object.entries(recordedSteps).flatMap(([stepId, recordedStep]) => {
      const stepResult = Array.isArray(recordedStep)
        ? (recordedStep.find(result => result?.status === 'suspended') ?? recordedStep[0])
        : recordedStep;
      if (!stepResult) return [];
      const hasTripwire =
        stepResult.status === 'failed' && 'tripwire' in stepResult && stepResult.tripwire !== undefined;
      return [
        [
          stepId,
          {
            ...stepResult,
            ...(Array.isArray(recordedStep)
              ? {
                  payload: recordedStep.map(result => result?.payload),
                  output: recordedStep.map(result => result?.output),
                }
              : {}),
            ...(hasTripwire ? { error: undefined } : {}),
          },
        ] as const,
      ];
    }),
  );

  const suspended = Object.entries(steps).flatMap(([stepId, step]) => {
    if (step.status !== 'suspended') return [];
    const path = step.suspendPayload?.__workflow_meta?.path;
    const nestedPath = Array.isArray(path) ? path.filter((part): part is string => typeof part === 'string') : [];
    return [nestedPath[0] === stepId ? nestedPath : [stepId, ...nestedPath]];
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
