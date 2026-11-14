import type { Session } from '@mastra/core/agent-controller';
import type { BackgroundTask } from '@mastra/core/background-tasks';
import { RequestContext } from '@mastra/core/request-context';
import { describe, expect, it, vi } from 'vitest';
import { createBackgroundCompletionEvents } from './background-completion-events.js';
import { createBackgroundCompletionCallbacks, createBackgroundNoticeDelivery } from './background-completion.js';

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
      kind: 'task',
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
      kind: 'task',
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

function createSession({ resourceId = 'resource-1', currentThreadId = 'other-thread' } = {}) {
  const accepted = () => ({ accepted: Promise.resolve({ accepted: true as const }) });
  const sendSignal = vi.fn(accepted);
  const sendSignalToThread = vi.fn(accepted);
  const session = {
    sendSignal,
    sendSignalToThread,
    identity: { getResourceId: () => resourceId },
    thread: { getId: () => currentThreadId },
  } as unknown as Session<unknown>;
  return { session, sendSignal, sendSignalToThread };
}

describe('createBackgroundNoticeDelivery', () => {
  const target = { resourceId: 'resource-1', threadId: 'thread-1' };
  const signal = { id: 'background-process:42:call-1', type: 'notification' as const, contents: 'exited' };

  function createDelivery(session?: Session<unknown>) {
    const sessions = new Map<string, Session<unknown>>(session ? [['resource-1', session]] : []);
    const delivery = createBackgroundNoticeDelivery(() => ({ getSession: async id => sessions.get(id) }));
    return { delivery, sessions };
  }

  it('wakes the agent when the notice is for the thread the session is on', async () => {
    const { session, sendSignal, sendSignalToThread } = createSession({ currentThreadId: 'thread-1' });

    await createDelivery(session).delivery.deliver(target, signal);

    expect(sendSignalToThread).not.toHaveBeenCalled();
    expect(sendSignal).toHaveBeenCalledWith(signal, { ifIdle: { behavior: 'wake' }, requireDelivery: true });
  });

  it.each([
    ['the wake could not start', () => Promise.reject(new Error('no model'))],
    ['the thread refused it', () => Promise.resolve({ accepted: true as const, action: 'blocked' as const })],
  ])('saves the notice to the thread when %s', async (_case, accepted) => {
    const { session, sendSignal, sendSignalToThread } = createSession({ currentThreadId: 'thread-1' });
    sendSignal.mockReturnValueOnce({ accepted: accepted() } as never);

    await createDelivery(session).delivery.deliver(target, signal);

    expect(sendSignal).toHaveBeenCalledOnce();
    expect(sendSignalToThread).toHaveBeenCalledWith(signal, target);
  });

  it('keeps a notice whose first send failed, and sends it on a later session', async () => {
    const { session, sendSignalToThread } = createSession();
    sendSignalToThread.mockReturnValueOnce({ accepted: Promise.reject(new Error('storage not ready')) });
    const { delivery } = createDelivery(session);

    await expect(delivery.deliver(target, signal)).rejects.toThrow('storage not ready');
    await delivery.flush();
    await delivery.flush();

    expect(sendSignalToThread).toHaveBeenCalledTimes(2);
  });

  it('holds a notice until a session runs its resource, and sends it once', async () => {
    const { delivery, sessions } = createDelivery();

    await delivery.deliver(target, signal);
    const { session, sendSignalToThread } = createSession();
    sendSignalToThread.mockReturnValueOnce({ accepted: Promise.reject(new Error('storage not ready')) });
    sessions.set('resource-1', session);
    await delivery.flush();
    await delivery.flush();
    await delivery.flush();

    expect(sendSignalToThread).toHaveBeenCalledTimes(2);
  });
});

describe('createBackgroundNoticeDelivery routing', () => {
  const target = { resourceId: 'resource-1', threadId: 'thread-1' };
  const signal = { id: 'n-1', type: 'notification' as const, contents: 'done' };

  it('delivers to the session addressed by the thread id when sessions share a resource', async () => {
    const { session, sendSignalToThread } = createSession();
    const getSession = vi.fn(async (sessionId: string) => (sessionId === 'thread-1' ? session : undefined));

    await createBackgroundNoticeDelivery(() => ({ getSession })).deliver(target, signal);

    expect(getSession).toHaveBeenCalledWith('thread-1');
    expect(sendSignalToThread).toHaveBeenCalledTimes(1);
  });

  it('skips a session addressed by the thread id that works on another resource', async () => {
    const { session, sendSignalToThread } = createSession({ resourceId: 'resource-2' });

    await createBackgroundNoticeDelivery(() => ({ getSession: async () => session })).deliver(target, signal);

    expect(sendSignalToThread).not.toHaveBeenCalled();
  });

  it('delivers to a live session that switched to the notice resource after it was created', async () => {
    // Created as 'resource-0', then switched with `/resource`: still registered under 'resource-0'.
    const { session, sendSignal } = createSession({ currentThreadId: 'thread-1' });
    const getSession = vi.fn(async (sessionId: string) => (sessionId === 'resource-0' ? session : undefined));

    await createBackgroundNoticeDelivery(() => ({ getSession, listLiveSessions: () => [session] })).deliver(
      target,
      signal,
    );

    expect(sendSignal).toHaveBeenCalledTimes(1);
  });

  it("wakes with the host's request context, and saves the notice when the host has none to give", async () => {
    const { session, sendSignal, sendSignalToThread } = createSession({ currentThreadId: 'thread-1' });
    const owner = new RequestContext();
    let wakeContext: RequestContext | undefined = owner;
    const delivery = createBackgroundNoticeDelivery(() => ({ getSession: async () => undefined }), {
      resolveSession: async () => session,
      wakeRequestContext: async () => wakeContext,
    });

    await delivery.deliver(target, signal);
    expect(sendSignal.mock.calls[0]?.[1]).toMatchObject({ requestContext: owner });

    wakeContext = undefined;
    await delivery.deliver(target, signal);
    expect(sendSignal).toHaveBeenCalledTimes(1);
    expect(sendSignalToThread).toHaveBeenCalledWith(signal, target);
  });

  it('never borrows another live session on the shared resource', async () => {
    const a = createSession({ currentThreadId: 'run-a' });
    const b = createSession({ currentThreadId: 'run-b' });

    await createBackgroundNoticeDelivery(() => ({
      getSession: async () => undefined,
      listLiveSessions: () => [a.session, b.session],
    })).deliver(target, signal);

    for (const { sendSignal, sendSignalToThread } of [a, b]) {
      expect(sendSignal).not.toHaveBeenCalled();
      expect(sendSignalToThread).not.toHaveBeenCalled();
    }
  });
});
