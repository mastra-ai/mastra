import type { WorkflowRunState } from '@mastra/core/workflows';
import { randomUUID } from 'crypto';
import { expect } from 'vitest';

export const checkWorkflowSnapshot = (snapshot: WorkflowRunState | string, stepId: string, status: string) => {
  if (typeof snapshot === 'string') {
    throw new Error('Expected WorkflowRunState, got string');
  }
  expect(snapshot.context?.[stepId]?.status).toBe(status);
};

export const createSampleWorkflowSnapshot = (status: string, createdAt?: Date) => {
  const runId = `run-${randomUUID()}`;
  const stepId = `step-${randomUUID()}`;
  const timestamp = createdAt || new Date();
  const snapshot = {
    result: { success: true },
    value: {},
    context: {
      [stepId]: {
        status,
        payload: {},
        error: undefined,
        startedAt: timestamp.getTime(),
        endedAt: new Date(timestamp.getTime() + 15000).getTime(),
      },
      input: {},
    },
    serializedStepGraph: [],
    activePaths: [],
    suspendedPaths: {},
    waitingPaths: {},
    runId,
    timestamp: timestamp.getTime(),
    status: status as WorkflowRunState['status'],
  } as WorkflowRunState;
  return { snapshot, runId, stepId };
};
