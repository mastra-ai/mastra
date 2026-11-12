import type { Session } from '@mastra/core/agent-controller';
import { Mastra } from '@mastra/core/mastra';
import { InMemoryStore } from '@mastra/core/storage';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBackgroundCompletionCallbacks, createBackgroundNoticeDelivery } from '../background-completion.js';

// The notice delivery runs against a real BackgroundTaskManager; only the
// session (the agent side) is faked, to record how each notice was sent.
function createSession(currentThreadId: string) {
  const accepted = () => ({ accepted: Promise.resolve({ accepted: true as const }) });
  const sendSignal = vi.fn(accepted);
  const sendSignalToThread = vi.fn(accepted);
  const session = {
    sendSignal,
    sendSignalToThread,
    identity: { getResourceId: () => 'resource-1' },
    thread: { getId: () => currentThreadId },
  } as unknown as Session<unknown>;
  return { session, sendSignal, sendSignalToThread };
}

function contentsOf(spy: ReturnType<typeof vi.fn>): string[] {
  return spy.mock.calls.map(call => String((call[0] as { contents: unknown }).contents));
}

let mastra: Mastra | undefined;

afterEach(async () => {
  await mastra?.backgroundTaskManager?.shutdown();
  await mastra?.stopWorkers();
  mastra = undefined;
});

function createMastra(storage: InMemoryStore, sessions: Map<string, Session<unknown>>) {
  const delivery = createBackgroundNoticeDelivery(() => ({ getSession: async id => sessions.get(id) }));
  const callbacks = createBackgroundCompletionCallbacks(delivery, undefined, {
    subagents: [{ id: 'explore', name: 'Explore' }],
    isShuttingDown: () => mastra?.backgroundTaskManager?.isShuttingDown() ?? false,
  });
  mastra = new Mastra({
    logger: false,
    storage,
    backgroundTasks: { enabled: true, notifyAgentOnFinish: false, ...callbacks },
  });
  return { mastra, delivery };
}

describe('background task notices with a real task manager', () => {
  it('does not wake the agent when quitting stops a running background subagent', async () => {
    const { session, sendSignal, sendSignalToThread } = createSession('thread-1');
    const { mastra } = createMastra(new InMemoryStore(), new Map([['resource-1', session]]));
    await mastra.startWorkers();
    const manager = mastra.backgroundTaskManager!;
    let started = false;

    const { task } = await manager.enqueue(
      {
        toolName: 'subagent',
        toolCallId: 'call-subagent',
        args: { agentType: 'explore', task: 'Audit the auth module' },
        agentId: 'code-agent',
        runId: 'run-1',
        threadId: 'thread-1',
        resourceId: 'resource-1',
        // Mastra Code runs background subagents with no timeout and no retries.
        timeoutMs: 0,
        maxRetries: 0,
      },
      {
        executor: {
          execute: (_args: unknown, opts?: { abortSignal?: AbortSignal }) =>
            new Promise((_resolve, reject) => {
              started = true;
              opts?.abortSignal?.addEventListener('abort', () => reject(opts.abortSignal?.reason), { once: true });
            }),
        },
      },
    );
    await vi.waitFor(() => expect(started).toBe(true));

    await manager.shutdown();
    expect((await manager.getTask(task.id))?.status).toBe('cancelled');

    await vi.waitFor(() => expect(sendSignalToThread).toHaveBeenCalled());
    expect(sendSignal).not.toHaveBeenCalled();
    expect(contentsOf(sendSignalToThread)).toEqual([
      expect.stringContaining('Background Explore subagent was interrupted by a shutdown'),
    ]);
  });

  it('holds the notice for a task a crash orphaned until a session exists, and only persists it', async () => {
    const storage = new InMemoryStore();
    const tasks = await storage.getStore('backgroundTasks');
    await tasks!.createTask({
      id: 'orphaned',
      status: 'running',
      toolName: 'subagent',
      toolCallId: 'call-orphaned',
      args: { agentType: 'explore', task: 'Audit the auth module' },
      agentId: 'code-agent',
      runId: 'run-0',
      threadId: 'thread-1',
      resourceId: 'resource-1',
      retryCount: 0,
      maxRetries: 0,
      timeoutMs: 0,
      createdAt: new Date(),
      startedAt: new Date(Date.now() - 60_000),
    });
    const sessions = new Map<string, Session<unknown>>();
    const { mastra, delivery } = createMastra(storage, sessions);
    await mastra.startWorkers();
    await vi.waitFor(async () => expect((await tasks!.getTask('orphaned'))?.status).toBe('failed'));

    // The session starts on the task's thread; a restart notice still must not start a turn.
    const { session, sendSignal, sendSignalToThread } = createSession('thread-1');
    sessions.set('resource-1', session);
    await vi.waitFor(async () => {
      await delivery.flush();
      expect(sendSignalToThread).toHaveBeenCalledOnce();
    });

    expect(sendSignal).not.toHaveBeenCalled();
    expect(contentsOf(sendSignalToThread)).toEqual([
      expect.stringContaining('Background Explore subagent was interrupted by a restart'),
    ]);
  });
});
