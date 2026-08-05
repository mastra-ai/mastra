import { Container } from '@earendil-works/pi-tui';
import type { GoalEvaluationPayload } from '@mastra/core/stream';
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

import { JudgeDisplayComponent } from '../components/judge-display.js';
import { GOAL_JUDGE_INPUT_LOCK_MESSAGE } from '../goal-input-lock.js';
import { handleAgentAborted, handleAgentEnd, handleGoalEvaluation } from '../handlers/agent-lifecycle.js';
import type { EventHandlerContext } from '../handlers/types.js';
import { MastraTUI, consumePendingImages, syncInitialThreadState } from '../mastra-tui.js';
import type { TUIState } from '../state.js';

const EXPECTED_USER_SIGNAL_DELIVERY_OPTIONS = {
  ifActive: { attributes: { delivery: 'while-active' } },
  ifIdle: { attributes: { delivery: 'message' } },
};

function createQueueState(overrides: Partial<TUIState> = {}): TUIState {
  // Mirror production wiring: state.session is the same object as
  // controller.session. Tests pass per-session behavior under `session`
  // (run-control, thread lifecycle, stream); only host-level behavior goes on
  // `controller`. We link them here so a single `session` override drives both.
  const { session: sessionOverride, controller: agentControllerOverride, ...rest } = overrides as any;
  const session = {
    followUps: { count: vi.fn(() => 0) },
    getCurrentRunId: vi.fn(() => null),
    stream: { isActive: vi.fn(() => false) },
    sendSignal: vi.fn(() => ({ id: 'signal-1', accepted: Promise.resolve({ accepted: true, runId: 'run-1' }) })),
    sendMessage: vi.fn().mockResolvedValue(undefined),
    displayState: { get: vi.fn(() => ({ isRunning: false })) },
    thread: { create: vi.fn().mockResolvedValue({ id: 'thread-new' }) },
    mode: { switch: vi.fn().mockResolvedValue(undefined) },
    ...(sessionOverride ?? {}),
  };
  return {
    session,
    controller: { session, ...(agentControllerOverride ?? {}) },
    goalManager: {},
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
    pendingSlashCommandMessageIds: [],
    pendingTools: new Map(),
    chatContainer: {
      children: [],
      addChild: vi.fn(function (this: any, child: unknown) {
        this.children.push(child);
      }),
      removeChild: vi.fn(function (this: any, child: unknown) {
        this.children = this.children.filter((candidate: unknown) => candidate !== child);
      }),
      invalidate: vi.fn(),
    },
    allToolComponents: [],
    allSlashCommandComponents: [],
    allSystemReminderComponents: [],
    allShellComponents: [],
    ui: { requestRender: vi.fn() } as unknown as TUIState['ui'],
    planStartedGoalId: undefined,
    ...rest,
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
    renderClearedTasksInline: vi.fn(),
    renderCompletedTasksInline: vi.fn(),
    renderTaskDeltaInline: vi.fn(),
    refreshModelAuthStatus: vi.fn(),
    ...overrides,
  };
}

function createGoalPayload(overrides: Partial<GoalEvaluationPayload> = {}): GoalEvaluationPayload {
  return {
    objective: 'finish the goal',
    iteration: 1,
    maxRuns: 20,
    passed: false,
    status: 'active',
    results: [],
    reason: 'Keep going.',
    duration: 0,
    timedOut: false,
    maxRunsReached: false,
    suppressFeedback: false,
    ...overrides,
  };
}

describe('MastraTUI queueing', () => {
  beforeEach(() => {
    mocks.addUserMessage.mockReset();
    mocks.showInfo.mockReset();
    mocks.showError.mockReset();
  });

  it('sends editor submissions as signals instead of resolving input while the controller is running', async () => {
    const editor = {
      onSubmit: undefined as ((text: string) => void) | undefined,
      addToHistory: vi.fn(),
      setText: vi.fn(),
    };
    const state = {
      editor,
      session: { run: { isRunning: vi.fn(() => true) } },
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

  it('runs slash commands immediately instead of queuing while the controller is running', async () => {
    const editor = {
      onSubmit: undefined as ((text: string) => void) | undefined,
      addToHistory: vi.fn(),
      setText: vi.fn(),
    };
    const state = {
      editor,
      session: { run: { isRunning: vi.fn(() => true) } },
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
      handleSlashCommand: (input: string) => Promise<boolean>;
    };
    tui.state = state;
    tui.queueFollowUpMessage = vi.fn();
    tui.signalMessage = vi.fn();
    tui.handleSlashCommand = vi.fn().mockResolvedValue(true);

    tui.getUserInput();
    editor.onSubmit?.('/help');

    expect(editor.addToHistory).toHaveBeenCalledWith('/help');
    expect(editor.setText).toHaveBeenCalledWith('');
    expect(tui.handleSlashCommand).toHaveBeenCalledWith('/help');
    expect(tui.queueFollowUpMessage).not.toHaveBeenCalled();
    expect(tui.signalMessage).not.toHaveBeenCalled();
  });

  it('blocks editor submissions while the goal judge is evaluating', async () => {
    const editor = {
      onSubmit: undefined as ((text: string) => void) | undefined,
      addToHistory: vi.fn(),
      setText: vi.fn(),
    };
    const state = {
      editor,
      activeGoalJudge: { modelId: '__GATEWAY_OPENAI_MODEL__' },
      session: { run: { isRunning: vi.fn(() => false) } },
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
      session: {
        getCurrentRunId: () => null,
        stream: { isActive: () => true },
        displayState: { get: () => ({ isRunning: true }) },
        sendSignal,
      } as any,
      chatContainer: new Container(),
    });
    const tui = Object.create(MastraTUI.prototype) as {
      state: TUIState;
      signalMessage: (text: string) => void;
    };
    tui.state = state;

    tui.signalMessage('stay pending');
    await Promise.resolve();

    expect(sendSignal).toHaveBeenCalledWith({
      content: 'stay pending',
      ...EXPECTED_USER_SIGNAL_DELIVERY_OPTIONS,
    });
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
      session: {
        stream: { isActive: () => false },
        displayState: { get: () => ({ isRunning: false }) },
        thread: { create: createThread },
        sendSignal,
      } as any,
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

    expect(sendSignal).toHaveBeenCalledWith({
      content: 'starts new thread',
      ...EXPECTED_USER_SIGNAL_DELIVERY_OPTIONS,
    });
    expect(state.pendingNewThread).toBe(false);
  });

  it('remaps pre-hook optimistic messages to signal ids for echo dedupe', async () => {
    const sendSignal = vi
      .fn()
      .mockReturnValue({ id: 'signal-after-hook', accepted: Promise.resolve({ accepted: true, runId: 'run-1' }) });
    const state = createQueueState({
      session: {
        getCurrentRunId: () => null,
        stream: { isActive: () => false },
        displayState: { get: () => ({ isRunning: false }) },
        sendSignal,
      } as any,
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
      session: {
        stream: { isActive: () => false },
        displayState: { get: () => ({ isRunning: false }) },
        thread: { create: createThread },
        sendSignal,
      } as any,
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

    expect(sendSignal).toHaveBeenCalledWith({
      content: 'new thread follow-up',
      ...EXPECTED_USER_SIGNAL_DELIVERY_OPTIONS,
    });
    expect(mocks.addUserMessage).toHaveBeenCalledWith(state, {
      id: 'signal-after-new',
      role: 'user',
      content: { format: 2, parts: [{ type: 'text', text: 'new thread follow-up' }] },
      createdAt: expect.any(Date),
    });
    expect(state.pendingNewThread).toBe(false);
  });

  it('renders idle signal messages directly instead of pending them', async () => {
    const sendSignal = vi
      .fn()
      .mockReturnValue({ id: 'signal-idle-1', accepted: Promise.resolve({ accepted: true, runId: 'run-1' }) });
    const state = createQueueState({
      session: {
        getCurrentRunId: () => null,
        stream: { isActive: () => false },
        displayState: { get: () => ({ isRunning: false }) },
        sendSignal,
      } as any,
      chatContainer: new Container(),
    });
    const tui = Object.create(MastraTUI.prototype) as {
      state: TUIState;
      signalMessage: (text: string) => void;
    };
    tui.state = state;

    tui.signalMessage('render directly');
    await Promise.resolve();

    expect(sendSignal).toHaveBeenCalledWith({
      content: 'render directly',
      ...EXPECTED_USER_SIGNAL_DELIVERY_OPTIONS,
    });
    expect(state.pendingSignalMessageComponentsById.has('signal-idle-1')).toBe(false);
    expect(state.chatContainer.children).toHaveLength(0);
    expect(mocks.addUserMessage).toHaveBeenCalledWith(state, {
      id: 'signal-idle-1',
      role: 'user',
      content: { format: 2, parts: [{ type: 'text', text: 'render directly' }] },
      createdAt: expect.any(Date),
    });
  });

  it('renders idle image signals with the echoed signal id so they dedupe', async () => {
    const sendSignal = vi
      .fn()
      .mockReturnValue({ id: 'signal-image-1', accepted: Promise.resolve({ accepted: true, runId: 'run-1' }) });
    const state = createQueueState({
      session: {
        getCurrentRunId: () => null,
        stream: { isActive: () => false },
        displayState: { get: () => ({ isRunning: false }) },
        sendSignal,
      } as any,
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
      ...EXPECTED_USER_SIGNAL_DELIVERY_OPTIONS,
    });
    expect(mocks.addUserMessage).toHaveBeenCalledWith(state, {
      id: 'signal-image-1',
      role: 'user',
      content: {
        format: 2,
        parts: [
          { type: 'text', text: "what's in this image?" },
          { type: 'file', data: 'data:image/png;base64,abc', mimeType: 'image/png' },
        ],
      },
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
      pendingSlashCommandMessageIds: [],
      pendingQueuedActions: [],
      pendingFollowUpMessages: [],
      pendingImages: [{ data: 'img-1', mimeType: 'image/png' }],
      pendingSignalMessageComponentsById: new Map(),
      ui: { requestRender: vi.fn() },
      chatContainer: {
        children: [],
        addChild: vi.fn(function (this: any, child: unknown) {
          this.children.push(child);
        }),
        removeChild: vi.fn(),
        invalidate: vi.fn(),
      },
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
    expect(tui.state.pendingSlashCommandMessageIds).toHaveLength(1);
    expect(tui.state.pendingSignalMessageComponentsById.size).toBe(1);
    expect(tui.state.chatContainer.children).toHaveLength(1);
    expect(tui.state.ui.requestRender).toHaveBeenCalledTimes(3);
  });

  it('removes the grey pending slash command when the queued command drains', () => {
    const state = createQueueState();
    const tui = Object.create(MastraTUI.prototype) as {
      state: TUIState;
      queueFollowUpMessage: (text: string) => void;
    };
    tui.state = state;

    tui.queueFollowUpMessage('/help');
    expect(state.pendingSignalMessageComponentsById.size).toBe(1);
    expect(state.chatContainer.children).toHaveLength(1);

    const ctx = createQueueContext(state);
    handleAgentEnd(ctx);

    expect(ctx.handleSlashCommand).toHaveBeenCalledWith('/help');
    expect(state.pendingSignalMessageComponentsById.size).toBe(0);
    expect(state.chatContainer.children).toHaveLength(0);
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
      content: { format: 2, parts: [{ type: 'text', text: 'first' }] },
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
      content: { format: 2, parts: [{ type: 'text', text: 'third' }] },
      createdAt: expect.any(Date),
    });
    expect(ctx.fireMessage).toHaveBeenLastCalledWith('third', undefined);

    expect(state.pendingQueuedActions).toEqual([]);
    expect(state.pendingFollowUpMessages).toEqual([]);
    expect(state.pendingSlashCommands).toEqual([]);
    expect(ctx.updateStatusLine).toHaveBeenCalledTimes(6);
  });

  it('adds goal activity to the active judge display while pending', () => {
    const state = createQueueState({
      goalManager: {
        applyEvaluation: vi.fn(),
        getGoal: vi.fn(() => ({
          id: 'goal-activity',
          status: 'active',
          judgeModelId: '__GATEWAY_OPENAI_MODEL__',
          turnsUsed: 1,
          maxTurns: 20,
        })),
      } as any,
    });
    const ctx = createQueueContext(state);

    handleGoalEvaluation(ctx, createGoalPayload({ pending: true }));
    handleGoalEvaluation(
      ctx,
      createGoalPayload({
        pending: true,
        activity: [{ type: 'tool-call', name: 'read', message: 'read' }],
      } as any),
    );

    expect((state.activeGoalJudge?.component as any).activity).toEqual(['read']);
    expect(state.goalManager.applyEvaluation).not.toHaveBeenCalled();
    expect(state.ui.requestRender).toHaveBeenCalled();
  });

  it('clears completed judge state and places the next iteration after continuation output', () => {
    const applyEvaluation = vi.fn();
    const state = createQueueState({
      goalManager: {
        applyEvaluation,
        getGoal: vi.fn(() => ({
          id: 'continuing-goal',
          status: 'active',
          judgeModelId: 'openai/gpt-5.4-mini',
          turnsUsed: 1,
          maxTurns: 20,
        })),
      } as any,
    });
    const ctx = createQueueContext(state);

    handleGoalEvaluation(ctx, createGoalPayload({ iteration: 1 }));
    expect(state.activeGoalJudge).toBeUndefined();

    const continuationOutput = { kind: 'assistant-output' };
    state.chatContainer.addChild(continuationOutput as any);
    handleGoalEvaluation(ctx, createGoalPayload({ iteration: 2 }));

    const judgeComponents = state.chatContainer.children.filter(child => child instanceof JudgeDisplayComponent);
    expect(judgeComponents).toHaveLength(2);
    expect(judgeComponents[1]).not.toBe(judgeComponents[0]);
    expect(state.chatContainer.children.indexOf(judgeComponents[1]!)).toBeGreaterThan(
      state.chatContainer.children.indexOf(continuationOutput as any),
    );
    expect(state.activeGoalJudge).toBeUndefined();
    expect(applyEvaluation).toHaveBeenNthCalledWith(1, { runsUsed: 1, status: 'active' });
    expect(applyEvaluation).toHaveBeenNthCalledWith(2, { runsUsed: 2, status: 'active' });
  });

  it('ignores late goal chunks after the user has aborted and paused the goal', () => {
    const applyEvaluation = vi.fn();
    const state = createQueueState({
      userInitiatedAbort: true,
      goalManager: {
        applyEvaluation,
        getGoal: vi.fn(() => ({
          id: 'paused-goal',
          status: 'paused',
          judgeModelId: '__GATEWAY_OPENAI_MODEL__',
          turnsUsed: 5,
          maxTurns: 500,
        })),
      } as any,
    });
    const ctx = createQueueContext(state);

    handleGoalEvaluation(ctx, createGoalPayload({ iteration: 5, status: 'active' }));

    expect(applyEvaluation).not.toHaveBeenCalled();
    expect(state.activeGoalJudge).toBeUndefined();
    expect(state.ui.requestRender).not.toHaveBeenCalled();
  });

  it('switches to plan mode when a plan-started goal completes with status=done', () => {
    const switchMode = vi.fn().mockResolvedValue({ accepted: true });
    const applyEvaluation = vi.fn();
    const state = createQueueState({
      planStartedGoalId: 'plan-goal-456',
      session: { mode: { switch: switchMode } } as any,
      goalManager: {
        applyEvaluation,
        getGoal: vi.fn(() => ({
          id: 'plan-goal-456',
          status: 'done',
          judgeModelId: '__GATEWAY_OPENAI_MODEL__',
          turnsUsed: 3,
          maxTurns: 20,
        })),
      } as any,
    });
    const ctx = createQueueContext(state);

    handleGoalEvaluation(ctx, createGoalPayload({ iteration: 3, status: 'done', passed: true }));

    expect(applyEvaluation).toHaveBeenCalledWith({ runsUsed: 3, status: 'done' });
    expect(switchMode).toHaveBeenCalledWith({ modeId: 'plan' });
    expect(state.planStartedGoalId).toBeUndefined();
    expect(state.activeGoalJudge).toBeUndefined();
  });

  it('does not switch to plan mode for non-plan goals even when they complete', () => {
    const switchMode = vi.fn().mockResolvedValue({ accepted: true });
    const state = createQueueState({
      planStartedGoalId: undefined,
      session: { mode: { switch: switchMode } } as any,
      goalManager: {
        applyEvaluation: vi.fn(),
        getGoal: vi.fn(() => ({
          id: 'manual-goal-789',
          status: 'done',
          judgeModelId: '__GATEWAY_OPENAI_MODEL__',
          turnsUsed: 2,
          maxTurns: 20,
        })),
      } as any,
    });
    const ctx = createQueueContext(state);

    handleGoalEvaluation(ctx, createGoalPayload({ iteration: 2, status: 'done', passed: true }));

    expect(switchMode).not.toHaveBeenCalled();
  });

  it('does not switch to plan mode when goal evaluation reports status=active (was decision=waiting)', () => {
    const switchMode = vi.fn().mockResolvedValue({ accepted: true });
    const state = createQueueState({
      planStartedGoalId: 'plan-goal-123',
      session: { mode: { switch: switchMode } } as any,
      goalManager: {
        applyEvaluation: vi.fn(),
        getGoal: vi.fn(() => ({
          id: 'plan-goal-123',
          status: 'active',
          judgeModelId: '__GATEWAY_OPENAI_MODEL__',
          turnsUsed: 1,
          maxTurns: 20,
        })),
      } as any,
    });
    const ctx = createQueueContext(state);

    handleGoalEvaluation(ctx, createGoalPayload({ iteration: 1, status: 'active' }));

    expect(switchMode).not.toHaveBeenCalled();
    expect(state.planStartedGoalId).toBe('plan-goal-123');
    expect(state.activeGoalJudge).toBeUndefined();
  });

  it('does not switch to plan mode when goal evaluation reports status=paused', () => {
    const switchMode = vi.fn().mockResolvedValue({ accepted: true });
    const state = createQueueState({
      planStartedGoalId: 'plan-goal-321',
      session: { mode: { switch: switchMode } } as any,
      goalManager: {
        applyEvaluation: vi.fn(),
        getGoal: vi.fn(() => ({
          id: 'plan-goal-321',
          status: 'paused',
          judgeModelId: '__GATEWAY_OPENAI_MODEL__',
          turnsUsed: 5,
          maxTurns: 20,
        })),
      } as any,
    });
    const ctx = createQueueContext(state);

    handleGoalEvaluation(ctx, createGoalPayload({ iteration: 5, status: 'paused' }));

    expect(switchMode).not.toHaveBeenCalled();
    expect(state.planStartedGoalId).toBe('plan-goal-321');
    expect(state.activeGoalJudge).toBeUndefined();
  });

  it('does not switch to plan mode when completed goal ID does not match planStartedGoalId', () => {
    const switchMode = vi.fn().mockResolvedValue({ accepted: true });
    const state = createQueueState({
      planStartedGoalId: 'plan-goal-xyz',
      session: { mode: { switch: switchMode } } as any,
      goalManager: {
        applyEvaluation: vi.fn(),
        getGoal: vi.fn(() => ({
          id: 'different-goal-abc',
          status: 'done',
          judgeModelId: '__GATEWAY_OPENAI_MODEL__',
          turnsUsed: 1,
          maxTurns: 20,
        })),
      } as any,
    });
    const ctx = createQueueContext(state);

    handleGoalEvaluation(ctx, createGoalPayload({ iteration: 1, status: 'done', passed: true }));

    expect(switchMode).not.toHaveBeenCalled();
    expect(state.planStartedGoalId).toBe('plan-goal-xyz');
  });

  it('restores planStartedGoalId if mode switch fails', async () => {
    const switchMode = vi.fn().mockRejectedValue(new Error('Switch failed'));
    const showError = vi.fn();
    const state = createQueueState({
      planStartedGoalId: 'plan-goal-failed',
      session: { mode: { switch: switchMode } } as any,
      goalManager: {
        applyEvaluation: vi.fn(),
        getGoal: vi.fn(() => ({
          id: 'plan-goal-failed',
          status: 'done',
          judgeModelId: '__GATEWAY_OPENAI_MODEL__',
          turnsUsed: 1,
          maxTurns: 20,
        })),
      } as any,
    });
    const ctx = createQueueContext(state, { showError });

    handleGoalEvaluation(ctx, createGoalPayload({ iteration: 1, status: 'done', passed: true }));

    await vi.waitFor(() => {
      expect(switchMode).toHaveBeenCalledWith({ modeId: 'plan' });
    });
    await vi.waitFor(() => {
      expect(showError).toHaveBeenCalledWith('Failed to switch to Plan mode: Switch failed');
    });
    expect(state.planStartedGoalId).toBe('plan-goal-failed');
  });

  it('does not switch mode when the goal was replaced before evaluation completed', () => {
    const switchMode = vi.fn().mockResolvedValue({ accepted: true });
    const originalGoalId = 'original-goal-123';
    const state = createQueueState({
      planStartedGoalId: originalGoalId,
      session: { mode: { switch: switchMode } } as any,
      goalManager: {
        applyEvaluation: vi.fn(),
        getGoal: vi.fn(() => ({
          id: 'new-goal-456',
          status: 'done',
          judgeModelId: '__GATEWAY_OPENAI_MODEL__',
          turnsUsed: 0,
          maxTurns: 20,
        })),
      } as any,
    });
    const ctx = createQueueContext(state);

    handleGoalEvaluation(ctx, createGoalPayload({ iteration: 0, status: 'done', passed: true }));

    expect(switchMode).not.toHaveBeenCalled();
    expect(state.planStartedGoalId).toBe(originalGoalId);
  });

  it('does not switch mode when the goal was cleared before evaluation completed', () => {
    const switchMode = vi.fn().mockResolvedValue({ accepted: true });
    const originalGoalId = 'original-goal-123';
    const state = createQueueState({
      planStartedGoalId: originalGoalId,
      session: { mode: { switch: switchMode } } as any,
      goalManager: {
        applyEvaluation: vi.fn(),
        getGoal: vi.fn(() => null),
      } as any,
    });
    const ctx = createQueueContext(state);

    handleGoalEvaluation(ctx, createGoalPayload({ iteration: 1, status: 'done', passed: true }));

    expect(switchMode).not.toHaveBeenCalled();
    expect(state.planStartedGoalId).toBe(originalGoalId);
  });

  it('does not pause an active goal when a user-initiated abort ends the agent turn', () => {
    const goalManager = {
      isActive: vi.fn(() => true),
      pause: vi.fn(),
      saveToThread: vi.fn(),
    };
    const state = createQueueState({
      userInitiatedAbort: true,
      goalManager: goalManager as any,
    });
    const ctx = createQueueContext(state);

    handleAgentAborted(ctx);

    expect(goalManager.pause).not.toHaveBeenCalled();
    expect(goalManager.saveToThread).not.toHaveBeenCalled();
    expect(state.userInitiatedAbort).toBe(false);
    expect(mocks.showInfo).not.toHaveBeenCalledWith(state, 'Goal paused (interrupted). Use /goal resume to continue.');
  });

  it('waits for controller-level follow-ups to finish before draining the local queue', () => {
    const state = createQueueState({
      session: { followUps: { count: vi.fn(() => 1) } } as any,
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
  it('falls back to legacy goal metadata only when the durable objective load returns nothing', async () => {
    const persistedGoal = {
      id: 'goal-1',
      objective: 'finish pr triage',
      status: 'active' as const,
      turnsUsed: 1,
      maxTurns: 50,
      judgeModelId: '__GATEWAY_OPENAI_MODEL__',
    };
    const state = {
      session: {
        thread: {
          getId: vi.fn(() => 'thread-1'),
          list: vi.fn().mockResolvedValue([
            { id: 'thread-1', title: 'PR triage', metadata: { goal: persistedGoal } },
            { id: 'thread-2', title: 'Other thread', metadata: {} },
          ]),
        },
        sendMessage: vi.fn(),
      },
      goalManager: {
        // Durable ThreadState load produced no objective, so the legacy
        // metadata fallback should run.
        loadFromThread: vi.fn().mockResolvedValue(undefined),
        getGoal: vi.fn(() => null),
        loadFromThreadMetadata: vi.fn(),
      },
      currentThreadTitle: undefined,
    } as unknown as TUIState;

    await syncInitialThreadState(state);

    expect(state.currentThreadTitle).toBe('PR triage');
    expect(state.goalManager.loadFromThread).toHaveBeenCalledWith(state);
    expect(state.goalManager.loadFromThreadMetadata).toHaveBeenCalledWith({ goal: persistedGoal });
    expect(state.session.sendMessage).not.toHaveBeenCalled();
  });

  it('does not re-hydrate from legacy metadata when the durable objective load succeeds', async () => {
    const persistedGoal = {
      id: 'goal-1',
      objective: 'stale legacy goal',
      status: 'active' as const,
      turnsUsed: 1,
      maxTurns: 50,
      judgeModelId: '__GATEWAY_OPENAI_MODEL__',
    };
    const durableGoal = {
      id: 'goal-2',
      objective: 'fresh durable goal',
      status: 'active' as const,
      turnsUsed: 0,
      maxTurns: 50,
    };
    const state = {
      session: {
        thread: {
          getId: vi.fn(() => 'thread-1'),
          list: vi.fn().mockResolvedValue([{ id: 'thread-1', title: 'PR triage', metadata: { goal: persistedGoal } }]),
        },
      },
      goalManager: {
        // Durable ThreadState load produced an objective, so the stale legacy
        // metadata blob must NOT clobber it.
        loadFromThread: vi.fn().mockResolvedValue(undefined),
        getGoal: vi.fn(() => durableGoal),
        loadFromThreadMetadata: vi.fn(),
      },
      currentThreadTitle: undefined,
    } as unknown as TUIState;

    await syncInitialThreadState(state);

    expect(state.goalManager.loadFromThread).toHaveBeenCalledWith(state);
    expect(state.goalManager.loadFromThreadMetadata).not.toHaveBeenCalled();
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
