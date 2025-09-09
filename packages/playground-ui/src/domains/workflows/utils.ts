import type { WorkflowRunState, StepResult } from '@mastra/core/workflows';

import { WorkflowWatchResult } from '@mastra/client-js';
import { StreamChunk } from '@/types';

export function convertWorkflowRunStateToWatchResult(runState: WorkflowRunState): WorkflowWatchResult {
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

export const mapWorkflowStreamChunkToWatchResult = (
  prev: WorkflowWatchResult,
  chunk: StreamChunk,
): WorkflowWatchResult => {
  if (chunk.type === 'workflow-start') {
    return {
      ...prev,
      runId: chunk.runId,
      eventTimestamp: new Date(),
      payload: {
        ...(prev?.payload || {}),
        workflowState: {
          ...prev?.payload?.workflowState,
          status: 'running',
          steps: {},
        },
      },
    };
  }

  if (chunk.type === 'workflow-step-start') {
    const current = prev?.payload?.workflowState?.steps?.[chunk.payload.id] || {};

    return {
      ...prev,
      payload: {
        ...prev.payload,
        currentStep: {
          id: chunk.payload.id,
          ...chunk.payload,
        },
        workflowState: {
          ...prev.payload.workflowState,
          steps: {
            ...prev.payload.workflowState.steps,
            [chunk.payload.id]: {
              ...(current || {}),
              ...chunk.payload,
            },
          },
        },
      },
      eventTimestamp: new Date(),
    };
  }

  if (chunk.type === 'workflow-step-suspended') {
    const current = prev?.payload?.workflowState?.steps?.[chunk.payload.id] || {};

    return {
      ...prev,
      payload: {
        ...prev.payload,
        currentStep: {
          id: chunk.payload.id,
          ...(prev?.payload?.currentStep || {}),
          ...chunk.payload,
        },
        workflowState: {
          ...prev.payload.workflowState,
          status: 'suspended',
          steps: {
            ...prev.payload.workflowState.steps,
            [chunk.payload.id]: {
              ...(current || {}),
              ...chunk.payload,
            },
          },
        },
      },
      eventTimestamp: new Date(),
    };
  }

  if (chunk.type === 'workflow-step-waiting') {
    const current = prev?.payload?.workflowState?.steps?.[chunk.payload.id] || {};
    return {
      ...prev,
      payload: {
        ...prev.payload,
        currentStep: {
          id: chunk.payload.id,
          ...(prev?.payload?.currentStep || {}),
          ...chunk.payload,
        },
        workflowState: {
          ...prev.payload.workflowState,
          status: 'waiting',
          steps: {
            ...prev.payload.workflowState.steps,
            [chunk.payload.id]: {
              ...current,
              ...chunk.payload,
            },
          },
        },
      },
      eventTimestamp: new Date(),
    };
  }

  if (chunk.type === 'workflow-step-result') {
    const status = chunk.payload.status;
    const current = prev?.payload?.workflowState?.steps?.[chunk.payload.id] || {};

    return {
      ...prev,
      payload: {
        ...prev.payload,
        currentStep: {
          id: chunk.payload.id,
          ...(prev?.payload?.currentStep || {}),
          ...chunk.payload,
        },
        workflowState: {
          ...prev.payload.workflowState,
          status,
          steps: {
            ...prev.payload.workflowState.steps,
            [chunk.payload.id]: {
              ...current,
              ...chunk.payload,
            },
          },
        },
      },
      eventTimestamp: new Date(),
    };
  }

  if (chunk.type === 'workflow-canceled') {
    return {
      ...prev,
      payload: {
        ...prev.payload,
        workflowState: {
          ...prev.payload.workflowState,
          status: 'canceled',
        },
      },
      eventTimestamp: new Date(),
    };
  }

  if (chunk.type === 'workflow-finish') {
    return {
      ...prev,
      payload: {
        ...prev.payload,
        currentStep: undefined,
        workflowState: {
          ...prev.payload.workflowState,
          status: chunk.payload.workflowStatus,
        },
      },
      eventTimestamp: new Date(),
    };
  }

  return prev;
};
