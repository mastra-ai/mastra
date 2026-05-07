import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  addUserMessage: vi.fn(),
  showInfo: vi.fn(),
  showError: vi.fn(),
}));

vi.mock('../render-messages.js', async importOriginal => {
  const actual = await importOriginal();
  return {
    ...actual,
    addUserMessage: mocks.addUserMessage,
  };
});

vi.mock('../display.js', () => ({
  showInfo: mocks.showInfo,
  showError: mocks.showError,
  showFormattedError: vi.fn(),
  notify: vi.fn(),
}));

import { GOAL_JUDGE_INPUT_LOCK_MESSAGE } from '../goal-input-lock.js';
import { handleAgentEnd } from '../handlers/agent-lifecycle.js';
import type { EventHandlerContext } from '../handlers/types.js';
import { MastraTUI, consumePendingImages, syncInitialThreadState } from '../mastra-tui.js';
import type { TUIState } from '../state.js';

function createQueueState(overrides: Partial<TUIState> = {}): TUIState {
  return {
    harness: {
      getFollowUpCount: vi.fn(() => 0),
    },
    gradientAnimator: undefined,
    projectInfo: { rootPath: '.', gitBranch: 'main' } as TUIState['projectInfo'],
    streamingComponent: undefined,
    streamingMessage: undefined,
    followUpComponents: [],
    pendingFollowUpMessages: [],
    pendingQueuedActions: [],
    pendingSlashCommands: [],
    pendingTools: new Map(),
    chatContainer: {
      children: [],
      addChild: vi.fn(function (this: any, child: unknown) {
        this.children.push(child);
      }),
      invalidate: vi.fn(),
    },
    allToolComponents: [],
    allSlashCommandComponents: [],
    allSystemReminderComponents: [],
    allShellComponents: [],
    ui: { requestRender: vi.fn() } as TUIState['ui'],
    ...overrides,
  } as unknown as TUIState;
}

function createQueueContext(state: TUIState, overrides: Partial<EventHandlerContext> = {}): EventHandlerContext {
  return {
    state,
    showInfo: vi.fn(),
    showError: vi.fn(),
    showFormattedError: vi.fn(),
    updateStatusLine: vi.fn(),
    notify: vi.fn(),
    handleSlashCommand: vi.fn().mockResolvedValue(true),
    addUserMessage: vi.fn(),
    addChildBeforeFollowUps: vi.fn(),
    fireMessage: vi.fn(),
    queueFollowUpMessage: vi.fn(),
    renderExistingMessages: vi.fn(),
    renderCompletedTasksInline: vi.fn(),
    renderClearedTasksInline: vi.fn(),
    refreshModelAuthStatus: vi.fn(),
    ...overrides,
  };
}

describe('MastraTUI queueing', () => {
  beforeEach(() => {
    mocks.addUserMessage.mockReset();
    mocks.showInfo.mockReset();
    mocks.showError.mockReset();
  });

  it('queues editor submissions instead of resolving input while the harness is running', async () => {
    const editor = {
      onSubmit: undefined as ((text: string) => void) | undefined,
      addToHistory: vi.fn(),
      setText: vi.fn(),
    };
    const state = {
      editor,
      harness: { isRunning: vi.fn(() => true) },
      pendingSlashCommands: [],
      pendingQueuedActions: [],
      pendingFollowUpMessages: [],
      pendingImages: [],
      ui: { requestRender: vi.fn() },
      chatContainer: {},
      followUpComponents: [],
    };

    const tui = Object.create(MastraTUI.prototype) as {
      state: typeof state;
      getUserInput: () => Promise<string>;
      queueFollowUpMessage: (text: string) => void;
    };
    tui.state = state;
    tui.queueFollowUpMessage = vi.fn();

    const pendingInput = tui.getUserInput();
    editor.onSubmit?.('queued follow-up');

    expect(editor.addToHistory).toHaveBeenCalledWith('queued follow-up');
    expect(editor.setText).toHaveBeenCalledWith('');
    expect(tui.queueFollowUpMessage).toHaveBeenCalledWith('queued follow-up');

    const resolution = await Promise.race([
      pendingInput.then(value => ({ resolved: true as const, value })),
      Promise.resolve({ resolved: false as const, value: undefined }),
    ]);
    expect(resolution).toEqual({ resolved: false, value: undefined });
  });

  it('blocks editor submissions while the goal judge is evaluating', async () => {
    const editor = {
      onSubmit: undefined as ((text: string) => void) | undefined,
      addToHistory: vi.fn(),
      setText: vi.fn(),
    };
    const state = {
      editor,
      activeGoalJudge: { modelId: 'openai/gpt-5.5' },
      harness: { isRunning: vi.fn(() => false) },
      pendingSlashCommands: [],
      pendingQueuedActions: [],
      pendingFollowUpMessages: [],
      pendingImages: [],
      ui: { requestRender: vi.fn() },
      chatContainer: {},
      followUpComponents: [],
    };

    const tui = Object.create(MastraTUI.prototype) as {
      state: typeof state;
      getUserInput: () => Promise<string>;
      queueFollowUpMessage: (text: string) => void;
    };
    tui.state = state;
    tui.queueFollowUpMessage = vi.fn();

    const pendingInput = tui.getUserInput();
    editor.onSubmit?.('wait for judge');

    expect(editor.addToHistory).not.toHaveBeenCalled();
    expect(editor.setText).toHaveBeenCalledWith('wait for judge');
    expect(tui.queueFollowUpMessage).not.toHaveBeenCalled();
    expect(mocks.showInfo).toHaveBeenCalledWith(state, GOAL_JUDGE_INPUT_LOCK_MESSAGE);
    expect(state.ui.requestRender).toHaveBeenCalled();

    const resolution = await Promise.race([
      pendingInput.then(value => ({ resolved: true as const, value })),
      Promise.resolve({ resolved: false as const, value: undefined }),
    ]);
    expect(resolution).toEqual({ resolved: false, value: undefined });
  });

  it('queues follow-up messages with images in FIFO order metadata', () => {
    const tui = Object.create(MastraTUI.prototype) as {
      state: any;
      queueFollowUpMessage: (text: string) => void;
    };
    tui.state = {
      pendingSlashCommands: [],
      pendingQueuedActions: [],
      pendingFollowUpMessages: [],
      pendingImages: [{ data: 'img-1', mimeType: 'image/png' }],
      ui: { requestRender: vi.fn() },
      chatContainer: {},
      followUpComponents: [],
    };

    tui.queueFollowUpMessage('review this [image]');
    tui.queueFollowUpMessage('/help');
    tui.queueFollowUpMessage('second message');

    expect(tui.state.pendingQueuedActions).toEqual(['message', 'slash', 'message']);
    expect(tui.state.pendingFollowUpMessages).toEqual([
      { content: 'review this', images: [{ data: 'img-1', mimeType: 'image/png' }] },
      { content: 'second message', images: undefined },
    ]);
    expect(tui.state.pendingSlashCommands).toEqual(['/help']);
    expect(tui.state.ui.requestRender).toHaveBeenCalledTimes(3);
  });

  it('drains queued messages and slash commands in FIFO order on agent end', async () => {
    const state = createQueueState({
      pendingQueuedActions: ['message', 'slash', 'message'],
      pendingFollowUpMessages: [{ content: 'first' }, { content: 'third' }],
      pendingSlashCommands: ['/second'],
    });
    const ctx = createQueueContext(state);

    handleAgentEnd(ctx);
    expect(ctx.addUserMessage).toHaveBeenCalledWith({
      id: expect.stringMatching(/^user-/),
      role: 'user',
      content: [{ type: 'text', text: 'first' }],
      createdAt: expect.any(Date),
    });
    expect(ctx.fireMessage).toHaveBeenCalledWith('first', undefined);
    expect(ctx.handleSlashCommand).not.toHaveBeenCalled();

    handleAgentEnd(ctx);
    expect(ctx.handleSlashCommand).toHaveBeenCalledWith('/second');

    handleAgentEnd(ctx);
    expect(ctx.addUserMessage).toHaveBeenLastCalledWith({
      id: expect.stringMatching(/^user-/),
      role: 'user',
      content: [{ type: 'text', text: 'third' }],
      createdAt: expect.any(Date),
    });
    expect(ctx.fireMessage).toHaveBeenLastCalledWith('third', undefined);

    expect(state.pendingQueuedActions).toEqual([]);
    expect(state.pendingFollowUpMessages).toEqual([]);
    expect(state.pendingSlashCommands).toEqual([]);
    expect(ctx.updateStatusLine).toHaveBeenCalledTimes(6);
  });

  it('drains queued user actions before goal continuation when queued during judge evaluation', async () => {
    let resolveEvaluation:
      | ((value: { continuation: string; judgeResult: { decision: 'continue'; reason: string } }) => void)
      | undefined;
    const state = createQueueState({
      gradientAnimator: { fadeOut: vi.fn(), start: vi.fn() } as any,
      goalManager: {
        isActive: vi.fn(() => true),
        getGoal: vi.fn(() => ({
          id: 'goal-1',
          status: 'active',
          judgeModelId: 'openai/gpt-5.5',
          turnsUsed: 1,
          maxTurns: 20,
        })),
        evaluateAfterTurn: vi.fn(
          () =>
            new Promise(resolve => {
              resolveEvaluation = resolve;
            }),
        ),
      } as any,
    });
    const ctx = createQueueContext(state);

    handleAgentEnd(ctx);
    state.pendingQueuedActions.push('message');
    state.pendingFollowUpMessages.push({ content: 'user follow-up' });
    resolveEvaluation?.({
      continuation: 'goal continuation',
      judgeResult: { decision: 'continue', reason: 'Keep going.' },
    });

    await vi.waitFor(() => {
      expect(ctx.fireMessage).toHaveBeenCalledWith('user follow-up', undefined);
    });
    expect(ctx.fireMessage).not.toHaveBeenCalledWith('goal continuation');
    expect(ctx.addUserMessage).toHaveBeenCalledWith({
      id: expect.stringMatching(/^user-/),
      role: 'user',
      content: [{ type: 'text', text: 'user follow-up' }],
      createdAt: expect.any(Date),
    });
  });

  it('does not continue a goal that was paused while judge evaluation was running', async () => {
    let goal: { id: string; status: 'active' | 'paused'; judgeModelId: string; turnsUsed: number; maxTurns: number } = {
      id: 'goal-1',
      status: 'active',
      judgeModelId: 'openai/gpt-5.5',
      turnsUsed: 1,
      maxTurns: 20,
    };
    let resolveEvaluation:
      | ((value: { continuation: string; judgeResult: { decision: 'continue'; reason: string } }) => void)
      | undefined;
    const state = createQueueState({
      gradientAnimator: { fadeOut: vi.fn(), start: vi.fn() } as any,
      goalManager: {
        isActive: vi.fn(() => true),
        getGoal: vi.fn(() => goal),
        evaluateAfterTurn: vi.fn(
          () =>
            new Promise(resolve => {
              resolveEvaluation = resolve;
            }),
        ),
      } as any,
    });
    const ctx = createQueueContext(state);

    handleAgentEnd(ctx);
    goal = { ...goal, status: 'paused' };
    resolveEvaluation?.({
      continuation: 'goal continuation',
      judgeResult: { decision: 'continue', reason: 'Keep going.' },
    });

    await vi.waitFor(() => {
      expect(state.gradientAnimator?.fadeOut).toHaveBeenCalled();
    });
    expect(ctx.fireMessage).not.toHaveBeenCalledWith('goal continuation');
  });

  it('persists terminal goal judge responses when no continuation is queued', async () => {
    const saveSystemReminderMessage = vi.fn().mockResolvedValue(null);
    const state = createQueueState({
      harness: {
        getFollowUpCount: vi.fn(() => 0),
        saveSystemReminderMessage,
      } as any,
      gradientAnimator: { fadeOut: vi.fn(), start: vi.fn() } as any,
      goalManager: {
        isActive: vi.fn(() => true),
        getGoal: vi.fn(() => ({ status: 'active', judgeModelId: 'openai/gpt-5.5', turnsUsed: 1, maxTurns: 20 })),
        evaluateAfterTurn: vi.fn().mockResolvedValue({
          continuation: null,
          judgeResult: { decision: 'waiting', reason: 'Waiting for explicit verification.' },
        }),
      } as any,
    });
    const ctx = createQueueContext(state);

    handleAgentEnd(ctx);

    await vi.waitFor(() => {
      expect(saveSystemReminderMessage).toHaveBeenCalledWith({
        reminderType: 'goal-judge',
        message: 'waiting (1/20)\nWaiting for explicit verification.',
      });
    });
  });

  it('waits for harness-level follow-ups to finish before draining the local queue', () => {
    const state = createQueueState({
      harness: { getFollowUpCount: vi.fn(() => 1) } as any,
      pendingQueuedActions: ['message'],
      pendingFollowUpMessages: [{ content: 'queued' }],
    });
    const ctx = createQueueContext(state);

    handleAgentEnd(ctx);

    expect(ctx.fireMessage).not.toHaveBeenCalled();
    expect(state.pendingQueuedActions).toEqual(['message']);
    expect(state.pendingFollowUpMessages).toEqual([{ content: 'queued' }]);
  });
});

describe('syncInitialThreadState', () => {
  it('loads persisted goal metadata for the initially selected thread', async () => {
    const persistedGoal = {
      id: 'goal-1',
      objective: 'finish pr triage',
      status: 'paused' as const,
      turnsUsed: 1,
      maxTurns: 50,
      judgeModelId: 'openai/gpt-5.5',
    };
    const state = {
      harness: {
        getCurrentThreadId: vi.fn(() => 'thread-1'),
        listThreads: vi.fn().mockResolvedValue([
          { id: 'thread-1', title: 'PR triage', metadata: { goal: persistedGoal } },
          { id: 'thread-2', title: 'Other thread', metadata: {} },
        ]),
      },
      goalManager: { loadFromThreadMetadata: vi.fn() },
      currentThreadTitle: undefined,
    } as unknown as TUIState;

    await syncInitialThreadState(state);

    expect(state.currentThreadTitle).toBe('PR triage');
    expect(state.goalManager.loadFromThreadMetadata).toHaveBeenCalledWith({ goal: persistedGoal });
  });
});

describe('consumePendingImages', () => {
  it('supports image-only submissions', () => {
    expect(consumePendingImages('[image] ', [{ data: 'img', mimeType: 'image/png' }])).toEqual({
      content: '',
      images: [{ data: 'img', mimeType: 'image/png' }],
    });
  });
});
