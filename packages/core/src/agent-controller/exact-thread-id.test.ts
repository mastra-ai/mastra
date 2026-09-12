import { describe, expect, it, vi } from 'vitest';
import { Agent } from '../agent';
import { InMemoryStore } from '../storage/mock';
import { TASK_STATE_TYPE } from '../tools/builtin/task-tools';
import { AgentController } from './agent-controller';
import { createMockWorkspace } from './test-utils';

function createAgent() {
  return new Agent({
    name: 'test-agent',
    instructions: 'You are a test agent.',
    model: { provider: 'openai', name: 'gpt-4o', toolChoice: 'auto' },
  });
}

async function createController(
  storage: InMemoryStore,
  threadLock?: { acquire(threadId: string): void; release(threadId: string): void },
) {
  const controller = new AgentController({
    workspace: createMockWorkspace(),
    id: 'test-controller',
    storage,
    threadLock,
    modes: [{ id: 'default', name: 'Default', default: true, agent: createAgent() }],
  });
  await controller.init();
  return controller;
}

function createExclusiveThreadLock() {
  const lockedThreads = new Set<string>();
  return {
    lockedThreads,
    acquire(threadId: string) {
      if (lockedThreads.has(threadId)) throw new Error(`Already locked: ${threadId}`);
      lockedThreads.add(threadId);
    },
    release(threadId: string) {
      lockedThreads.delete(threadId);
    },
  };
}

describe('AgentController exact thread id creation', () => {
  it('creates and binds the requested thread id', async () => {
    const controller = await createController(new InMemoryStore());
    const session = await controller.createSession({
      id: 'session-1',
      ownerId: 'owner-1',
      resourceId: 'session-1',
      threadId: 'session-1',
    });

    expect(session.identity.getId()).toBe('session-1');
    expect(session.identity.getResourceId()).toBe('session-1');
    expect(session.thread.getId()).toBe('session-1');
    expect((await session.thread.getById({ threadId: 'session-1' }))?.resourceId).toBe('session-1');
  });

  it.each([true, false])('restores native tasks after restart (exact thread: %s)', async exactThread => {
    const storage = new InMemoryStore();
    const first = await createController(storage);
    const firstSession = await first.createSession({
      id: 'session-1',
      ownerId: 'owner-1',
      resourceId: 'session-1',
      threadId: 'session-1',
    });
    expect(firstSession.thread.getId()).toBe('session-1');
    const tasks = [{ id: 'stable-task', content: 'Finish the work', status: 'in_progress', activeForm: 'Working' }];
    const taskStore = await storage.getStore('threadState');
    await taskStore.setState({ threadId: 'session-1', type: TASK_STATE_TYPE, value: tasks });
    await firstSession.thread.setSetting({
      key: 'tokenUsage',
      value: { promptTokens: 120, completionTokens: 30, totalTokens: 150 },
    });

    const second = await createController(storage);
    let initializedSnapshot: unknown;
    second.onSessionCreated(session => {
      initializedSnapshot = structuredClone(session.displayState.get());
    });
    const resumed = await second.createSession({
      id: 'session-1',
      ownerId: 'owner-1',
      resourceId: 'session-1',
      threadId: exactThread ? 'session-1' : undefined,
    });
    expect(initializedSnapshot).toMatchObject({
      threadId: 'session-1',
      tasks,
      tokenUsage: { totalTokens: 150 },
    });

    expect(resumed.thread.getId()).toBe('session-1');
    expect(await resumed.thread.list()).toHaveLength(1);
    expect(resumed.displayState.get()).toMatchObject({
      threadId: 'session-1',
      tasks,
      previousTasks: [],
      tokenUsage: { totalTokens: 150 },
    });
    expect(await resumed.thread.listActiveMessages()).toEqual([]);
  });

  it('fails session restoration when durable tasks cannot be read', async () => {
    const storage = new InMemoryStore();
    const first = await createController(storage);
    await first.createSession({
      id: 'session-1',
      ownerId: 'owner-1',
      resourceId: 'session-1',
      threadId: 'session-1',
    });
    const taskStore = await storage.getStore('threadState');
    const taskRead = vi.spyOn(taskStore, 'getState').mockRejectedValueOnce(new Error('Task storage unavailable'));
    const restarted = await createController(storage);

    try {
      await expect(
        restarted.createSession({
          id: 'session-1',
          ownerId: 'owner-1',
          resourceId: 'session-1',
          threadId: 'session-1',
        }),
      ).rejects.toThrow('Task storage unavailable');
    } finally {
      taskRead.mockRestore();
    }
  });

  it.each([true, false])('releases failed startup hydration locks before retry (exact thread: %s)', async exact => {
    const storage = new InMemoryStore();
    const seed = await createController(storage);
    await seed.createSession({ id: 'session', ownerId: 'owner', resourceId: 'resource', threadId: 'thread' });
    const tasks = [{ id: 'task', content: 'Recover after failure', status: 'pending', activeForm: 'Recovering' }];
    const taskStore = await storage.getStore('threadState');
    await taskStore.setState({ threadId: 'thread', type: TASK_STATE_TYPE, value: tasks });
    const threadLock = createExclusiveThreadLock();
    const controller = await createController(storage, threadLock);
    const options = {
      id: 'session',
      ownerId: 'owner',
      resourceId: 'resource',
      threadId: exact ? 'thread' : undefined,
    };
    const taskRead = vi.spyOn(taskStore, 'getState').mockRejectedValueOnce(new Error('Task storage unavailable'));
    try {
      await expect(controller.createSession(options)).rejects.toThrow('Task storage unavailable');
      expect(threadLock.lockedThreads).toEqual(new Set());
      const resumed = await controller.createSession(options);
      expect(resumed.displayState.get()).toMatchObject({ threadId: 'thread', tasks });
      expect(threadLock.lockedThreads).toEqual(new Set(['thread']));
    } finally {
      taskRead.mockRestore();
    }
  });

  it('keeps the active thread intact when cached session hydration fails and retries the requested thread', async () => {
    const storage = new InMemoryStore();
    const threadLock = createExclusiveThreadLock();
    const controller = await createController(storage, threadLock);
    const options = { id: 'session', ownerId: 'owner', resourceId: 'resource' };
    const session = await controller.createSession({ ...options, threadId: 'thread-a' });
    await session.thread.create({ id: 'thread-b' });
    const taskStore = await storage.getStore('threadState');
    const tasksA = [{ id: 'a', content: 'Keep current work', status: 'pending', activeForm: 'Working' }];
    const tasksB = [{ id: 'b', content: 'Resume requested work', status: 'pending', activeForm: 'Resuming' }];
    await taskStore.setState({ threadId: 'thread-a', type: TASK_STATE_TYPE, value: tasksA });
    await taskStore.setState({ threadId: 'thread-b', type: TASK_STATE_TYPE, value: tasksB });
    await session.thread.switch({ threadId: 'thread-a' });
    const previousSnapshot = structuredClone(session.displayState.get());
    const taskRead = vi.spyOn(taskStore, 'getState').mockRejectedValueOnce(new Error('Task storage unavailable'));

    try {
      await expect(controller.createSession({ ...options, threadId: 'thread-b' })).rejects.toThrow(
        'Task storage unavailable',
      );
      expect(session.thread.getId()).toBe('thread-a');
      expect(session.displayState.get()).toEqual(previousSnapshot);
      expect(threadLock.lockedThreads).toEqual(new Set(['thread-a']));

      const resumed = await controller.createSession({ ...options, threadId: 'thread-b' });
      expect(resumed).toBe(session);
      expect(resumed.displayState.get()).toMatchObject({ threadId: 'thread-b', tasks: tasksB });
      expect(threadLock.lockedThreads).toEqual(new Set(['thread-b']));
    } finally {
      taskRead.mockRestore();
    }
  });

  it('keeps the latest switch when an earlier thread finishes hydration later', async () => {
    const storage = new InMemoryStore();
    const threadLock = createExclusiveThreadLock();
    const controller = await createController(storage, threadLock);
    const session = await controller.createSession({ id: 'session', ownerId: 'owner', threadId: 'thread-a' });
    await session.thread.create({ id: 'thread-b' });
    await session.thread.create({ id: 'thread-c' });
    await session.thread.switch({ threadId: 'thread-a' });
    const taskStore = await storage.getStore('threadState');
    const tasks = [{ id: 'c', content: 'Latest requested work', status: 'pending', activeForm: 'Working' }];
    await taskStore.setState({ threadId: 'thread-c', type: TASK_STATE_TYPE, value: tasks });
    const memory = await storage.getStore('memory');
    const readThread = memory.getThreadById.bind(memory);
    let releaseHydration!: () => void;
    const hydrationGate = new Promise<void>(resolve => {
      releaseHydration = resolve;
    });
    let markHydrating!: () => void;
    const hydrating = new Promise<void>(resolve => {
      markHydrating = resolve;
    });
    const delayedRead = vi.spyOn(memory, 'getThreadById').mockImplementation(async input => {
      if (input.threadId === 'thread-b') {
        markHydrating();
        await hydrationGate;
      }
      return readThread(input);
    });
    const earlierSwitch = session.thread.switch({ threadId: 'thread-b' });
    await hydrating;
    try {
      await session.thread.switch({ threadId: 'thread-c' });
    } finally {
      releaseHydration();
      await earlierSwitch;
      delayedRead.mockRestore();
    }
    expect(session.thread.getId()).toBe('thread-c');
    expect(session.displayState.get()).toMatchObject({ threadId: 'thread-c', tasks });
    expect(threadLock.lockedThreads).toEqual(new Set(['thread-c']));
  });

  it('preserves hydrated tasks and usage when optional preference restoration fails', async () => {
    const storage = new InMemoryStore();
    const controller = await createController(storage);
    const session = await controller.createSession({ id: 'session', ownerId: 'owner', threadId: 'thread-a' });
    await session.thread.create({ id: 'thread-b' });
    const taskStore = await storage.getStore('threadState');
    const tasks = [{ id: 'b', content: 'Restored work', status: 'pending', activeForm: 'Working' }];
    await taskStore.setState({ threadId: 'thread-b', type: TASK_STATE_TYPE, value: tasks });
    await session.thread.setSetting({
      key: 'tokenUsage',
      value: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
    });
    await session.thread.setSetting({ key: 'observationThreshold', value: 200 });
    await session.thread.switch({ threadId: 'thread-a' });
    const preferenceWrite = vi.spyOn(session.state, 'set').mockRejectedValueOnce(new Error('Preference rejected'));
    try {
      await session.thread.switch({ threadId: 'thread-b' });
      expect(session.displayState.get()).toMatchObject({
        threadId: 'thread-b',
        tasks,
        tokenUsage: { totalTokens: 150 },
      });
      expect(session.getTokenUsage().totalTokens).toBe(150);
    } finally {
      preferenceWrite.mockRestore();
    }
  });

  it('rejects binding an existing exact thread owned by another resource', async () => {
    const storage = new InMemoryStore();
    const first = await createController(storage);
    await first.createSession({
      id: 'session-1',
      ownerId: 'owner-1',
      resourceId: 'resource-a',
      threadId: 'shared-thread',
    });

    const second = await createController(storage);
    await expect(
      second.createSession({
        id: 'session-2',
        ownerId: 'owner-1',
        resourceId: 'resource-b',
        threadId: 'shared-thread',
      }),
    ).rejects.toThrow('Thread not found: shared-thread');
  });

  it('deduplicates concurrent exact thread creation for the same resource', async () => {
    const controller = await createController(new InMemoryStore());
    const [a, b] = await Promise.all([
      controller.createSession({ id: 'session-1', ownerId: 'owner-1', resourceId: 'session-1', threadId: 'session-1' }),
      controller.createSession({ id: 'session-1', ownerId: 'owner-1', resourceId: 'session-1', threadId: 'session-1' }),
    ]);

    expect(a).toBe(b);
    expect(a.thread.getId()).toBe('session-1');
    expect(await a.thread.list()).toHaveLength(1);
  });

  it('honors the exact thread id when a thread-agnostic caller created the session first', async () => {
    const controller = await createController(new InMemoryStore());
    // Simulates an SSE subscribe / message list racing ahead of the exact-thread create.
    const first = await controller.createSession({ id: 'session-1', ownerId: 'owner-1', resourceId: 'session-1' });
    const initialThreadId = first.thread.getId();
    expect(initialThreadId).not.toBe('session-1');

    const second = await controller.createSession({
      id: 'session-1',
      ownerId: 'owner-1',
      resourceId: 'session-1',
      threadId: 'session-1',
    });

    expect(second).toBe(first);
    expect(second.thread.getId()).toBe('session-1');
    expect((await second.thread.getById({ threadId: 'session-1' }))?.resourceId).toBe('session-1');
  });

  it('switches a cached session back to an existing exact thread', async () => {
    const controller = await createController(new InMemoryStore());
    const session = await controller.createSession({
      id: 'session-1',
      ownerId: 'owner-1',
      resourceId: 'session-1',
      threadId: 'session-1',
    });
    await session.thread.create({ title: 'detour' });
    expect(session.thread.getId()).not.toBe('session-1');

    const again = await controller.createSession({
      id: 'session-1',
      ownerId: 'owner-1',
      resourceId: 'session-1',
      threadId: 'session-1',
    });

    expect(again).toBe(session);
    expect(again.thread.getId()).toBe('session-1');
    expect(await again.thread.list()).toHaveLength(2);
  });

  it('rejects an exact thread owned by another resource on a cached session', async () => {
    const storage = new InMemoryStore();
    const controller = await createController(storage);
    await controller.createSession({
      id: 'session-a',
      ownerId: 'owner-1',
      resourceId: 'resource-a',
      threadId: 'thread-a',
    });
    const cached = await controller.createSession({ id: 'session-b', ownerId: 'owner-1', resourceId: 'resource-b' });

    await expect(
      controller.createSession({
        id: 'session-b',
        ownerId: 'owner-1',
        resourceId: 'resource-b',
        threadId: 'thread-a',
      }),
    ).rejects.toThrow('Thread not found: thread-a');
    // The cached session keeps its original binding.
    expect(cached.thread.getId()).not.toBe('thread-a');
  });

  it('keeps default multi-thread behavior when threadId is omitted', async () => {
    const controller = await createController(new InMemoryStore());
    const session = await controller.createSession({ id: 'session-1', ownerId: 'owner-1', resourceId: 'resource-1' });

    expect(session.thread.getId()).toBeTruthy();
    expect(session.thread.getId()).not.toBe('session-1');
    const secondThread = await session.thread.create({ title: 'second' });
    expect(secondThread.id).not.toBe('session-1');
    expect(await session.thread.list()).toHaveLength(2);
  });
});
