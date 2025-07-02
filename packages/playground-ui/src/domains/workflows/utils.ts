import type { WorkflowRunState, StepResult } from '@mastra/core/workflows';

import { ExtendedWorkflowWatchResult } from '@/hooks/use-workflows';

export function convertWorkflowRunStateToWatchResult(runState: WorkflowRunState): ExtendedWorkflowWatchResult {
  const runId = runState.runId;
  // Extract step information from the context
  const steps: Record<string, any> = {};
  const context = runState.context || {};

  // Convert each step in the context to the expected format
  Object.entries(context).forEach(([stepId, stepResult]) => {
    if (stepId !== 'input' && 'status' in stepResult) {
      const result = stepResult as StepResult<any, any, any, any>;
      steps[stepId] = {
        status: result.status,
        output: 'output' in result ? result.output : undefined,
        payload: 'payload' in result ? result.payload : undefined,
        resumePayload: 'resumePayload' in result ? result.resumePayload : undefined,
        error: 'error' in result ? result.error : undefined,
        startedAt: 'startedAt' in result ? result.startedAt : Date.now(),
        endedAt: 'endedAt' in result ? result.endedAt : undefined,
        suspendedAt: 'suspendedAt' in result ? result.suspendedAt : undefined,
        resumedAt: 'resumedAt' in result ? result.resumedAt : undefined,
      };
    }
  });

  // Determine the overall workflow status
  const status = determineWorkflowStatus(steps);

  return {
    type: 'watch',
    payload: {
      workflowState: {
        status,
        steps,
        result: runState.value,
        payload: context.input,
        error: undefined,
      },
    },
    eventTimestamp: new Date(runState.timestamp),
    runId,
  };
}

function determineWorkflowStatus(steps: Record<string, any>): 'running' | 'success' | 'failed' | 'suspended' {
  const stepStatuses = Object.values(steps).map(step => step.status);

  if (stepStatuses.includes('failed')) {
    return 'failed';
  }

  if (stepStatuses.includes('suspended')) {
    return 'suspended';
  }

  if (stepStatuses.every(status => status === 'success')) {
    return 'success';
  }

  return 'running';
}
