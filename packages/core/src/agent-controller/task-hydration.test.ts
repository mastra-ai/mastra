import { afterEach, assert, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TaskRecord, ThreadStateStorage } from '../storage/domains/thread-state/base';
import { InMemoryStore } from '../storage/mock';
import { TASK_STATE_TYPE } from '../tools/builtin/task-tools';
import type { AgentController } from './agent-controller';
import type { Session } from './session';
import { createTestController } from './test-utils';

const sessionOptions = { id: 'task-session', ownerId: 'owner' };
const persistedTasks: TaskRecord[] = [
  { id: 'review', content: 'Review changes', status: 'in_progress', activeForm: 'Reviewing changes' },
];
const liveTasks: TaskRecord[] = [
  { id: 'publish', content: 'Publish changes', status: 'pending', activeForm: 'Publishing changes' },
];

describe('persisted task hydration', () => {
  let storage: InMemoryStore;
  let taskStore: ThreadStateStorage;
  let controller: AgentController;
  let session: Session;

  beforeEach(async () => {
    storage = new InMemoryStore();
    controller = createTestController({ storage });
    await controller.init();
    session = await controller.createSession(sessionOptions);
    const threadStateStore = await storage.getStore('threadState');
    assert(threadStateStore);
    taskStore = threadStateStore;
    await taskStore.setState({ threadId: session.thread.requireId(), type: TASK_STATE_TYPE, value: persistedTasks });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    session.thread.detachFromCurrent();
    await controller.destroy();
  });

  it.each(['explicit', 'auto-resumed'] as const)('restores tasks in an %s session after restart', async selection => {
    const threadId = session.thread.requireId();
    session.thread.detachFromCurrent();
    await controller.destroy();
    controller = createTestController({ storage });
    await controller.init();

    session = await controller.createSession({
      ...sessionOptions,
      ...(selection === 'explicit' ? { threadId } : {}),
    });

    expect(session.thread.requireId()).toBe(threadId);
    expect(session.displayState.get().tasks).toEqual(persistedTasks);
  });

  it('restores a cached thread after its reset without replaying a task action', async () => {
    const threadId = session.thread.requireId();
    const emptyThread = await session.thread.create();
    const taskActions = vi.fn();
    const displayedTasks: TaskRecord[][] = [];
    session.subscribe(event => {
      if (event.type === 'task_updated') taskActions();
      if (event.type === 'task_snapshot' && event.snapshot.status === 'ready') {
        displayedTasks.push(event.snapshot.tasks);
      }
    });

    const reopened = await controller.createSession({ ...sessionOptions, threadId });

    expect(reopened.displayState.get().tasks).toEqual(persistedTasks);
    expect(displayedTasks.at(-1)).toEqual(persistedTasks);
    expect(taskActions).not.toHaveBeenCalled();

    await session.thread.switch({ threadId: emptyThread.id });
    expect(session.displayState.get().tasks).toEqual([]);
  });

  it('preserves live tasks and restores metadata when task storage fails', async () => {
    await session.thread.setSetting({
      key: 'tokenUsage',
      value: { promptTokens: 500, completionTokens: 250, totalTokens: 750 },
    });
    session.emit({ type: 'task_updated', threadId: session.thread.requireId(), tasks: liveTasks });
    vi.spyOn(taskStore, 'getState').mockRejectedValueOnce(new Error('task storage unavailable'));

    await session.thread.loadMetadata();

    expect(session.getTokenUsage().totalTokens).toBe(750);
    expect(session.displayState.get().tasks).toEqual(liveTasks);
  });

  it.each(['new thread', 'task update'] as const)('ignores a task read overtaken by a %s', async transition => {
    const pendingTasks = Promise.withResolvers<TaskRecord[]>();
    const taskRead = vi.spyOn(taskStore, 'getState').mockImplementationOnce(() => pendingTasks.promise);
    const hydration = session.thread.loadMetadata();
    await vi.waitFor(() => expect(taskRead).toHaveBeenCalled());

    if (transition === 'new thread') await session.thread.create();
    else session.emit({ type: 'task_updated', threadId: session.thread.requireId(), tasks: liveTasks });
    pendingTasks.resolve(persistedTasks);
    await hydration;

    expect(session.displayState.get().tasks).toEqual(transition === 'new thread' ? [] : liveTasks);
  });
  it('bootstraps each subscriber without replaying tasks to existing listeners', async () => {
    await session.thread.loadMetadata();
    const firstSnapshots: TaskRecord[][] = [];
    const secondSnapshots: TaskRecord[][] = [];
    const unsubscribeFirst = session.subscribe(event => {
      if (event.type === 'task_snapshot' && event.snapshot.status === 'ready') {
        firstSnapshots.push(event.snapshot.tasks);
      }
    });
    const unsubscribeSecond = session.subscribe(event => {
      if (event.type === 'task_snapshot' && event.snapshot.status === 'ready') {
        secondSnapshots.push(event.snapshot.tasks);
      }
    });

    expect(firstSnapshots).toEqual([persistedTasks]);
    expect(secondSnapshots).toEqual([persistedTasks]);
    unsubscribeFirst();
    unsubscribeSecond();
  });

  it('delivers a task change triggered inside bootstrap after the initial snapshot', async () => {
    await session.thread.loadMetadata();
    const received: TaskRecord[][] = [];
    const unsubscribe = session.subscribe(event => {
      if (event.type === 'task_snapshot' && event.snapshot.status === 'ready') {
        received.push(event.snapshot.tasks);
        session.emit({ type: 'task_updated', threadId: session.thread.requireId(), tasks: liveTasks });
      } else if (event.type === 'task_updated') {
        received.push(event.tasks);
      }
    });

    expect(received).toEqual([persistedTasks, liveTasks]);
    unsubscribe();
  });

  it('preserves live task order for every listener when another listener emits reentrantly', () => {
    const threadId = session.thread.requireId();
    const unsubscribeFirst = session.subscribe(event => {
      if (event.type === 'task_updated' && event.tasks === persistedTasks) {
        session.emit({ type: 'task_updated', threadId, tasks: liveTasks });
      }
    });
    const received: TaskRecord[][] = [];
    const unsubscribeSecond = session.subscribe(event => {
      if (event.type === 'task_updated') received.push(event.tasks);
    });

    session.emit({ type: 'task_updated', threadId, tasks: persistedTasks });
    expect(received).toEqual([persistedTasks, liveTasks]);
    unsubscribeFirst();
    unsubscribeSecond();
  });

  it('does not deliver a storage read after its subscriber detaches', async () => {
    const pendingTasks = Promise.withResolvers<TaskRecord[]>();
    const readStarted = Promise.withResolvers<void>();
    vi.spyOn(taskStore, 'getState').mockImplementationOnce(() => {
      readStarted.resolve();
      return pendingTasks.promise;
    });
    const hydration = session.thread.loadMetadata();
    await readStarted.promise;
    const received: TaskRecord[][] = [];
    const unsubscribe = session.subscribe(event => {
      if (event.type === 'task_snapshot' && event.snapshot.status === 'ready') received.push(event.snapshot.tasks);
    });
    unsubscribe();
    pendingTasks.resolve(persistedTasks);
    await hydration;

    expect(received).toEqual([[]]);
  });

  it('preserves known tasks when the task domain disappears and clears an authoritative empty list', async () => {
    const threadId = session.thread.requireId();
    session.emit({ type: 'task_updated', threadId, tasks: liveTasks });
    const getStore = storage.getStore.bind(storage);
    const unavailableStore = vi.spyOn(storage, 'getStore').mockImplementation(async name => {
      if (name === 'threadState') return undefined;
      return getStore(name);
    });

    await session.thread.loadMetadata();
    expect(session.tasks.get()).toEqual({ threadId, status: 'ready', tasks: liveTasks });
    unavailableStore.mockRestore();
    await taskStore.setState({ threadId, type: TASK_STATE_TYPE, value: [] });
    await session.thread.loadMetadata();
    expect(session.tasks.get()).toEqual({ threadId, status: 'ready', tasks: [] });
  });

  it('reports unavailable rather than empty when reopening without a task domain', async () => {
    const getStore = storage.getStore.bind(storage);
    vi.spyOn(storage, 'getStore').mockImplementation(async name => {
      if (name === 'threadState') return undefined;
      return getStore(name);
    });
    await session.thread.create();
    const snapshots: unknown[] = [];
    const unsubscribe = session.subscribe(event => {
      if (event.type === 'task_snapshot') snapshots.push(event.snapshot);
    });

    expect(snapshots).toEqual([{ threadId: session.thread.requireId(), status: 'unavailable' }]);
    unsubscribe();
  });

  it('discards old-thread task updates after switching to an empty thread', async () => {
    const oldThreadId = session.thread.requireId();
    await session.thread.create();
    const taskActions = vi.fn();
    const unsubscribe = session.subscribe(event => {
      if (event.type === 'task_updated') taskActions(event);
    });
    session.emit({ type: 'task_updated', threadId: oldThreadId, tasks: persistedTasks });

    expect(session.tasks.get()).toEqual({ threadId: session.thread.requireId(), status: 'ready', tasks: [] });
    expect(taskActions).not.toHaveBeenCalled();
    unsubscribe();
  });

  it('invalidates an older read even when the binding returns to the same thread', async () => {
    const threadId = session.thread.requireId();
    const otherThread = await session.thread.create();
    await session.thread.switch({ threadId });
    const pendingTasks = Promise.withResolvers<TaskRecord[]>();
    const readStarted = Promise.withResolvers<void>();
    vi.spyOn(taskStore, 'getState').mockImplementationOnce(() => {
      readStarted.resolve();
      return pendingTasks.promise;
    });
    const hydration = session.thread.loadMetadata();
    await readStarted.promise;
    session.thread.set({ threadId: otherThread.id });
    session.thread.set({ threadId });
    pendingTasks.resolve(liveTasks);
    await hydration;

    expect(session.tasks.get()).toEqual({ threadId, status: 'loading' });
  });
});
