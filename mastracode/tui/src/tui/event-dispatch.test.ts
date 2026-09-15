import type { TaskItemSnapshot } from '@mastra/core/signals';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { dispatchEvent } from './event-dispatch.js';
import type { EventHandlerContext } from './handlers/types.js';
import type { TUIState } from './state.js';

function createMockAgentController(initialState: Record<string, unknown> = {}, previousTasks: TaskItemSnapshot[] = []) {
  let state = { ...initialState };
  const setState = vi.fn(async (updates: Record<string, unknown>) => {
    state = { ...state, ...updates };
  });
  return {
    state,
    loadOMProgress: vi.fn().mockResolvedValue(undefined),
    session: {
      thread: { list: vi.fn().mockResolvedValue([]), getId: vi.fn(() => 'thread-1') },
      state: {
        get: () => ({ ...state }),
        set: setState,
      },
      displayState: {
        get: () => ({
          isRunning: false,
          tasks: [],
          previousTasks,
          omProgress: { status: 'idle', pendingTokens: 0 },
          modifiedFiles: new Map(),
        }),
      },
    },
  };
}

function createMockTUIState(controller: ReturnType<typeof createMockAgentController>): TUIState {
  return {
    controller: controller as any,
    session: controller.session as any,
    taskProgress: {
      updateTasks: vi.fn(),
      getTasks: () => [],
    },
    allToolComponents: [],
    chatContainer: { children: [] },
    taskToolInsertIndex: 5,
    ui: { requestRender: vi.fn(), terminal: { setTitle: vi.fn() } },
    options: { appName: 'Mastra Code' },
    projectInfo: { rootPath: '/tmp/test', gitBranch: 'main' },
    currentThreadTitle: 'Old thread',
    editor: { escapeEnabled: false },
    goalManager: {
      getGoal: vi.fn(),
      saveToThread: vi.fn().mockResolvedValue(undefined),
      loadFromThreadMetadata: vi.fn(),
      consumePersistOnNextThreadCreate: vi.fn(() => false),
    },
  } as unknown as TUIState;
}

function createMockEctx(): EventHandlerContext {
  return {
    showInfo: vi.fn(),
    showFormattedError: vi.fn(),
    renderExistingMessages: vi.fn().mockResolvedValue(undefined),
    refreshModelAuthStatus: vi.fn().mockResolvedValue(undefined),
    renderClearedTasksInline: vi.fn(),
    renderCompletedTasksInline: vi.fn(),
    renderTaskDeltaInline: vi.fn(),
    updateStatusLine: vi.fn(),
  } as unknown as EventHandlerContext;
}

describe('dispatchEvent thread lifecycle', () => {
  let controller: ReturnType<typeof createMockAgentController>;
  let state: TUIState;
  let ectx: EventHandlerContext;

  beforeEach(() => {
    controller = createMockAgentController({
      tasks: [{ content: 'Old task', status: 'in_progress', activeForm: 'Working' }],
      activePlan: { title: 'Old plan', plan: '# Plan', approvedAt: '2026-01-01' },
      sandboxAllowedPaths: ['/tmp/allowed'],
      currentModelId: 'openai/gpt-5.4',
    });
    state = createMockTUIState(controller);
    ectx = createMockEctx();
  });

  it('updates the active and terminal titles when a generated title arrives', async () => {
    await dispatchEvent(
      { type: 'thread_title_updated', threadId: 'thread-1', title: 'Generated demo title' } as any,
      ectx,
      state,
    );

    expect(state.currentThreadTitle).toBe('Generated demo title');
    expect(state.ui.terminal.setTitle).toHaveBeenCalledWith('Mastra Code - Generated demo title');
    expect(ectx.updateStatusLine).toHaveBeenCalledOnce();
  });

  it('ignores generated titles from another thread', async () => {
    await dispatchEvent(
      { type: 'thread_title_updated', threadId: 'thread-2', title: 'Wrong thread' } as any,
      ectx,
      state,
    );

    expect(state.currentThreadTitle).toBe('Old thread');
    expect(state.ui.terminal.setTitle).not.toHaveBeenCalled();
  });

  it('strips terminal escape sequences and control characters from generated titles', async () => {
    await dispatchEvent(
      {
        type: 'thread_title_updated',
        threadId: 'thread-1',
        title: 'Safe\x07\x1b]0;unsafe\x07Visible \x1b[31mRed\x1b[0m',
      } as any,
      ectx,
      state,
    );

    expect(state.currentThreadTitle).toBe('Safe Visible Red');
    expect(state.ui.terminal.setTitle).toHaveBeenCalledWith('Mastra Code - Safe Visible Red');
  });

  it('resets token usage when switching threads', async () => {
    state.latestRequestPromptTokens = 90_000;

    await dispatchEvent(
      { type: 'thread_changed', threadId: 'new-thread', previousThreadId: 'old-thread' } as any,
      ectx,
      state,
    );

    expect(state.latestRequestPromptTokens).toBeUndefined();
  });

  it('resets token usage when creating a thread', async () => {
    state.latestRequestPromptTokens = 90_000;

    await dispatchEvent(
      { type: 'thread_created', thread: { id: 'brand-new', title: 'Brand New' } } as any,
      ectx,
      state,
    );

    expect(state.latestRequestPromptTokens).toBeUndefined();
  });

  it('persists only explicitly pending goals to created threads', async () => {
    const goalManager = state.goalManager as any;
    goalManager.consumePersistOnNextThreadCreate.mockReturnValueOnce(true);

    await dispatchEvent(
      { type: 'thread_created', thread: { id: 'brand-new', title: 'Brand New', metadata: { goal: null } } } as any,
      ectx,
      state,
    );

    expect(goalManager.saveToThread).toHaveBeenCalledWith(state);
    expect(goalManager.loadFromThreadMetadata).not.toHaveBeenCalled();
  });

  it('loads thread metadata instead of copying non-pending goals to created threads', async () => {
    const goalManager = state.goalManager as any;

    await dispatchEvent(
      {
        type: 'thread_created',
        thread: { id: 'brand-new', title: 'Brand New', metadata: { goal: { status: 'done' } } },
      } as any,
      ectx,
      state,
    );

    expect(goalManager.saveToThread).not.toHaveBeenCalled();
    expect(goalManager.loadFromThreadMetadata).toHaveBeenCalledWith({ goal: { status: 'done' } });
  });

  it('resets taskToolInsertIndex on thread_changed', async () => {
    await dispatchEvent(
      { type: 'thread_changed', threadId: 'new-thread', previousThreadId: 'old-thread' } as any,
      ectx,
      state,
    );

    expect(state.taskToolInsertIndex).toBe(-1);
  });

  it('resets taskToolInsertIndex on thread_created', async () => {
    await dispatchEvent(
      { type: 'thread_created', thread: { id: 'brand-new', title: 'Brand New' } } as any,
      ectx,
      state,
    );

    expect(state.taskToolInsertIndex).toBe(-1);
  });

  it('clears taskProgress UI component on thread_changed', async () => {
    await dispatchEvent(
      { type: 'thread_changed', threadId: 'new-thread', previousThreadId: 'old-thread' } as any,
      ectx,
      state,
    );

    expect((state.taskProgress as any).updateTasks).toHaveBeenCalledWith([]);
  });

  it('clears taskProgress UI component on thread_created', async () => {
    await dispatchEvent(
      { type: 'thread_created', thread: { id: 'brand-new', title: 'Brand New' } } as any,
      ectx,
      state,
    );

    expect((state.taskProgress as any).updateTasks).toHaveBeenCalledWith([]);
  });

  it('leaves the status line alone when the observer renames another thread of the session', async () => {
    await dispatchEvent(
      { type: 'om_thread_title_updated', cycleId: 'cycle-1', threadId: 'other-thread', newTitle: 'Log parser rewrite' },
      ectx,
      state,
    );

    expect(state.currentThreadTitle).toBe('Old thread');
  });

  it('does not clear non-ephemeral state like currentModelId', async () => {
    await dispatchEvent(
      { type: 'thread_created', thread: { id: 'brand-new', title: 'Brand New' } } as any,
      ectx,
      state,
    );

    const setStateCall = (state.session.state.set as any).mock.calls[0]![0];
    expect(setStateCall).not.toHaveProperty('currentModelId');
  });
});

describe('dispatchEvent task updates', () => {
  it('restores completed tasks without rendering a completion action', async () => {
    const state = createMockTUIState(createMockAgentController());
    const ectx = createMockEctx();
    const tasks: TaskItemSnapshot[] = [
      { id: 'done', content: 'Already finished', status: 'completed', activeForm: 'Finishing' },
    ];
    await dispatchEvent(
      { type: 'task_snapshot', snapshot: { threadId: 'thread-1', status: 'ready', tasks } },
      ectx,
      state,
    );

    expect(state.taskProgress!.updateTasks).toHaveBeenCalledWith(tasks);
    expect(ectx.renderCompletedTasksInline).not.toHaveBeenCalled();
    expect(ectx.renderTaskDeltaInline).not.toHaveBeenCalled();
    expect(ectx.renderClearedTasksInline).not.toHaveBeenCalled();
  });

  it('does not clear a restored task list when an older thread reset finishes', async () => {
    const state = createMockTUIState(createMockAgentController());
    const ectx = createMockEctx();
    const pendingState = Promise.withResolvers<void>();
    vi.spyOn(state.session.state, 'set').mockImplementationOnce(() => pendingState.promise);
    const changed = dispatchEvent(
      { type: 'thread_changed', threadId: 'thread-1', previousThreadId: 'old-thread' },
      ectx,
      state,
    );
    const tasks: TaskItemSnapshot[] = [
      { id: 'current', content: 'Current task', status: 'pending', activeForm: 'Working' },
    ];
    await dispatchEvent(
      { type: 'task_snapshot', snapshot: { threadId: 'thread-1', status: 'ready', tasks } },
      ectx,
      state,
    );
    pendingState.resolve();
    await changed;

    expect(state.taskProgress!.updateTasks).toHaveBeenLastCalledWith(tasks);
  });

  it('renders task delta receipts for live non-terminal task updates', async () => {
    const previousTasks = [
      { id: 'task-1', content: 'Task 1', status: 'pending' as const, activeForm: 'Working on task 1' },
    ];
    const tasks = [
      { id: 'task-1', content: 'Task 1', status: 'completed' as const, activeForm: 'Working on task 1' },
      { id: 'task-2', content: 'Task 2', status: 'in_progress' as const, activeForm: 'Working on task 2' },
      { id: 'task-3', content: 'Task 3', status: 'pending' as const, activeForm: 'Working on task 3' },
    ];
    const state = createMockTUIState(createMockAgentController({}, previousTasks));
    const ectx = createMockEctx();

    await dispatchEvent({ type: 'task_updated', threadId: 'thread-1', tasks }, ectx, state);

    expect(state.taskProgress!.updateTasks).toHaveBeenCalledWith(tasks);
    expect(ectx.renderTaskDeltaInline).toHaveBeenCalledWith(previousTasks, tasks, 5);
    expect(ectx.renderCompletedTasksInline).not.toHaveBeenCalled();
    expect(ectx.renderClearedTasksInline).not.toHaveBeenCalled();
  });

  it('renders a completed-task receipt when all tasks complete live', async () => {
    const tasks = [{ id: 'task-1', content: 'Task 1', status: 'completed' as const, activeForm: 'Completing task 1' }];
    const state = createMockTUIState(createMockAgentController());
    const ectx = createMockEctx();

    await dispatchEvent({ type: 'task_updated', threadId: 'thread-1', tasks }, ectx, state);

    expect(state.taskProgress!.updateTasks).toHaveBeenCalledWith(tasks);
    expect(ectx.renderCompletedTasksInline).toHaveBeenCalledWith(tasks, 5);
    expect(ectx.renderClearedTasksInline).not.toHaveBeenCalled();
    expect(state.taskToolInsertIndex).toBe(-1);
  });

  it('renders a cleared-tasks receipt when the list is emptied', async () => {
    const previousTasks = [
      { id: 'task-1', content: 'Task 1', status: 'in_progress' as const, activeForm: 'Working on task 1' },
    ];
    const state = createMockTUIState(createMockAgentController({}, previousTasks));
    const ectx = createMockEctx();

    await dispatchEvent({ type: 'task_updated', threadId: 'thread-1', tasks: [] }, ectx, state);

    expect(ectx.renderClearedTasksInline).toHaveBeenCalledWith(previousTasks, expect.anything());
  });
});
