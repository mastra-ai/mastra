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
      if (event.type === 'display_state_changed') displayedTasks.push([...event.displayState.tasks]);
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
    session.displayState.restoreTasks(liveTasks);
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
    else session.emit({ type: 'task_updated', tasks: liveTasks });
    pendingTasks.resolve(persistedTasks);
    await hydration;

    expect(session.displayState.get().tasks).toEqual(transition === 'new thread' ? [] : liveTasks);
  });
});
