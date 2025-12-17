import type { WorkflowRunState, StepResult, TimeTravelContext } from '@mastra/core/workflows';

import { WorkflowRunStreamResult } from './context/workflow-run-context';

export function convertWorkflowRunStateToStreamResult(runState: WorkflowRunState): WorkflowRunStreamResult {
  // Extract step information from the context
  const steps: Record<string, any> = {};
  const context = runState.context || {};

  // Convert each step in the context to the expected format
  Object.entries(context).forEach(([stepId, stepResult]) => {
    if (stepId !== 'input' && 'status' in stepResult) {
      const result = stepResult as StepResult<any, any, any, any>;
      // Check if this is a tripwire (failed step with tripwire property)
      const hasTripwire = result.status === 'failed' && result.tripwire !== undefined;

      steps[stepId] = {
        status: result.status,
        output: 'output' in result ? result.output : undefined,
        payload: 'payload' in result ? result.payload : undefined,
        suspendPayload: 'suspendPayload' in result ? result.suspendPayload : undefined,
        suspendOutput: 'suspendOutput' in result ? result.suspendOutput : undefined,
        resumePayload: 'resumePayload' in result ? result.resumePayload : undefined,
        // Don't include error when tripwire is present - tripwire takes precedence
        error: hasTripwire ? undefined : 'error' in result ? result.error : undefined,
        tripwire: hasTripwire ? result.tripwire : undefined,
        startedAt: 'startedAt' in result ? result.startedAt : Date.now(),
        endedAt: 'endedAt' in result ? result.endedAt : undefined,
        suspendedAt: 'suspendedAt' in result ? result.suspendedAt : undefined,
        resumedAt: 'resumedAt' in result ? result.resumedAt : undefined,
      };
    }
  });

  const suspendedStepIds = Object.entries(steps as Record<string, StepResult<any, any, any, any>>).flatMap(
    ([stepId, stepResult]) => {
      if (stepResult?.status === 'suspended') {
        const nestedPath = stepResult?.suspendPayload?.__workflow_meta?.path;
        return nestedPath ? [[stepId, ...nestedPath]] : [[stepId]];
      }

      return [];
    },
  );

  const suspendedStep = suspendedStepIds?.[0]?.[0];

  const suspendPayload = suspendedStep ? steps[suspendedStep]?.suspendPayload : undefined;

  return {
    input: context.input,
    steps: steps,
    status: runState.status,
    ...(runState.status === 'success' ? { result: runState.result } : {}),
    ...(runState.status === 'failed' ? { error: runState.error } : {}),
    ...(runState.status === 'suspended' ? { suspended: suspendedStepIds, suspendPayload: suspendPayload } : {}),
    ...(runState.status === 'tripwire' && runState.tripwire
      ? {
          tripwire: {
            reason: runState.tripwire.reason,
            retry: runState.tripwire.retry,
            metadata: runState.tripwire.metadata,
            processorId: runState.tripwire.processorId,
          },
        }
      : {}),
  } as WorkflowRunStreamResult;
}
