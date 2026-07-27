import type { Session } from '@mastra/core/agent-controller';
import type { BackgroundTask } from '@mastra/core/background-tasks';
import { describe, expect, it, vi } from 'vitest';
import { createBackgroundCompletionCallbacks } from './background-completion.js';

function createTask(status: BackgroundTask['status']): BackgroundTask {
  return {
    id: 'task-1',
    status,
    toolName: 'mastra_expert',
    toolCallId: 'call-1',
    args: { question: 'test' },
    agentId: 'agent-1',
    threadId: 'thread-1',
    resourceId: 'resource-1',
    runId: 'run-1',
    retryCount: 0,
    maxRetries: 0,
    timeoutMs: 300_000,
    createdAt: new Date('2026-07-27T00:00:00.000Z'),
  };
}

function createHarness() {
  const accepted = Promise.resolve({ accepted: true as const });
  const sendSignalToThread = vi.fn(() => ({ accepted }));
  const getSessionByResource = vi.fn(async () => ({ sendSignalToThread }) as unknown as Session<unknown>);
  const callbacks = createBackgroundCompletionCallbacks(() => ({ getSessionByResource }));
  return { accepted, callbacks, getSessionByResource, sendSignalToThread };
}

describe('createBackgroundCompletionCallbacks', () => {
  it.each([
    ['completed', 'onTaskComplete', 'low'],
    ['failed', 'onTaskFailed', 'high'],
  ] as const)(
    'persists one stable %s completion card without duplicating the tool result',
    async (status, callback, priority) => {
      const { callbacks, getSessionByResource, sendSignalToThread } = createHarness();

      await callbacks[callback]?.(createTask(status));

      expect(getSessionByResource).toHaveBeenCalledWith('resource-1');
      expect(sendSignalToThread).toHaveBeenCalledWith(
        {
          id: `background-task:task-1:${status}`,
          type: 'notification',
          tagName: 'notification',
          contents: `mastra_expert ${status} in background`,
          attributes: {
            source: 'background-work',
            kind: `background-task-${status}`,
            priority,
            status,
          },
          metadata: {
            backgroundCompletion: {
              eventId: `background-task:task-1:${status}`,
              taskId: 'task-1',
              originRunId: 'run-1',
              originToolCallId: 'call-1',
              toolName: 'mastra_expert',
              status,
            },
          },
        },
        { resourceId: 'resource-1', threadId: 'thread-1' },
      );
    },
  );

  it('skips delivery when the task has no durable conversation target', async () => {
    const { callbacks, getSessionByResource } = createHarness();
    const task = createTask('completed');
    task.threadId = undefined;

    await callbacks.onTaskComplete?.(task);

    expect(getSessionByResource).not.toHaveBeenCalled();
  });
});
