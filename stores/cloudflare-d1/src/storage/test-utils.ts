import { randomUUID } from 'crypto';
import type { MessageType, WorkflowRunState } from '@mastra/core';

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

export const createSampleMessage = (threadId: string) =>
  ({
    id: `msg-${randomUUID()}`,
    role: 'user',
    type: 'text',
    threadId,
    content: [{ type: 'text' as const, text: 'Hello' }] as MessageType['content'],
    createdAt: new Date(),
  }) as any;

export const createSampleWorkflowSnapshot = (threadId: string): WorkflowRunState => ({
  value: { [threadId]: 'running' },
  context: {
    steps: {},
    triggerData: {},
    attempts: {},
  },
  activePaths: [
    {
      stepPath: [threadId],
      stepId: threadId,
      status: 'running',
    },
  ],
  runId: threadId,
  timestamp: Date.now(),
});

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
