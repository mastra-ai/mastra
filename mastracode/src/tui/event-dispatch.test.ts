import type { TaskItemSnapshot } from '@mastra/core/harness';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { dispatchEvent } from './event-dispatch.js';
import type { EventHandlerContext } from './handlers/types.js';
import type { TUIState } from './state.js';

function createMockHarness(initialState: Record<string, unknown> = {}, previousTasks: TaskItemSnapshot[] = []) {
  let state = { ...initialState };
  return {
    state,
    getState: () => ({ ...state }),
    setState: vi.fn(async (updates: Record<string, unknown>) => {
      state = { ...state, ...updates };
    }),
    loadOMProgress: vi.fn().mockResolvedValue(undefined),
    listThreads: vi.fn().mockResolvedValue([]),
    getDisplayState: () => ({
      isRunning: false,
      tasks: [],
      previousTasks,
      omProgress: { status: 'idle', pendingTokens: 0 },
      modifiedFiles: new Map(),
    }),
  };
}

function createMockTUIState(harness: ReturnType<typeof createMockHarness>): TUIState {
  return {
    harness: harness as any,
    taskProgress: {
      updateTasks: vi.fn(),
      getTasks: () => [],
    },
    allToolComponents: [],
    chatContainer: { children: [] },
    taskToolInsertIndex: 5,
    ui: { requestRender: vi.fn() },
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
    renderCompletedTasksInline: vi.fn(),
    renderClearedTasksInline: vi.fn(),
  } as unknown as EventHandlerContext;
}

describe('dispatchEvent thread lifecycle', () => {
  let harness: ReturnType<typeof createMockHarness>;
  let state: TUIState;
  let ectx: EventHandlerContext;

  beforeEach(() => {
    harness = createMockHarness({
      tasks: [{ content: 'Old task', status: 'in_progress', activeForm: 'Working' }],
      activePlan: { title: 'Old plan', plan: '# Plan', approvedAt: '2026-01-01' },
      sandboxAllowedPaths: ['/tmp/allowed'],
      currentModelId: 'openai/gpt-5.4',
    });
    state = createMockTUIState(harness);
    ectx = createMockEctx();
  });

  it('clears tasks, activePlan, and sandboxAllowedPaths on thread_changed', async () => {
    await dispatchEvent(
      { type: 'thread_changed', threadId: 'new-thread', previousThreadId: 'old-thread' } as any,
      ectx,
      state,
    );

    expect(harness.setState).toHaveBeenCalledWith(
      expect.objectContaining({
        tasks: [],
        activePlan: null,
        sandboxAllowedPaths: [],
      }),
    );
  });

  it('clears tasks, activePlan, and sandboxAllowedPaths on thread_created', async () => {
    await dispatchEvent(
      { type: 'thread_created', thread: { id: 'brand-new', title: 'Brand New' } } as any,
      ectx,
      state,
    );

    expect(harness.setState).toHaveBeenCalledWith(
      expect.objectContaining({
        tasks: [],
        activePlan: null,
        sandboxAllowedPaths: [],
      }),
    );
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

  it('does not clear non-ephemeral state like currentModelId', async () => {
    await dispatchEvent(
      { type: 'thread_created', thread: { id: 'brand-new', title: 'Brand New' } } as any,
      ectx,
      state,
    );

    const setStateCall = harness.setState.mock.calls[0]![0];
    expect(setStateCall).not.toHaveProperty('currentModelId');
  });
});

describe('dispatchEvent task updates', () => {
  it('uses recorded task insertion index when rendering completed tasks', async () => {
    const tasks = [{ id: 'task-1', content: 'Task 1', status: 'completed' as const, activeForm: 'Completing task 1' }];
    const state = createMockTUIState(createMockHarness());
    const ectx = createMockEctx();

    await dispatchEvent({ type: 'task_updated', tasks }, ectx, state);

    expect(ectx.renderCompletedTasksInline).toHaveBeenCalledWith(tasks, 5, true);
    expect(state.taskToolInsertIndex).toBe(-1);
  });

  it('does not render a duplicate completed task list for repeated all-completed updates', async () => {
    const tasks = [{ id: 'task-1', content: 'Task 1', status: 'completed' as const, activeForm: 'Completing task 1' }];
    const state = createMockTUIState(createMockHarness({}, tasks));
    const ectx = createMockEctx();

    await dispatchEvent({ type: 'task_updated', tasks }, ectx, state);

    expect(ectx.renderCompletedTasksInline).not.toHaveBeenCalled();
  });
});
