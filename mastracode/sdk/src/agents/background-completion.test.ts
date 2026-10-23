import type { Session } from '@mastra/core/agent-controller';
import type { BackgroundTask } from '@mastra/core/background-tasks';
import { describe, expect, it, vi } from 'vitest';
import { createBackgroundCompletionEvents } from './background-completion-events.js';
import { createBackgroundCompletionCallbacks } from './background-completion.js';

function createTask(status: BackgroundTask['status']): BackgroundTask {
  return {
    id: 'task-1',
    status,
    toolName: 'mastra_expert',
    toolCallId: 'call-1',
    args: { question: 'test', token: 'secret-token' },
    error: { message: 'request failed with secret-token' },
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

function createHarness(accepted = Promise.resolve({ accepted: true as const })) {
  const sendSignalToThread = vi.fn(() => ({ accepted }));
  const session = {
    sendSignalToThread,
    identity: { getResourceId: () => 'resource-1' },
  } as unknown as Session<unknown>;
  const getSession = vi.fn(async (sessionId: string) => (sessionId === 'resource-1' ? session : undefined));
  const events = createBackgroundCompletionEvents();
  const callbacks = createBackgroundCompletionCallbacks(() => ({ getSession }), events);
  return { accepted, callbacks, events, getSession, sendSignalToThread };
}

describe('createBackgroundCompletionCallbacks', () => {
  it.each([
    ['completed', 'onTaskComplete', 'low'],
    ['failed', 'onTaskFailed', 'high'],
    ['cancelled', 'onTaskCancelled', 'low'],
  ] as const)(
    'persists one stable %s completion card without duplicating the tool result',
    async (status, callback, priority) => {
      const { callbacks, getSession, sendSignalToThread } = createHarness();

      await callbacks[callback]?.(createTask(status));

      expect(getSession).toHaveBeenCalledWith('resource-1');
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

  it('publishes one process-local event after persisting the origin-thread card', async () => {
    const { callbacks, events, sendSignalToThread } = createHarness();
    const listener = vi.fn();
    events.subscribe(listener);

    await callbacks.onTaskComplete?.(createTask('completed'));

    expect(sendSignalToThread).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith({
      id: 'background-task:task-1:completed',
      taskId: 'task-1',
      originRunId: 'run-1',
      originToolCallId: 'call-1',
      resourceId: 'resource-1',
      threadId: 'thread-1',
      toolName: 'mastra_expert',
      status: 'completed',
    });
  });

  it('publishes the process-local event and preserves a persistence failure', async () => {
    const persistenceError = new Error('signal persistence failed');
    const { callbacks, events, sendSignalToThread } = createHarness(Promise.reject(persistenceError));
    const listener = vi.fn();
    events.subscribe(listener);

    await expect(callbacks.onTaskComplete?.(createTask('completed'))).rejects.toBe(persistenceError);

    expect(sendSignalToThread).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith({
      id: 'background-task:task-1:completed',
      taskId: 'task-1',
      originRunId: 'run-1',
      originToolCallId: 'call-1',
      resourceId: 'resource-1',
      threadId: 'thread-1',
      toolName: 'mastra_expert',
      status: 'completed',
    });
    expect(sendSignalToThread.mock.invocationCallOrder[0]).toBeLessThan(listener.mock.invocationCallOrder[0]!);
  });

  it('skips delivery when the task has no durable conversation target', async () => {
    const { callbacks, events, getSession } = createHarness();
    const listener = vi.fn();
    events.subscribe(listener);
    const task = createTask('completed');
    task.threadId = undefined;

    await callbacks.onTaskComplete?.(task);

    expect(getSession).not.toHaveBeenCalled();
    expect(listener).not.toHaveBeenCalled();
  });

  it('delivers to the session addressed by the thread id when sessions share a resource', async () => {
    const sendSignalToThread = vi.fn(() => ({ accepted: Promise.resolve({ accepted: true as const }) }));
    const run = { sendSignalToThread, identity: { getResourceId: () => 'resource-1' } } as unknown as Session<unknown>;
    const getSession = vi.fn(async (sessionId: string) => (sessionId === 'thread-1' ? run : undefined));
    const callbacks = createBackgroundCompletionCallbacks(() => ({ getSession }));

    await callbacks.onTaskComplete?.(createTask('completed'));

    expect(getSession).toHaveBeenCalledWith('thread-1');
    expect(sendSignalToThread).toHaveBeenCalledTimes(1);
  });

  it('skips a session addressed by the thread id that works on another resource', async () => {
    const sendSignalToThread = vi.fn(() => ({ accepted: Promise.resolve({ accepted: true as const }) }));
    const other = {
      sendSignalToThread,
      identity: { getResourceId: () => 'resource-2' },
    } as unknown as Session<unknown>;
    const callbacks = createBackgroundCompletionCallbacks(() => ({ getSession: async () => other }));

    await callbacks.onTaskComplete?.(createTask('completed'));

    expect(sendSignalToThread).not.toHaveBeenCalled();
  });

  it('delivers to a live session that switched to the task resource after it was created', async () => {
    const sendSignalToThread = vi.fn(() => ({ accepted: Promise.resolve({ accepted: true as const }) }));
    // Created as 'resource-0', then switched with `/resource`: still registered under 'resource-0'.
    const switched = {
      sendSignalToThread,
      identity: { getResourceId: () => 'resource-1' },
      thread: { getId: () => 'thread-1' },
    } as unknown as Session<unknown>;
    const getSession = vi.fn(async (sessionId: string) => (sessionId === 'resource-0' ? switched : undefined));
    const callbacks = createBackgroundCompletionCallbacks(() => ({ getSession, listLiveSessions: () => [switched] }));

    await callbacks.onTaskComplete?.(createTask('completed'));

    expect(sendSignalToThread).toHaveBeenCalledTimes(1);
  });

  it('never borrows another live session on the shared resource', async () => {
    const sendSignalToThread = vi.fn(() => ({ accepted: Promise.resolve({ accepted: true as const }) }));
    const neighbour = (thread: string) =>
      ({
        sendSignalToThread,
        identity: { getResourceId: () => 'resource-1' },
        thread: { getId: () => thread },
      }) as unknown as Session<unknown>;
    const callbacks = createBackgroundCompletionCallbacks(() => ({
      getSession: async () => undefined,
      listLiveSessions: () => [neighbour('run-a'), neighbour('run-b')],
    }));

    await callbacks.onTaskComplete?.(createTask('completed'));

    expect(sendSignalToThread).not.toHaveBeenCalled();
  });
});
