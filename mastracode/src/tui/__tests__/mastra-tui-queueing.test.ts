import { Container } from '@mariozechner/pi-tui';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  addUserMessage: vi.fn(),
  showInfo: vi.fn(),
  showError: vi.fn(),
}));

vi.mock('../render-messages.js', async importOriginal => {
  const actual = (await importOriginal()) as Record<string, unknown>;
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
import { handleAgentAborted, handleAgentEnd } from '../handlers/agent-lifecycle.js';
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
    messageComponentsById: new Map(),
    pendingSignalMessageComponentsById: new Map(),
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
    ui: { requestRender: vi.fn() } as unknown as TUIState['ui'],
    planStartedGoalId: undefined,
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
    startGoal: vi.fn(),
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

  it('sends editor submissions as signals instead of resolving input while the harness is running', async () => {
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
      signalMessage: (text: string) => void;
    };
    tui.state = state;
    tui.queueFollowUpMessage = vi.fn();
    tui.signalMessage = vi.fn();

    const pendingInput = tui.getUserInput();
    editor.onSubmit?.('queued follow-up');

    expect(editor.addToHistory).toHaveBeenCalledWith('queued follow-up');
    expect(editor.setText).toHaveBeenCalledWith('');
    expect(tui.signalMessage).toHaveBeenCalledWith('queued follow-up');
    expect(tui.queueFollowUpMessage).not.toHaveBeenCalled();

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

  it('keeps signal messages pending after sendSignal accepts until the stream echoes them', async () => {
    const sendSignal = vi
      .fn()
      .mockReturnValue({ id: 'signal-1', accepted: Promise.resolve({ accepted: true, runId: 'run-1' }) });
    const state = createQueueState({
      harness: {
        sendSignal,
        isCurrentThreadStreamActive: () => true,
        getCurrentRunId: () => null,
        getDisplayState: () => ({ isRunning: true }),
      } as unknown as TUIState['harness'],
      chatContainer: new Container(),
    });
    const tui = Object.create(MastraTUI.prototype) as {
      state: TUIState;
      signalMessage: (text: string) => void;
    };
    tui.state = state;

    tui.signalMessage('stay pending');
    await Promise.resolve();

    expect(sendSignal).toHaveBeenCalledWith({ content: 'stay pending' });
    expect(state.pendingSignalMessageComponentsById.has('signal-1')).toBe(true);
    expect(state.chatContainer.children).toHaveLength(1);
    expect(mocks.addUserMessage).not.toHaveBeenCalled();
  });

  it('creates a pending new thread before sending an optimistic signal', async () => {
    const createThread = vi.fn().mockResolvedValue({ id: 'thread-new' });
    const sendSignal = vi
      .fn()
      .mockReturnValue({ id: 'signal-after-new', accepted: Promise.resolve({ accepted: true, runId: 'run-1' }) });
    const state = createQueueState({
      pendingNewThread: true,
      harness: {
        createThread,
        sendSignal,
        isCurrentThreadStreamActive: () => false,
        getDisplayState: () => ({ isRunning: false }),
      } as unknown as TUIState['harness'],
      chatContainer: new Container(),
    });
    const tui = Object.create(MastraTUI.prototype) as {
      state: TUIState;
      sendOptimisticSignal: (text: string, images: undefined, optimisticMessageId: string) => void;
    };
    tui.state = state;
    state.messageComponentsById.set('user-optimistic', {} as never);

    tui.sendOptimisticSignal('starts new thread', undefined, 'user-optimistic');

    expect(createThread).toHaveBeenCalledTimes(1);
    expect(sendSignal).not.toHaveBeenCalled();

    await Promise.resolve();
    await Promise.resolve();

    expect(sendSignal).toHaveBeenCalledWith({ content: 'starts new thread' });
    expect(state.pendingNewThread).toBe(false);
  });

  it('remaps pre-hook optimistic messages to signal ids for echo dedupe', async () => {
    const sendSignal = vi
      .fn()
      .mockReturnValue({ id: 'signal-after-hook', accepted: Promise.resolve({ accepted: true, runId: 'run-1' }) });
    const state = createQueueState({
      harness: {
        sendSignal,
        isCurrentThreadStreamActive: () => false,
        getCurrentRunId: () => null,
        getDisplayState: () => ({ isRunning: false }),
      } as unknown as TUIState['harness'],
      chatContainer: new Container(),
    });
    const tui = Object.create(MastraTUI.prototype) as {
      state: TUIState;
      renderOptimisticUserMessage: (text: string) => string;
      sendOptimisticSignal: (text: string, images: undefined, optimisticMessageId: string) => void;
    };
    tui.state = state;

    const optimisticId = 'user-optimistic';
    const component = {};
    state.messageComponentsById.set(optimisticId, component as never);

    tui.sendOptimisticSignal('shows immediately', undefined, optimisticId);
    await Promise.resolve();

    expect(state.messageComponentsById.has(optimisticId)).toBe(false);
    expect(state.messageComponentsById.has('signal-after-hook')).toBe(true);
  });

  it('creates a pending new thread before sending an idle signal message', async () => {
    const createThread = vi.fn().mockResolvedValue({ id: 'thread-new' });
    const sendSignal = vi
      .fn()
      .mockReturnValue({ id: 'signal-after-new', accepted: Promise.resolve({ accepted: true, runId: 'run-1' }) });
    const state = createQueueState({
      pendingNewThread: true,
      harness: {
        createThread,
        sendSignal,
        isCurrentThreadStreamActive: () => false,
        getDisplayState: () => ({ isRunning: false }),
      } as unknown as TUIState['harness'],
      chatContainer: new Container(),
    });
    const tui = Object.create(MastraTUI.prototype) as {
      state: TUIState;
      signalMessage: (text: string) => void;
    };
    tui.state = state;

    tui.signalMessage('new thread follow-up');

    expect(createThread).toHaveBeenCalledTimes(1);
    expect(sendSignal).not.toHaveBeenCalled();

    await Promise.resolve();
    await Promise.resolve();

    expect(sendSignal).toHaveBeenCalledWith({ content: 'new thread follow-up' });
    expect(mocks.addUserMessage).toHaveBeenCalledWith(state, {
      id: 'signal-after-new',
      role: 'user',
      content: [{ type: 'text', text: 'new thread follow-up' }],
      createdAt: expect.any(Date),
    });
    expect(state.pendingNewThread).toBe(false);
  });

  it('renders idle signal messages directly instead of pending them', async () => {
    const sendSignal = vi
      .fn()
      .mockReturnValue({ id: 'signal-idle-1', accepted: Promise.resolve({ accepted: true, runId: 'run-1' }) });
    const state = createQueueState({
      harness: {
        sendSignal,
        isCurrentThreadStreamActive: () => false,
        getCurrentRunId: () => null,
        getDisplayState: () => ({ isRunning: false }),
      } as unknown as TUIState['harness'],
      chatContainer: new Container(),
    });
    const tui = Object.create(MastraTUI.prototype) as {
      state: TUIState;
      signalMessage: (text: string) => void;
    };
    tui.state = state;

    tui.signalMessage('render directly');
    await Promise.resolve();

    expect(sendSignal).toHaveBeenCalledWith({ content: 'render directly' });
    expect(state.pendingSignalMessageComponentsById.has('signal-idle-1')).toBe(false);
    expect(state.chatContainer.children).toHaveLength(0);
    expect(mocks.addUserMessage).toHaveBeenCalledWith(state, {
      id: 'signal-idle-1',
      role: 'user',
      content: [{ type: 'text', text: 'render directly' }],
      createdAt: expect.any(Date),
    });
  });

  it('renders idle image signals with the echoed signal id so they dedupe', async () => {
    const sendSignal = vi
      .fn()
      .mockReturnValue({ id: 'signal-image-1', accepted: Promise.resolve({ accepted: true, runId: 'run-1' }) });
    const state = createQueueState({
      harness: {
        sendSignal,
        isCurrentThreadStreamActive: () => false,
        getCurrentRunId: () => null,
        getDisplayState: () => ({ isRunning: false }),
      } as unknown as TUIState['harness'],
      chatContainer: new Container(),
    });
    const tui = Object.create(MastraTUI.prototype) as {
      state: TUIState;
      signalMessage: (text: string, images?: Array<{ data: string; mimeType: string }>) => void;
    };
    tui.state = state;

    tui.signalMessage("what's in this image?", [{ data: 'data:image/png;base64,abc', mimeType: 'image/png' }]);
    await Promise.resolve();

    expect(sendSignal).toHaveBeenCalledWith({
      content: [
        { type: 'text', text: "what's in this image?" },
        { type: 'file', data: 'data:image/png;base64,abc', mediaType: 'image/png' },
      ],
    });
    expect(mocks.addUserMessage).toHaveBeenCalledWith(state, {
      id: 'signal-image-1',
      role: 'user',
      content: [
        { type: 'text', text: "what's in this image?" },
        { type: 'image', data: 'data:image/png;base64,abc', mimeType: 'image/png' },
      ],
      createdAt: expect.any(Date),
    });
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

  it('sends goal continuation as a system-reminder signal', async () => {
    const sendSignal = vi.fn(() => ({ accepted: Promise.resolve({ accepted: true, runId: 'run-1' }) }));
    const state = createQueueState({
      harness: {
        getFollowUpCount: vi.fn(() => 0),
        sendSignal,
      } as any,
      gradientAnimator: { fadeOut: vi.fn(), start: vi.fn() } as any,
      goalManager: {
        isActive: vi.fn(() => true),
        getGoal: vi.fn(() => ({
          id: 'goal-1',
          status: 'active',
          judgeModelId: 'openai/gpt-5.5',
          turnsUsed: 2,
          maxTurns: 20,
        })),
        evaluateAfterTurn: vi.fn().mockResolvedValue({
          continuation: 'goal continuation',
          judgeResult: { decision: 'continue', reason: 'Keep going.' },
        }),
      } as any,
    });
    const ctx = createQueueContext(state);

    handleAgentEnd(ctx);

    await vi.waitFor(() => {
      expect(sendSignal).toHaveBeenCalledWith({
        type: 'system-reminder',
        contents: 'goal continuation',
        attributes: { type: 'goal-judge' },
        metadata: {
          goalId: 'goal-1',
          turnsUsed: 2,
          maxTurns: 20,
          judgeModelId: 'openai/gpt-5.5',
        },
      });
    });
    expect(ctx.fireMessage).not.toHaveBeenCalled();
  });

  it('shows an error when goal continuation signal delivery fails', async () => {
    const sendSignal = vi.fn(() => ({ accepted: Promise.reject(new Error('signal rejected')) }));
    const state = createQueueState({
      harness: {
        getFollowUpCount: vi.fn(() => 0),
        sendSignal,
      } as any,
      gradientAnimator: { fadeOut: vi.fn(), start: vi.fn() } as any,
      goalManager: {
        isActive: vi.fn(() => true),
        getGoal: vi.fn(() => ({
          id: 'goal-1',
          status: 'active',
          judgeModelId: 'openai/gpt-5.5',
          turnsUsed: 2,
          maxTurns: 20,
        })),
        evaluateAfterTurn: vi.fn().mockResolvedValue({
          continuation: 'goal continuation',
          judgeResult: { decision: 'continue', reason: 'Keep going.' },
        }),
      } as any,
    });
    const ctx = createQueueContext(state);

    handleAgentEnd(ctx);

    await vi.waitFor(() => {
      expect(ctx.showError).toHaveBeenCalledWith('Failed to send goal continuation: signal rejected');
    });
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

  it('switches to plan mode when a plan-started goal completes with decision=done', async () => {
    const switchMode = vi.fn().mockResolvedValue({ accepted: true });
    const saveSystemReminderMessage = vi.fn().mockResolvedValue(null);
    const state = createQueueState({
      planStartedGoalId: 'plan-goal-456',
      harness: {
        getFollowUpCount: vi.fn(() => 0),
        switchMode,
        saveSystemReminderMessage,
      } as any,
      gradientAnimator: { fadeOut: vi.fn(), start: vi.fn() } as any,
      goalManager: {
        isActive: vi.fn(() => true),
        getGoal: vi.fn(() => ({
          id: 'plan-goal-456',
          status: 'done',
          judgeModelId: 'openai/gpt-5.5',
          turnsUsed: 3,
          maxTurns: 20,
        })),
        evaluateAfterTurn: vi.fn().mockResolvedValue({
          continuation: null,
          judgeResult: { decision: 'done', reason: 'All objectives completed.' },
        }),
      } as any,
    });
    const ctx = createQueueContext(state);

    handleAgentEnd(ctx);

    await vi.waitFor(() => {
      expect(saveSystemReminderMessage).toHaveBeenCalledWith({
        reminderType: 'goal-judge',
        message: 'done (3/20)\nAll objectives completed.',
      });
    });
    await vi.waitFor(() => {
      expect(switchMode).toHaveBeenCalledWith({ modeId: 'plan' });
    });
    expect(mocks.showInfo).not.toHaveBeenCalled();
    expect(state.planStartedGoalId).toBeUndefined();
  });

  it('does not switch to plan mode for non-plan goals even when they complete', async () => {
    const switchMode = vi.fn().mockResolvedValue({ accepted: true });
    const saveSystemReminderMessage = vi.fn().mockResolvedValue(null);
    const state = createQueueState({
      planStartedGoalId: undefined,
      harness: {
        getFollowUpCount: vi.fn(() => 0),
        switchMode,
        saveSystemReminderMessage,
      } as any,
      gradientAnimator: { fadeOut: vi.fn(), start: vi.fn() } as any,
      goalManager: {
        isActive: vi.fn(() => true),
        getGoal: vi.fn(() => ({
          id: 'manual-goal-789',
          status: 'done',
          judgeModelId: 'openai/gpt-5.5',
          turnsUsed: 2,
          maxTurns: 20,
        })),
        evaluateAfterTurn: vi.fn().mockResolvedValue({
          continuation: null,
          judgeResult: { decision: 'done', reason: 'Manual goal finished.' },
        }),
      } as any,
    });
    const ctx = createQueueContext(state);

    handleAgentEnd(ctx);

    await vi.waitFor(() => {
      expect(saveSystemReminderMessage).toHaveBeenCalled();
    });
    expect(switchMode).not.toHaveBeenCalled();
    expect(mocks.showInfo).not.toHaveBeenCalled();
  });

  it('does not switch to plan mode when goal completes with decision=waiting', async () => {
    const switchMode = vi.fn().mockResolvedValue({ accepted: true });
    const saveSystemReminderMessage = vi.fn().mockResolvedValue(null);
    const state = createQueueState({
      planStartedGoalId: 'plan-goal-123',
      harness: {
        getFollowUpCount: vi.fn(() => 0),
        switchMode,
        saveSystemReminderMessage,
      } as any,
      gradientAnimator: { fadeOut: vi.fn(), start: vi.fn() } as any,
      goalManager: {
        isActive: vi.fn(() => true),
        getGoal: vi.fn(() => ({
          id: 'plan-goal-123',
          status: 'active',
          judgeModelId: 'openai/gpt-5.5',
          turnsUsed: 1,
          maxTurns: 20,
        })),
        evaluateAfterTurn: vi.fn().mockResolvedValue({
          continuation: null,
          judgeResult: { decision: 'waiting', reason: 'Needs user verification.' },
        }),
      } as any,
    });
    const ctx = createQueueContext(state);

    handleAgentEnd(ctx);

    await vi.waitFor(() => {
      expect(saveSystemReminderMessage).toHaveBeenCalled();
    });
    expect(switchMode).not.toHaveBeenCalled();
    expect(state.planStartedGoalId).toBe('plan-goal-123');
  });

  it('does not switch to plan mode when goal completes with decision=paused', async () => {
    const switchMode = vi.fn().mockResolvedValue({ accepted: true });
    const saveSystemReminderMessage = vi.fn().mockResolvedValue(null);
    const state = createQueueState({
      planStartedGoalId: 'plan-goal-321',
      harness: {
        getFollowUpCount: vi.fn(() => 0),
        switchMode,
        saveSystemReminderMessage,
      } as any,
      gradientAnimator: { fadeOut: vi.fn(), start: vi.fn() } as any,
      goalManager: {
        isActive: vi.fn(() => true),
        getGoal: vi.fn(() => ({
          id: 'plan-goal-321',
          status: 'paused',
          judgeModelId: 'openai/gpt-5.5',
          turnsUsed: 5,
          maxTurns: 20,
        })),
        evaluateAfterTurn: vi.fn().mockResolvedValue({
          continuation: null,
          judgeResult: { decision: 'paused', reason: 'Goal paused by system.' },
        }),
      } as any,
    });
    const ctx = createQueueContext(state);

    handleAgentEnd(ctx);

    await vi.waitFor(() => {
      expect(saveSystemReminderMessage).toHaveBeenCalled();
    });
    expect(switchMode).not.toHaveBeenCalled();
    expect(state.planStartedGoalId).toBe('plan-goal-321');
    expect(mocks.showInfo).toHaveBeenCalledWith(state, 'Goal paused (attempt 5/20). Use /goal resume to continue.');
  });

  it('does not switch to plan mode when completed goal ID does not match planStartedGoalId', async () => {
    const switchMode = vi.fn().mockResolvedValue({ accepted: true });
    const saveSystemReminderMessage = vi.fn().mockResolvedValue(null);
    const state = createQueueState({
      planStartedGoalId: 'plan-goal-xyz',
      harness: {
        getFollowUpCount: vi.fn(() => 0),
        switchMode,
        saveSystemReminderMessage,
      } as any,
      gradientAnimator: { fadeOut: vi.fn(), start: vi.fn() } as any,
      goalManager: {
        isActive: vi.fn(() => true),
        getGoal: vi.fn(() => ({
          id: 'different-goal-abc',
          status: 'done',
          judgeModelId: 'openai/gpt-5.5',
          turnsUsed: 1,
          maxTurns: 20,
        })),
        evaluateAfterTurn: vi.fn().mockResolvedValue({
          continuation: null,
          judgeResult: { decision: 'done', reason: 'Different goal done.' },
        }),
      } as any,
    });
    const ctx = createQueueContext(state);

    handleAgentEnd(ctx);

    await vi.waitFor(() => {
      expect(saveSystemReminderMessage).toHaveBeenCalled();
    });
    expect(switchMode).not.toHaveBeenCalled();
    expect(state.planStartedGoalId).toBe('plan-goal-xyz');
  });

  it('restores planStartedGoalId if mode switch fails', async () => {
    const switchMode = vi.fn().mockRejectedValue(new Error('Switch failed'));
    const saveSystemReminderMessage = vi.fn().mockResolvedValue(null);
    const state = createQueueState({
      planStartedGoalId: 'plan-goal-failed',
      harness: {
        getFollowUpCount: vi.fn(() => 0),
        switchMode,
        saveSystemReminderMessage,
      } as any,
      gradientAnimator: { fadeOut: vi.fn(), start: vi.fn() } as any,
      goalManager: {
        isActive: vi.fn(() => true),
        getGoal: vi.fn(() => ({
          id: 'plan-goal-failed',
          status: 'done',
          judgeModelId: 'openai/gpt-5.5',
          turnsUsed: 1,
          maxTurns: 20,
        })),
        evaluateAfterTurn: vi.fn().mockResolvedValue({
          continuation: null,
          judgeResult: { decision: 'done', reason: 'Goal done but switch failed.' },
        }),
      } as any,
    });
    const ctx = createQueueContext(state);

    handleAgentEnd(ctx);

    await vi.waitFor(() => {
      expect(saveSystemReminderMessage).toHaveBeenCalled();
    });
    await vi.waitFor(() => {
      expect(switchMode).toHaveBeenCalledWith({ modeId: 'plan' });
    });
    expect(ctx.showError).toHaveBeenCalledWith('Failed to switch to Plan mode: Switch failed');
    expect(state.planStartedGoalId).toBe('plan-goal-failed');
  });

  it('does not persist or switch mode when goal is replaced during evaluation', async () => {
    const switchMode = vi.fn().mockResolvedValue({ accepted: true });
    const saveSystemReminderMessage = vi.fn().mockResolvedValue(null);
    const originalGoalId = 'original-goal-123';
    let callCount = 0;
    const evaluateAfterTurn = vi.fn().mockResolvedValue({
      continuation: null,
      judgeResult: { decision: 'done', reason: 'Original goal done.' },
    });
    const state = createQueueState({
      planStartedGoalId: originalGoalId,
      harness: {
        getFollowUpCount: vi.fn(() => 0),
        switchMode,
        saveSystemReminderMessage,
      } as any,
      gradientAnimator: { fadeOut: vi.fn(), start: vi.fn() } as any,
      goalManager: {
        isActive: vi.fn(() => true),
        getGoal: vi.fn(() => {
          callCount++;
          if (callCount === 1) {
            return {
              id: originalGoalId,
              status: 'active',
              judgeModelId: 'openai/gpt-5.5',
              turnsUsed: 2,
              maxTurns: 20,
            };
          }
          return {
            id: 'new-goal-456',
            status: 'active',
            judgeModelId: 'openai/gpt-5.5',
            turnsUsed: 0,
            maxTurns: 20,
          };
        }),
        evaluateAfterTurn,
      } as any,
    });
    const ctx = createQueueContext(state);

    handleAgentEnd(ctx);

    await vi.waitFor(() => {
      expect(evaluateAfterTurn).toHaveBeenCalled();
      expect(callCount).toBeGreaterThanOrEqual(2);
    });
    expect(saveSystemReminderMessage).not.toHaveBeenCalled();
    expect(switchMode).not.toHaveBeenCalled();
    expect(state.chatContainer.children).toHaveLength(0);
    expect(state.planStartedGoalId).toBe(originalGoalId);
  });

  it('does not persist or switch mode when goal is cleared during evaluation', async () => {
    const switchMode = vi.fn().mockResolvedValue({ accepted: true });
    const saveSystemReminderMessage = vi.fn().mockResolvedValue(null);
    const originalGoalId = 'original-goal-123';
    let callCount = 0;
    const evaluateAfterTurn = vi.fn().mockResolvedValue({
      continuation: null,
      judgeResult: { decision: 'done', reason: 'Original goal done.' },
    });
    const state = createQueueState({
      planStartedGoalId: originalGoalId,
      harness: {
        getFollowUpCount: vi.fn(() => 0),
        switchMode,
        saveSystemReminderMessage,
      } as any,
      gradientAnimator: { fadeOut: vi.fn(), start: vi.fn() } as any,
      goalManager: {
        isActive: vi.fn(() => true),
        getGoal: vi.fn(() => {
          callCount++;
          if (callCount === 1) {
            return {
              id: originalGoalId,
              status: 'active',
              judgeModelId: 'openai/gpt-5.5',
              turnsUsed: 2,
              maxTurns: 20,
            };
          }
          return undefined;
        }),
        evaluateAfterTurn,
      } as any,
    });
    const ctx = createQueueContext(state);

    handleAgentEnd(ctx);

    await vi.waitFor(() => {
      expect(evaluateAfterTurn).toHaveBeenCalled();
      expect(callCount).toBeGreaterThanOrEqual(2);
    });
    expect(saveSystemReminderMessage).not.toHaveBeenCalled();
    expect(switchMode).not.toHaveBeenCalled();
    expect(state.chatContainer.children).toHaveLength(0);
    expect(state.planStartedGoalId).toBe(originalGoalId);
  });

  it('does not pause an active goal when a user-initiated abort ends the agent turn', () => {
    const goalManager = {
      isActive: vi.fn(() => true),
      pause: vi.fn(),
      saveToThread: vi.fn(),
      stopActiveTimer: vi.fn(),
    };
    const state = createQueueState({
      userInitiatedAbort: true,
      goalManager: goalManager as any,
    });
    const ctx = createQueueContext(state);

    handleAgentAborted(ctx);

    expect(goalManager.stopActiveTimer).toHaveBeenCalled();
    expect(goalManager.pause).not.toHaveBeenCalled();
    expect(goalManager.saveToThread).not.toHaveBeenCalled();
    expect(state.userInitiatedAbort).toBe(false);
    expect(mocks.showInfo).not.toHaveBeenCalledWith(state, 'Goal paused (interrupted). Use /goal resume to continue.');
  });

  it('cancels an in-flight goal judge when the user aborts before it resolves', async () => {
    const sendSignal = vi.fn(() => ({ accepted: Promise.resolve({ accepted: true, runId: 'run-1' }) }));
    let resolveEvaluation:
      | ((value: { continuation: string; judgeResult: { decision: 'continue'; reason: string } }) => void)
      | undefined;
    const state = createQueueState({
      harness: {
        getFollowUpCount: vi.fn(() => 0),
        sendSignal,
      } as any,
      gradientAnimator: { fadeOut: vi.fn(), start: vi.fn() } as any,
      goalManager: {
        isActive: vi.fn(() => true),
        stopActiveTimer: vi.fn(),
        getGoal: vi.fn(() => ({
          id: 'goal-1',
          status: 'active',
          judgeModelId: 'openai/gpt-5.5',
          turnsUsed: 2,
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
    handleAgentAborted(ctx);
    resolveEvaluation?.({
      continuation: 'goal continuation',
      judgeResult: { decision: 'continue', reason: 'Keep going.' },
    });

    await vi.waitFor(() => {
      expect(state.gradientAnimator?.fadeOut).toHaveBeenCalled();
    });
    expect(sendSignal).not.toHaveBeenCalled();
    expect(state.chatContainer.children).toHaveLength(0);
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
  it('reconnects active goal metadata for the initially selected thread without prompting the agent', async () => {
    const persistedGoal = {
      id: 'goal-1',
      objective: 'finish pr triage',
      status: 'active' as const,
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
        sendMessage: vi.fn(),
      },
      goalManager: { loadFromThreadMetadata: vi.fn() },
      currentThreadTitle: undefined,
    } as unknown as TUIState;

    await syncInitialThreadState(state);

    expect(state.currentThreadTitle).toBe('PR triage');
    expect(state.goalManager.loadFromThreadMetadata).toHaveBeenCalledWith({ goal: persistedGoal });
    expect(state.harness.sendMessage).not.toHaveBeenCalled();
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
