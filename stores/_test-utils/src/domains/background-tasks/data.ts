import type { BackgroundTask } from '@mastra/core/background-tasks';

/**
 * Creates a sample background task for tests.
 */
export function createSampleTask(overrides?: Partial<BackgroundTask>): BackgroundTask {
  return {
    id: crypto.randomUUID(),
    status: 'pending',
    toolName: 'test-tool',
    toolCallId: `call-${crypto.randomUUID()}`,
    args: { query: 'test' },
    agentId: 'agent-1',
    runId: `run-${crypto.randomUUID()}`,
    retryCount: 0,
    maxRetries: 0,
    timeoutMs: 300_000,
    createdAt: new Date(),
    ...overrides,
  };
}
