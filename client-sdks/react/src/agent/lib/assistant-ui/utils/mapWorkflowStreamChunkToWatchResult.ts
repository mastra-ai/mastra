import { WorkflowWatchResult } from '@mastra/client-js';

export type StreamChunk = {
  type: string;
  payload: any;
  runId: string;
  from: 'AGENT' | 'WORKFLOW';
};

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
