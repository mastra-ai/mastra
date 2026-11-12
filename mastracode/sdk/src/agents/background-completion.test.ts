import type { Session } from '@mastra/core/agent-controller';
import type { BackgroundTask } from '@mastra/core/background-tasks';
import { describe, expect, it, vi } from 'vitest';
import { createBackgroundCompletionEvents } from './background-completion-events.js';
import { createBackgroundCompletionCallbacks, createBackgroundNoticeDelivery } from './background-completion.js';

function createTask(status: BackgroundTask['status'], overrides: Partial<BackgroundTask> = {}): BackgroundTask {
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
    ...overrides,
  };
}

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

function createHarness(session?: Session<unknown>) {
  const sessions = new Map<string, Session<unknown>>(session ? [['resource-1', session]] : []);
  const getSession = vi.fn(async (sessionId: string) => sessions.get(sessionId));
  const delivery = createBackgroundNoticeDelivery(() => ({ getSession }));
  const events = createBackgroundCompletionEvents();
  const callbacks = createBackgroundCompletionCallbacks(delivery, events, {
    subagents: [{ id: 'explore', name: 'Explore' }],
  });
  return { callbacks, delivery, events, getSession, sessions };
}

function sentContents(spy: ReturnType<typeof vi.fn>): string {
  return (spy.mock.calls[0]?.[0] as { contents: string }).contents;
}

describe('createBackgroundCompletionCallbacks', () => {
  it.each([
    ['completed', 'onTaskComplete', 'low', 'Background mastra_expert call finished.'],
    ['failed', 'onTaskFailed', 'high', 'Background mastra_expert call failed.'],
    ['cancelled', 'onTaskCancelled', 'low', 'Background mastra_expert call was cancelled.'],
  ] as const)(
    'tells the thread a %s task ended and where its result is, without copying it',
    async (status, callback, priority, opening) => {
      const { session, sendSignalToThread } = createSession();
      const { callbacks } = createHarness(session);

      await callbacks[callback]?.(createTask(status));

      expect(sendSignalToThread).toHaveBeenCalledOnce();
      const [signal, target] = sendSignalToThread.mock.calls[0] as unknown as [Record<string, any>, unknown];
      expect(target).toEqual({ resourceId: 'resource-1', threadId: 'thread-1' });
      expect(signal.id).toBe(`background-task:task-1:${status}`);
      expect(signal.contents).toContain(opening);
      expect(signal.contents).toContain('call-1');
      expect(signal.contents).not.toContain('secret-token');
      expect(signal.attributes).toMatchObject({ source: 'background-work', priority, status });
      expect(signal.metadata.backgroundCompletion).toMatchObject({
        eventId: `background-task:task-1:${status}`,
        taskId: 'task-1',
        originToolCallId: 'call-1',
        status,
        title: 'mastra_expert',
      });
    },
  );

  it('names a background subagent by its definition and task', async () => {
    const { session, sendSignalToThread } = createSession();
    const { callbacks, events } = createHarness(session);
    const listener = vi.fn();
    events.subscribe(listener);

    await callbacks.onTaskComplete?.(
      createTask('completed', {
        toolName: 'subagent',
        args: { agentType: 'explore', task: 'Find the auth middleware\nand list its callers' },
      }),
    );

    expect(sentContents(sendSignalToThread)).toContain('Background Explore subagent finished.');
    expect(sendSignalToThread.mock.calls[0]?.[0]).toMatchObject({
      metadata: { backgroundCompletion: { title: 'Explore', summary: 'Find the auth middleware' } },
    });
    // The TUI's activity list names the task from the event, as the card does from the metadata.
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'task', title: 'Explore', summary: 'Find the auth middleware' }),
    );
  });

  it('wakes the agent when the task finishes on the thread the session is on', async () => {
    const { session, sendSignal, sendSignalToThread } = createSession({ currentThreadId: 'thread-1' });
    const { callbacks } = createHarness(session);

    await callbacks.onTaskComplete?.(createTask('completed'));

    expect(sendSignalToThread).not.toHaveBeenCalled();
    expect(sendSignal).toHaveBeenCalledWith(expect.objectContaining({ id: 'background-task:task-1:completed' }), {
      ifIdle: { behavior: 'wake' },
      requireDelivery: true,
    });
  });

  it.each([
    ['the wake could not start', () => Promise.reject(new Error('no model'))],
    ['the thread refused it', () => Promise.resolve({ accepted: true as const, action: 'blocked' as const })],
  ])('saves the notice to the thread when %s', async (_case, accepted) => {
    const { session, sendSignal, sendSignalToThread } = createSession({ currentThreadId: 'thread-1' });
    sendSignal.mockReturnValueOnce({ accepted: accepted() } as never);
    const { callbacks } = createHarness(session);

    await callbacks.onTaskComplete?.(createTask('completed'));

    expect(sendSignal).toHaveBeenCalledOnce();
    expect(sendSignalToThread).toHaveBeenCalledOnce();
    expect(sentContents(sendSignalToThread)).toContain('Background mastra_expert call finished.');
  });

  it('keeps a notice whose first send failed, and sends it on a later session', async () => {
    const { session, sendSignalToThread } = createSession();
    sendSignalToThread.mockReturnValueOnce({ accepted: Promise.reject(new Error('storage not ready')) });
    const { callbacks, delivery } = createHarness(session);

    await expect(callbacks.onTaskFailed?.(createTask('failed'))).rejects.toThrow('storage not ready');
    await delivery.flush();
    await delivery.flush();

    expect(sendSignalToThread).toHaveBeenCalledTimes(2);
  });

  it('saves the notice for a task the user cancelled without waking the agent', async () => {
    const { session, sendSignal, sendSignalToThread } = createSession({ currentThreadId: 'thread-1' });
    const { callbacks } = createHarness(session);

    await callbacks.onTaskCancelled?.(createTask('cancelled'));

    expect(sendSignal).not.toHaveBeenCalled();
    expect(sentContents(sendSignalToThread)).toContain('Background mastra_expert call was cancelled.');
  });

  it('keeps a held notice when sending it fails, and sends it once on a later session', async () => {
    const { callbacks, delivery, sessions } = createHarness();

    await callbacks.onTaskFailed?.(createTask('failed'));
    const { session, sendSignalToThread } = createSession();
    sendSignalToThread.mockReturnValueOnce({ accepted: Promise.reject(new Error('storage not ready')) });
    sessions.set('resource-1', session);
    await delivery.flush();
    await delivery.flush();
    await delivery.flush();

    expect(sendSignalToThread).toHaveBeenCalledTimes(2);
    expect(sentContents(sendSignalToThread)).toContain('Background mastra_expert call failed.');
  });

  it('publishes the process-local event after delivery, even when delivery fails', async () => {
    const persistenceError = new Error('signal persistence failed');
    const { session, sendSignalToThread } = createSession();
    sendSignalToThread.mockReturnValue({ accepted: Promise.reject(persistenceError) });
    const { callbacks, events } = createHarness(session);
    const listener = vi.fn();
    events.subscribe(listener);

    await expect(callbacks.onTaskComplete?.(createTask('completed'))).rejects.toBe(persistenceError);

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
      title: 'mastra_expert',
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

  it('delivers to a live session that switched to the task resource after it was created', async () => {
    // Created as 'resource-0', then switched with `/resource`: still registered under 'resource-0'.
    const { session, sendSignal } = createSession({ currentThreadId: 'thread-1' });
    const getSession = vi.fn(async (sessionId: string) => (sessionId === 'resource-0' ? session : undefined));

    await createBackgroundNoticeDelivery(() => ({ getSession, listLiveSessions: () => [session] })).deliver(
      target,
      signal,
    );

    expect(sendSignal).toHaveBeenCalledTimes(1);
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
