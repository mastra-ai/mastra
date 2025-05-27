import { randomUUID } from 'crypto';
import type { MessageType, WorkflowRunState } from '@mastra/core';
import { expect } from 'vitest';

export const createSampleTrace = (name: string, scope?: string, attributes?: Record<string, string>) => ({
  id: `trace-${randomUUID()}`,
  parentSpanId: `span-${randomUUID()}`,
  traceId: `trace-${randomUUID()}`,
  name,
  scope,
  kind: 'internal',
  status: JSON.stringify({ code: 'success' }),
  events: JSON.stringify([{ name: 'start', timestamp: Date.now() }]),
  links: JSON.stringify([]),
  attributes: attributes ? JSON.stringify(attributes) : undefined,
  startTime: new Date().toISOString(),
  endTime: new Date().toISOString(),
  other: JSON.stringify({ custom: 'data' }),
  createdAt: new Date().toISOString(),
});

// Sample test data factory functions
export const createSampleThread = () => ({
  id: `thread-${randomUUID()}`,
  resourceId: `resource-${randomUUID()}`,
  title: 'Test Thread',
  createdAt: new Date(),
  updatedAt: new Date(),
  metadata: { key: 'value' },
});

export const createSampleMessage = (threadId: string): MessageType =>
  ({
    id: `msg-${randomUUID()}`,
    role: 'user',
    threadId,
    content: { format: 2, parts: [{ type: 'text' as const, text: 'Hello' }] },
    createdAt: new Date(),
    resourceId: `resource-${randomUUID()}`,
  }) satisfies MessageType;

export const createSampleWorkflowSnapshot = (threadId: string, status: string, createdAt?: Date) => {
  const runId = `run-${randomUUID()}`;
  const stepId = `step-${randomUUID()}`;
  const timestamp = createdAt || new Date();
  const snapshot: WorkflowRunState = {
    value: { [threadId]: 'running' },
    context: {
      [stepId]: {
        status: status as WorkflowRunState['context'][string]['status'],
        payload: {},
        error: undefined,
        startedAt: timestamp.getTime(),
        endedAt: new Date(timestamp.getTime() + 15000).getTime(),
      },
      input: {},
    },
    activePaths: [],
    suspendedPaths: {},
    runId,
    timestamp: timestamp.getTime(),
  } as unknown as WorkflowRunState;
  return { snapshot, runId, stepId };
};

// Helper function to retry until condition is met or timeout
export const retryUntil = async <T>(
  fn: () => Promise<T>,
  condition: (result: T) => boolean,
  timeout = 30000, // REST API needs longer timeout due to higher latency
  interval = 2000, // Longer interval to account for REST API latency
): Promise<T> => {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const result = await fn();
      if (condition(result)) return result;
    } catch (error) {
      if (Date.now() - start >= timeout) throw error;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  throw new Error('Timeout waiting for condition');
};

export const createSampleThreadWithParams = (
  threadId: string,
  resourceId: string,
  createdAt: Date,
  updatedAt: Date,
) => ({
  id: threadId,
  resourceId,
  title: 'Test Thread with given ThreadId and ResourceId',
  createdAt,
  updatedAt,
  metadata: { key: 'value' },
});

export const checkWorkflowSnapshot = (snapshot: WorkflowRunState | string, stepId: string, status: string) => {
  if (typeof snapshot === 'string') {
    throw new Error('Expected WorkflowRunState, got string');
  }
  expect(snapshot.context?.[stepId]?.status).toBe(status);
};
