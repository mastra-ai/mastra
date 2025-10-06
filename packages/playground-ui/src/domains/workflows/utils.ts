import type { WorkflowRunState, StepResult } from '@mastra/core/workflows';

import { WorkflowWatchResult } from '@mastra/client-js';
import { StreamChunk } from '@/types';
import { WorkflowRunStreamResult } from './context/workflow-run-context';

export function convertWorkflowRunStateToStreamResult(runState: WorkflowRunState): WorkflowRunStreamResult {
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
  } as WorkflowRunStreamResult;
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
          steps: prev?.runId === chunk.runId ? (prev?.payload?.workflowState?.steps ?? {}) : {},
        },
      },
    };
  }

  if (chunk.type === 'workflow-step-start') {
    const current = prev?.payload?.workflowState?.steps?.[chunk.payload.id] || {};

    return {
      ...prev,
      runId: chunk.runId,
      payload: {
        ...prev.payload,
        currentStep: {
          id: chunk.payload.id,
          ...chunk.payload,
        },
        workflowState: {
          ...prev?.payload?.workflowState,
          steps: {
            ...prev?.payload?.workflowState?.steps,
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
      runId: chunk.runId,
      payload: {
        ...prev?.payload,
        currentStep: {
          id: chunk.payload.id,
          ...prev?.payload?.currentStep,
          ...chunk.payload,
        },
        workflowState: {
          ...prev?.payload?.workflowState,
          status: 'suspended',
          steps: {
            ...prev?.payload?.workflowState?.steps,
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
      runId: chunk.runId,
      payload: {
        ...prev?.payload,
        currentStep: {
          id: chunk.payload.id,
          ...(prev?.payload?.currentStep || {}),
          ...chunk.payload,
        },
        workflowState: {
          ...prev?.payload?.workflowState,
          status: 'waiting',
          steps: {
            ...prev?.payload?.workflowState?.steps,
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

    const next = {
      ...prev,
      runId: chunk.runId,
      payload: {
        ...prev?.payload,
        currentStep: {
          id: chunk.payload.id,
          ...(prev?.payload?.currentStep || {}),
          ...chunk.payload,
        },
        workflowState: {
          ...prev?.payload?.workflowState,
          status,
          steps: {
            ...prev?.payload?.workflowState?.steps,
            [chunk.payload.id]: {
              ...current,
              ...chunk.payload,
            },
          },
        },
      },
      eventTimestamp: new Date(),
    };

    return next;
  }

  if (chunk.type === 'workflow-canceled') {
    return {
      ...prev,
      runId: chunk.runId,
      payload: {
        ...prev?.payload,
        workflowState: {
          ...prev?.payload?.workflowState,
          status: 'canceled',
        },
      },
      eventTimestamp: new Date(),
    };
  }

  if (chunk.type === 'workflow-finish') {
    return {
      ...prev,
      runId: chunk.runId,
      payload: {
        ...prev?.payload,
        currentStep: undefined,
        workflowState: {
          ...prev?.payload?.workflowState,
          status: chunk.payload.workflowStatus,
        },
      },
      eventTimestamp: new Date(),
    };
  }

  return prev;
};
