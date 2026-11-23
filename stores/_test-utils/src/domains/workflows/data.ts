import type { WorkflowRunState } from '@mastra/core/workflows';
import { randomUUID } from 'node:crypto';
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
    resumeLabels: {},
    waitingPaths: {},
    runId,
    timestamp: timestamp.getTime(),
    activeStepsPath: {},
    status: status as WorkflowRunState['status'],
  } as WorkflowRunState;
  return { snapshot, runId, stepId };
};

/**
 * A suspended snapshot carrying thread/resource memory info in one of the two
 * real layouts (see `getSnapshotMemoryInfo` in @mastra/core):
 *
 * - `agentic-loop`: under a dynamic suspended-step key at
 *   `context.<step>.suspendPayload.__streamState.messageList.memoryInfo`
 * - `durable`: at the fixed path `context.input.messageListState.memoryInfo`
 *   (durable suspend payloads carry no `__streamState`)
 */
export const createSampleSuspendedSnapshotWithThread = ({
  threadId,
  resourceId,
  layout,
}: {
  threadId: string;
  resourceId?: string;
  layout: 'agentic-loop' | 'durable';
}) => {
  const runId = `run-${randomUUID()}`;
  const stepId = `step-${randomUUID()}`;
  const timestamp = new Date();
  const memoryInfo = { threadId, ...(resourceId ? { resourceId } : {}) };
  const suspendedStep = {
    status: 'suspended',
    payload: {},
    startedAt: timestamp.getTime(),
    suspendPayload:
      layout === 'agentic-loop' ? { __streamState: { messageList: { memoryInfo } } } : { question: 'approve?' },
  };
  const snapshot = {
    result: undefined,
    value: {},
    context: {
      [stepId]: suspendedStep,
      input: layout === 'durable' ? { messageListState: { memoryInfo } } : {},
    },
    serializedStepGraph: [],
    activePaths: [],
    suspendedPaths: { [stepId]: [0] },
    resumeLabels: {},
    waitingPaths: {},
    runId,
    timestamp: timestamp.getTime(),
    activeStepsPath: {},
    status: 'suspended',
  } as unknown as WorkflowRunState;
  return { snapshot, runId, stepId };
};
