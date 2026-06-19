import { describe, expect, it, vi } from 'vitest';

import { handleNewCommand } from '../new.js';
import type { SlashCommandContext } from '../types.js';

function createMockState() {
  return {
    pendingNewThread: false,
    chatContainer: { clear: vi.fn() },
    pendingTools: { clear: vi.fn() },
    pendingTaskToolIds: { clear: vi.fn() },
    allToolComponents: [{}],
    allSlashCommandComponents: [{}],
    allSystemReminderComponents: [{}],
    messageComponentsById: new Map([['a', {}]]),
    allShellComponents: [{}],
    taskProgress: { updateTasks: vi.fn() },
    taskToolInsertIndex: 5,
    session: { state: { set: vi.fn(async () => {}) } },
    harness: {
      abort: vi.fn(),
      detachFromCurrentThread: vi.fn(),
      session: { displayState: { get: vi.fn(() => ({ modifiedFiles: new Map([['f', true]]) })) } },
      setState: vi.fn(async () => {}),
    },
    ui: { requestRender: vi.fn() },
  } as any;
}

function createCtx(state: ReturnType<typeof createMockState>): SlashCommandContext {
  return {
    state,
    updateStatusLine: vi.fn(),
    showInfo: vi.fn(),
  } as unknown as SlashCommandContext;
}

describe('handleNewCommand', () => {
  it('detaches from current thread before setting pendingNewThread', async () => {
    const state = createMockState();
    const ctx = createCtx(state);
    const callOrder: string[] = [];

    state.harness.detachFromCurrentThread.mockImplementation(() => {
      callOrder.push('detach');
    });
    const origPendingNewThread = Object.getOwnPropertyDescriptor(state, 'pendingNewThread');
    Object.defineProperty(state, 'pendingNewThread', {
      set(v: boolean) {
        if (v) callOrder.push('pendingNewThread');
        Object.defineProperty(state, 'pendingNewThread', { value: v, writable: true, configurable: true });
      },
      get() {
        return origPendingNewThread?.value ?? false;
      },
      configurable: true,
    });

    await handleNewCommand(ctx);

    expect(state.harness.detachFromCurrentThread).toHaveBeenCalledOnce();
    expect(callOrder).toEqual(['detach', 'pendingNewThread']);
  });

  it('clears UI state and ephemeral thread state', async () => {
    const state = createMockState();
    const ctx = createCtx(state);

    await handleNewCommand(ctx);

    expect(state.chatContainer.clear).toHaveBeenCalled();
    expect(state.pendingTools.clear).toHaveBeenCalled();
    expect(state.allToolComponents).toEqual([]);
    expect(state.allSlashCommandComponents).toEqual([]);
    expect(state.allSystemReminderComponents).toEqual([]);
    expect(state.messageComponentsById.size).toBe(0);
    expect(state.allShellComponents).toEqual([]);
    expect(state.session.state.set).toHaveBeenCalledWith({
      tasks: [],
      activePlan: null,
      sandboxAllowedPaths: [],
    });
    expect(state.taskProgress.updateTasks).toHaveBeenCalledWith([]);
    expect(state.taskToolInsertIndex).toBe(-1);
    expect(ctx.updateStatusLine).toHaveBeenCalled();
    expect(state.ui.requestRender).toHaveBeenCalled();
  });
});
