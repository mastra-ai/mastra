import type { StreamVNextChunkType } from '@mastra/client-js/workflows';
import type { StepResult, WorkflowStreamResult } from '@mastra/core/workflows';

/** Reduces a native workflow stream chunk into Mastra's public run result. */
export const mapWorkflowStreamChunkToWatchResult = (
  prev: WorkflowStreamResult<any, any, any, any>,
  chunk: StreamVNextChunkType,
): WorkflowStreamResult<any, any, any, any> => {
  if (chunk.type === 'workflow-start') {
    return {
      input: prev?.input,
      status: 'running',
      steps: prev?.steps || {},
    };
  }

  if (chunk.type === 'workflow-canceled') {
    return { ...prev, status: 'canceled' };
  }

  if (chunk.type === 'workflow-finish') {
    const finalStatus = chunk.payload.workflowStatus;
    const prevSteps = prev?.steps ?? {};
    const lastStep = Object.values(prevSteps).pop();
    return {
      ...prev,
      status: chunk.payload.workflowStatus,
      ...(finalStatus === 'success' && lastStep?.status === 'success'
        ? { result: lastStep?.output }
        : finalStatus === 'failed' && lastStep?.status === 'failed'
          ? { error: lastStep?.error }
          : finalStatus === 'tripwire' && chunk.payload.tripwire
            ? { tripwire: chunk.payload.tripwire }
            : {}),
    };
  }

  const { stepCallId: _stepCallId, stepName: _stepName, ...newPayload } = chunk.payload ?? {};
  const newSteps = {
    ...prev?.steps,
    [chunk.payload.id]: {
      ...prev?.steps?.[chunk.payload.id],
      ...newPayload,
    },
  };

  if (chunk.type === 'workflow-step-start') return { ...prev, steps: newSteps };

  if (chunk.type === 'workflow-step-suspended') {
    const suspendedStepIds = Object.entries(newSteps as Record<string, StepResult<any, any, any, any>>).flatMap(
      ([stepId, stepResult]) => {
        if (stepResult?.status === 'suspended') {
          const nestedPath = stepResult?.suspendPayload?.__workflow_meta?.path;
          return nestedPath ? [[stepId, ...nestedPath]] : [[stepId]];
        }
        return [];
      },
    );
    return {
      ...prev,
      status: 'suspended',
      steps: newSteps,
      suspendPayload: chunk.payload.suspendPayload,
      suspended: suspendedStepIds as any,
    };
  }

  if (chunk.type === 'workflow-step-waiting') return { ...prev, status: 'waiting', steps: newSteps };

  if (chunk.type === 'workflow-step-progress') {
    return {
      ...prev,
      steps: {
        ...prev?.steps,
        [chunk.payload.id]: {
          ...prev?.steps?.[chunk.payload.id],
          foreachProgress: {
            completedCount: chunk.payload.completedCount,
            totalCount: chunk.payload.totalCount,
            currentIndex: chunk.payload.currentIndex,
            iterationStatus: chunk.payload.iterationStatus,
            iterationOutput: chunk.payload.iterationOutput,
          },
        },
      },
    };
  }

  if (chunk.type === 'workflow-step-result') return { ...prev, steps: newSteps };

  return prev;
};
