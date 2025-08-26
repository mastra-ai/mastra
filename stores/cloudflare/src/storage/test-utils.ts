import { randomUUID } from 'crypto';
import type { WorkflowRunState } from '@mastra/core/workflows';

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
    } as WorkflowRunState['context'],
    serializedStepGraph: [],
    activePaths: [],
    suspendedPaths: {},
    waitingPaths: {},
    runId,
    status: status as WorkflowRunState['status'],
    timestamp: timestamp.getTime(),
    runtimeContext: {},
  };
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
