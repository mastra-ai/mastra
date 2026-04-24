import { describe, expect, it, vi } from 'vitest';

import { handleNewCommand } from '../new.js';
import type { SlashCommandContext } from '../types.js';

function createContext() {
  const harnessState: {
    tasks: unknown[];
    activePlan: unknown | null;
    sandboxAllowedPaths: string[];
  } = {
    tasks: [{ content: 'leftover', status: 'pending', activeForm: 'leftover' }],
    activePlan: { title: 'stale', plan: 'stale', approvedAt: '2026-01-01T00:00:00.000Z' },
    sandboxAllowedPaths: ['/tmp/leftover-allowed-path'],
  };
  const setState = vi.fn(async (updates: Record<string, unknown>) => {
    Object.assign(harnessState, updates);
  });
  const modifiedFiles = new Map<string, unknown>([['/tmp/a.ts', {}]]);

  const ctx = {
    state: {
      pendingNewThread: false,
      chatContainer: { clear: vi.fn() },
      pendingTools: { clear: vi.fn() },
      allToolComponents: [{}],
      allSlashCommandComponents: [{}],
      allSystemReminderComponents: [{}],
      messageComponentsById: { clear: vi.fn() },
      allShellComponents: [{}],
      harness: {
        getDisplayState: vi.fn(() => ({ modifiedFiles })),
        setState,
        getState: vi.fn(() => harnessState),
      },
      taskProgress: { updateTasks: vi.fn() },
      taskWriteInsertIndex: 3,
      ui: { requestRender: vi.fn() },
    },
    updateStatusLine: vi.fn(),
    showInfo: vi.fn(),
  } as unknown as SlashCommandContext;

  return { ctx, harnessState, setState };
}

describe('handleNewCommand', () => {
  it('clears ephemeral per-thread harness state (tasks, activePlan, sandboxAllowedPaths)', async () => {
    const { ctx, harnessState, setState } = createContext();

    await handleNewCommand(ctx);

    expect(setState).toHaveBeenCalledWith({
      tasks: [],
      activePlan: null,
      sandboxAllowedPaths: [],
    });
    expect(harnessState.tasks).toEqual([]);
    expect(harnessState.activePlan).toBeNull();
    expect(harnessState.sandboxAllowedPaths).toEqual([]);
    expect(ctx.state.pendingNewThread).toBe(true);
    expect(ctx.state.taskWriteInsertIndex).toBe(-1);
  });
});
