import { beforeEach, describe, expect, it, vi } from 'vitest';

import { dispatchEvent } from '../event-dispatch.js';
import type { EventHandlerContext } from '../handlers/types.js';
import type { TUIState } from '../state.js';

/**
 * Minimal mock harness for testing thread lifecycle events.
 * Tracks setState calls to verify per-thread state is cleared.
 */
function createMockHarness(initialState: Record<string, unknown> = {}) {
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
      previousTasks: [],
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
    taskWriteInsertIndex: 5,
    ui: { requestRender: vi.fn() },
    projectInfo: { rootPath: '/tmp/test', gitBranch: 'main' },
    currentThreadTitle: 'Old thread',
    editor: { escapeEnabled: false },
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

describe('thread lifecycle clears per-thread harness state', () => {
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

  it('resets taskWriteInsertIndex on thread_changed', async () => {
    await dispatchEvent(
      { type: 'thread_changed', threadId: 'new-thread', previousThreadId: 'old-thread' } as any,
      ectx,
      state,
    );

    expect(state.taskWriteInsertIndex).toBe(-1);
  });

  it('resets taskWriteInsertIndex on thread_created', async () => {
    await dispatchEvent(
      { type: 'thread_created', thread: { id: 'brand-new', title: 'Brand New' } } as any,
      ectx,
      state,
    );

    expect(state.taskWriteInsertIndex).toBe(-1);
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

    // setState should only be called with per-thread fields, not resource-level settings
    const setStateCall = harness.setState.mock.calls[0]![0];
    expect(setStateCall).not.toHaveProperty('currentModelId');
  });
});
