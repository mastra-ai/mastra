import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ApprovalAction, ToolApprovalDialogOptions } from '../components/tool-approval-dialog.js';
import { handleToolApprovalRequired } from '../handlers/tool.js';
import type { EventHandlerContext } from '../handlers/types.js';
import type { TUIState } from '../state.js';

const mocks = vi.hoisted(() => ({
  showModalOverlay: vi.fn(),
  flushRender: vi.fn(),
  lastDialog: undefined as
    | {
        focused: boolean;
        options: ToolApprovalDialogOptions;
      }
    | undefined,
}));

vi.mock('../overlay.js', () => ({
  showModalOverlay: mocks.showModalOverlay,
}));

vi.mock('../render-scheduler.js', () => ({
  DEFAULT_RENDER_COALESCE_MS: 16,
  requestRender: vi.fn(),
  flushRender: mocks.flushRender,
}));

vi.mock('../components/tool-approval-dialog.js', () => {
  class MockToolApprovalDialogComponent {
    focused = false;
    constructor(public options: ToolApprovalDialogOptions) {
      mocks.lastDialog = this;
    }
  }
  return { ToolApprovalDialogComponent: MockToolApprovalDialogComponent };
});

function createGoalTimer() {
  let activeStartedAt: number | null = Date.now();
  let activeDurationMs = 0;
  const status = 'active' as const;

  return {
    startActiveTimer: vi.fn(() => {
      if (activeStartedAt === null) activeStartedAt = Date.now();
    }),
    stopActiveTimer: vi.fn(() => {
      if (activeStartedAt === null) return;
      activeDurationMs += Date.now() - activeStartedAt;
      activeStartedAt = null;
    }),
    saveToThread: vi.fn().mockResolvedValue(undefined),
    getGoal: () => ({ status, activeDurationMs, activeStartedAt }),
  };
}

function createContext() {
  const goalManager = createGoalTimer();
  const state = {
    goalManager,
    ui: { hideOverlay: vi.fn() },
    session: {
      respondToToolApproval: vi.fn(),
      state: { set: vi.fn().mockResolvedValue(undefined) },
    },
    pendingApprovalDismiss: null,
  } as unknown as TUIState;
  const ctx = {
    state,
    notify: vi.fn(),
  } as unknown as EventHandlerContext;
  return { ctx, goalManager, state };
}

function act(action: ApprovalAction): void {
  const dialog = mocks.lastDialog;
  if (!dialog) throw new Error('approval dialog was not shown');
  dialog.options.onAction(action);
}

describe('tool approval goal timing', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    mocks.showModalOverlay.mockReset();
    mocks.flushRender.mockReset();
    mocks.lastDialog = undefined;
  });

  it.each([
    ['approve', { type: 'approve' } as const, { decision: 'approve' }],
    ['always allow category', { type: 'always_allow_category' } as const, { decision: 'always_allow_category' }],
    ['yolo', { type: 'yolo' } as const, { decision: 'approve' }],
    ['decline', { type: 'decline' } as const, { decision: 'decline' }],
  ])('excludes overlay time and resumes once for %s', async (_name, action, expectedResponse) => {
    const { ctx, goalManager, state } = createContext();
    vi.advanceTimersByTime(100);

    await handleToolApprovalRequired(ctx, 'call-1', 'execute_command', { command: 'pwd' });
    expect(goalManager.getGoal()).toMatchObject({ status: 'active', activeDurationMs: 100, activeStartedAt: null });

    vi.advanceTimersByTime(5_000);
    act(action);
    vi.advanceTimersByTime(200);
    goalManager.stopActiveTimer();

    expect(goalManager.getGoal()).toMatchObject({ status: 'active', activeDurationMs: 300 });
    expect(goalManager.startActiveTimer).toHaveBeenCalledTimes(1);
    expect(state.session.respondToToolApproval).toHaveBeenCalledWith(expectedResponse);
  });

  it('resumes once when the dialog is dismissed with decline context', async () => {
    const { ctx, goalManager, state } = createContext();
    vi.advanceTimersByTime(100);
    await handleToolApprovalRequired(ctx, 'call-1', 'execute_command', {});

    vi.advanceTimersByTime(5_000);
    state.pendingApprovalDismiss?.({ reason: 'escape' });
    vi.advanceTimersByTime(200);
    goalManager.stopActiveTimer();

    expect(goalManager.getGoal()).toMatchObject({ status: 'active', activeDurationMs: 300 });
    expect(goalManager.startActiveTimer).toHaveBeenCalledTimes(1);
    expect(state.session.respondToToolApproval).toHaveBeenCalledWith({
      decision: 'decline',
      declineContext: { reason: 'escape' },
    });
  });

  it('stops immediately and waits for persistence before showing or answering the dialog', async () => {
    const { ctx, goalManager, state } = createContext();
    let finishSave!: () => void;
    goalManager.saveToThread.mockImplementation(
      () =>
        new Promise<void>(resolve => {
          finishSave = resolve;
        }),
    );

    const pending = handleToolApprovalRequired(ctx, 'call-1', 'execute_command', {});
    expect(goalManager.stopActiveTimer).toHaveBeenCalledTimes(1);
    expect(goalManager.saveToThread).toHaveBeenCalledWith(state);
    expect(mocks.showModalOverlay).not.toHaveBeenCalled();
    expect(state.session.respondToToolApproval).not.toHaveBeenCalled();

    finishSave();
    await pending;
    expect(mocks.showModalOverlay).toHaveBeenCalledTimes(1);
    act({ type: 'approve' });
    expect(goalManager.startActiveTimer).toHaveBeenCalledTimes(1);
    expect(state.session.respondToToolApproval).toHaveBeenCalledWith({ decision: 'approve' });
  });

  it('excludes two sequential approval waits in the same run', async () => {
    const { ctx, goalManager } = createContext();
    vi.advanceTimersByTime(100);
    await handleToolApprovalRequired(ctx, 'call-1', 'execute_command', {});
    vi.advanceTimersByTime(1_000);
    act({ type: 'approve' });

    vi.advanceTimersByTime(200);
    await handleToolApprovalRequired(ctx, 'call-2', 'write_file', {});
    vi.advanceTimersByTime(1_000);
    act({ type: 'decline' });

    vi.advanceTimersByTime(100);
    goalManager.stopActiveTimer();
    expect(goalManager.getGoal()).toMatchObject({ status: 'active', activeDurationMs: 400 });
    expect(goalManager.stopActiveTimer).toHaveBeenCalledTimes(3);
    expect(goalManager.startActiveTimer).toHaveBeenCalledTimes(2);
    expect(goalManager.saveToThread).toHaveBeenCalledTimes(2);
  });
});
