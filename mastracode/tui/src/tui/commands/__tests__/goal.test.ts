import { describe, expect, it, vi } from 'vitest';

const settingsMock = vi.hoisted(() => ({
  loadSettings: vi.fn(() => ({
    models: {
      goalJudgeModel: '__GATEWAY_OPENAI_MODEL__',
      goalMaxTurns: 50,
    },
  })),
  saveSettings: vi.fn(),
}));

const promptMocks = vi.hoisted(() => ({
  modelSelectHandler: undefined as ((model: { id: string }) => void) | undefined,
  cyclesSubmitHandler: undefined as ((value: number) => void) | undefined,
}));

const overlayMocks = vi.hoisted(() => ({
  showModalOverlay: vi.fn(),
}));

vi.mock('@mastra/code-sdk/onboarding/settings', () => settingsMock);

vi.mock('@earendil-works/pi-tui', () => ({
  Box: class {
    children: unknown[] = [];
    constructor() {}
    addChild(child: unknown) {
      this.children.push(child);
    }
  },
  Container: class {
    children: unknown[] = [];
    constructor() {}
    addChild(child: unknown) {
      this.children.push(child);
    }
    removeChildren() {
      this.children = [];
    }
    clear() {
      this.children = [];
    }
    invalidate() {}
  },
  SelectList: class {
    onSelect?: (item: { value: string; label: string }) => void;
    onCancel?: () => void;
    constructor(
      public items: Array<{ value: string; label: string }>,
      public visibleItems: number,
      public theme: unknown,
    ) {}
    handleInput() {}
  },
  Spacer: class {
    constructor(public size: number) {}
  },
  Text: class {
    constructor(
      public text: string,
      public x?: number,
      public y?: number,
    ) {}
  },
}));

vi.mock('../../overlay.js', () => ({
  showModalOverlay: overlayMocks.showModalOverlay,
}));

vi.mock('@mastra/core/agent', () => ({
  Agent: vi.fn(),
  SignalProvider: class {},
}));

vi.mock('@mastra/core/processors', () => ({
  isBadRequestError: (error: unknown) =>
    typeof error === 'object' &&
    error !== null &&
    'statusCode' in error &&
    (error as { statusCode?: unknown }).statusCode === 400,
  PrefillErrorHandler: class {},
  ProviderHistoryCompat: class {},
  StreamErrorRetryProcessor: class {},
}));

vi.mock('@mastra/code-sdk/agents/model', () => ({
  getModel: vi.fn(() => ({ modelId: 'mock-model' })),
}));

vi.mock('@mastra/core/workspace', () => ({
  createWorkspaceTools: vi.fn(),
  WORKSPACE_TOOLS: {
    FILESYSTEM: {
      READ_FILE: 'filesystem.read_file',
      WRITE_FILE: 'filesystem.write_file',
      EDIT_FILE: 'filesystem.edit_file',
      DELETE_FILE: 'filesystem.delete_file',
      LIST_FILES: 'filesystem.list_files',
      CREATE_DIRECTORY: 'filesystem.create_directory',
      GET_FILE_INFO: 'filesystem.get_file_info',
      SEARCH_FILES: 'filesystem.search_files',
      AST_EDIT: 'filesystem.ast_edit',
    },
    SANDBOX: {
      EXECUTE_COMMAND: 'sandbox.execute_command',
      GET_PROCESS_OUTPUT: 'sandbox.get_process_output',
      KILL_PROCESS: 'sandbox.kill_process',
    },
    LSP: { INSPECT: 'lsp.inspect' },
    SKILLS: {
      ACTIVATE: 'skills.activate',
      SEARCH: 'skills.search',
      READ: 'skills.read',
    },
  },
}));

vi.mock('../../components/model-selector.js', () => ({
  ModelSelectorComponent: class {
    constructor(options: { onSelect: (model: { id: string }) => void }) {
      promptMocks.modelSelectHandler = options.onSelect;
    }
  },
}));

vi.mock('../../components/goal-cycles-dialog.js', () => ({
  GoalCyclesDialogComponent: class {
    constructor(options: { onSubmit: (value: number) => void }) {
      promptMocks.cyclesSubmitHandler = options.onSubmit;
    }
  },
}));

vi.mock('../../prompt-api-key.js', () => ({
  promptForApiKeyIfNeeded: vi.fn().mockResolvedValue(undefined),
}));

import { createMockState } from '../../__tests__/agent-controller-mock.js';
import { getReminderView } from '../../db-message-parts.js';
import { DEFAULT_MAX_TURNS, GoalManager } from '../../goal-manager.js';
import { createGoalReminderMessage, handleGoalCommand, handleJudgeCommand, startGoalWithDefaults } from '../goal.js';

describe('createGoalReminderMessage', () => {
  it('creates a canonical goal system reminder as a DB-native signal message', () => {
    const message = createGoalReminderMessage(
      'goal-1',
      'Finish <the> task & verify it',
      DEFAULT_MAX_TURNS,
      '__GATEWAY_OPENAI_MODEL__',
    );

    expect(message.id).toBe('goal-goal-1');
    expect(message.role).toBe('signal');
    expect(message.content.format).toBe(2);

    const view = getReminderView(message);
    expect(view).toMatchObject({
      reminderType: 'goal',
      message: 'Finish <the> task & verify it',
      goalMaxTurns: DEFAULT_MAX_TURNS,
      judgeModelId: '__GATEWAY_OPENAI_MODEL__',
    });
  });
});

describe('handleGoalCommand', () => {
  it('opens an action modal for /goal with no arguments', async () => {
    overlayMocks.showModalOverlay.mockClear();
    const ctx = {
      state: {
        goalManager: { getGoal: vi.fn(() => null) },
        ui: { hideOverlay: vi.fn() },
      },
      showInfo: vi.fn(),
      updateStatusLine: vi.fn(),
    } as any;

    const result = handleGoalCommand(ctx, []);

    expect(overlayMocks.showModalOverlay).toHaveBeenCalledTimes(1);
    expect(ctx.showInfo).not.toHaveBeenCalledWith('No goal set. Use /goal <text> to set one.');
    const modal = overlayMocks.showModalOverlay.mock.calls[0]?.[1] as { handleInput?: (data: string) => void };
    expect(modal.handleInput).toEqual(expect.any(Function));
    void result;
  });

  it('resumes a paused goal via a goal-reminder signal without resetting the turn counter', async () => {
    const goal = {
      id: 'goal-1',
      objective: 'finish the task',
      status: 'paused' as string,
      turnsUsed: 3,
      maxTurns: DEFAULT_MAX_TURNS,
      judgeModelId: '__GATEWAY_OPENAI_MODEL__',
    };
    const goalManager = {
      getGoal: vi.fn(() => goal),
      resume: vi.fn(() => {
        goal.status = 'active';
        return goal;
      }),
      saveToThread: vi.fn().mockResolvedValue(undefined),
    };
    const sendSignal = vi.fn(() => ({ accepted: Promise.resolve({ accepted: true, runId: 'run-1' }) }));
    const showInfo = vi.fn();
    const ctx = {
      state: createMockState({ session: { sendSignal }, extra: { goalManager } }),
      showInfo,
      showError: vi.fn(),
      updateStatusLine: vi.fn(),
    } as any;

    await handleGoalCommand(ctx, ['resume']);

    expect(goalManager.resume).toHaveBeenCalledTimes(1);
    expect(goalManager.saveToThread).toHaveBeenCalledTimes(1);
    // No showInfo — only the signal renders the goal box (avoids duplicate).
    expect(showInfo).not.toHaveBeenCalled();
    expect(sendSignal).toHaveBeenCalledWith({
      type: 'system-reminder',
      contents: 'finish the task',
      attributes: { type: 'goal' },
      metadata: {
        goalId: 'goal-1',
        maxTurns: DEFAULT_MAX_TURNS,
        judgeModelId: '__GATEWAY_OPENAI_MODEL__',
      },
    });
  });

  it('reports already active when trying to resume an active (waiting-for-user) goal', async () => {
    const goal = {
      id: 'goal-2',
      objective: 'implement feature then wait for review',
      status: 'active' as string,
      turnsUsed: 5,
      maxTurns: DEFAULT_MAX_TURNS,
      judgeModelId: '__GATEWAY_OPENAI_MODEL__',
    };
    const goalManager = {
      getGoal: vi.fn(() => goal),
      resume: vi.fn(),
      saveToThread: vi.fn().mockResolvedValue(undefined),
    };
    const showInfo = vi.fn();
    const ctx = {
      state: createMockState({ extra: { goalManager } }),
      showInfo,
      showError: vi.fn(),
      updateStatusLine: vi.fn(),
    } as any;

    await handleGoalCommand(ctx, ['resume']);

    // The goal is active (waiting for user input is still active), so resume
    // should report "already active" and NOT call resume() or sendSignal.
    expect(goalManager.resume).not.toHaveBeenCalled();
    expect(showInfo).toHaveBeenCalledWith('Goal is already active.');
  });

  it('creates the pending new thread before saving a new goal', async () => {
    let currentThreadId = 'loaded-thread';
    const goal = {
      id: 'goal-1',
      objective: 'finish the task',
      status: 'active',
      turnsUsed: 0,
      maxTurns: 50,
      judgeModelId: '__GATEWAY_OPENAI_MODEL__',
    };
    const goalManager = {
      setGoal: vi.fn().mockResolvedValue(goal),
      persistOnNextThreadCreate: vi.fn(),
      saveToThread: vi.fn().mockResolvedValue(undefined),
    };
    const createThread = vi.fn(async () => {
      currentThreadId = 'new-thread';
      return { id: 'new-thread', resourceId: 'r', title: '', createdAt: new Date(), updatedAt: new Date() };
    });
    const sendSignal = vi.fn(() => ({ accepted: Promise.resolve({ accepted: true, runId: 'run-1' }) }));
    const ctx = {
      state: createMockState({
        session: { thread: { getId: vi.fn(() => currentThreadId), create: createThread }, sendSignal },
        extra: { pendingNewThread: true, goalManager },
      }),
      addUserMessage: vi.fn(),
      showError: vi.fn(),
      updateStatusLine: vi.fn(),
    } as any;

    await handleGoalCommand(ctx, ['finish', 'the', 'task']);

    expect(createThread).toHaveBeenCalledTimes(1);
    expect(ctx.state.pendingNewThread).toBe(false);
    expect(goalManager.saveToThread).toHaveBeenCalledTimes(1);
    expect(createThread.mock.invocationCallOrder[0]).toBeLessThan(goalManager.saveToThread.mock.invocationCallOrder[0]);
    expect(goalManager.persistOnNextThreadCreate).not.toHaveBeenCalled();
    expect(sendSignal).toHaveBeenCalledWith({
      type: 'system-reminder',
      contents: 'finish the task',
      attributes: { type: 'goal' },
      metadata: { goalId: 'goal-1', maxTurns: 50, judgeModelId: '__GATEWAY_OPENAI_MODEL__' },
    });
  });

  it('starts a goal from a plan-approval-style title+plan with only the goal reminder XML', async () => {
    // Regression: plan approval "Use as /goal" must enter the same goal
    // lifecycle as `/goal <text>` and send only the goal reminder. Sending an
    // extra "begin executing" reminder alongside it would render as a broken
    // combined system-reminder block on history reload (the legacy renderer
    // expects a single whole-message reminder).
    const objective = '# Ship it\n\n1. Build\n2. Test';
    const goal = {
      id: 'goal-1',
      objective,
      status: 'active' as const,
      turnsUsed: 0,
      maxTurns: 50,
      judgeModelId: '__GATEWAY_OPENAI_MODEL__',
    };
    const goalManager = {
      setGoal: vi.fn().mockResolvedValue(goal),
      persistOnNextThreadCreate: vi.fn(),
      saveToThread: vi.fn().mockResolvedValue(undefined),
      isActive: vi.fn(() => true),
    };
    const sendSignal = vi.fn(() => ({ accepted: Promise.resolve({ accepted: true, runId: 'run-1' }) }));
    const ctx = {
      state: createMockState({
        threadId: 'thread-1',
        session: { sendSignal },
        extra: { pendingNewThread: false, goalManager },
      }),
      addUserMessage: vi.fn(),
      showError: vi.fn(),
      updateStatusLine: vi.fn(),
    } as any;

    await startGoalWithDefaults(ctx, objective, 'Goal cancelled.');

    // Goal lifecycle is entered before the trigger message is sent so the
    // judge runs after the agent's first response.
    expect(goalManager.setGoal).toHaveBeenCalledWith(expect.anything(), objective, '__GATEWAY_OPENAI_MODEL__', 50);
    expect(goalManager.saveToThread).toHaveBeenCalledTimes(1);
    expect(goalManager.saveToThread.mock.invocationCallOrder[0]).toBeLessThan(sendSignal.mock.invocationCallOrder[0]);
    expect(goalManager.isActive()).toBe(true);

    expect(sendSignal).toHaveBeenCalledTimes(1);
    expect(sendSignal).toHaveBeenCalledWith({
      type: 'system-reminder',
      contents: '# Ship it\n\n1. Build\n2. Test',
      attributes: { type: 'goal' },
      metadata: { goalId: 'goal-1', maxTurns: 50, judgeModelId: '__GATEWAY_OPENAI_MODEL__' },
    });
  });

  it('enters goal mode (active + persisted) before sending the trigger so the in-loop goal step runs', async () => {
    // Regression for Tyler's review: "do we make sure we enter into goal mode
    // too? I noticed after approving a plan as goal, when the agent went idle
    // the judge would not kick in." Goal evaluation now happens in-loop in core
    // and surfaces via a `goal` stream chunk, so the only requirement on the
    // plan-approval path is that by the time the trigger signal is sent the goal
    // is active and has been persisted (saveToThread) — this proves we enter
    // goal mode before the agent produces its first candidate answer.
    const objective = '# Ship it\n\n1. Build\n2. Test';
    const goal = {
      id: 'goal-1',
      objective,
      status: 'active' as const,
      turnsUsed: 0,
      maxTurns: 50,
      judgeModelId: '__GATEWAY_OPENAI_MODEL__',
    };
    let active = false;

    const goalManager = {
      setGoal: vi.fn().mockImplementation(async () => {
        active = true;
        return goal;
      }),
      getGoal: vi.fn(() => (active ? goal : null)),
      isActive: vi.fn(() => active),
      persistOnNextThreadCreate: vi.fn(),
      saveToThread: vi.fn().mockResolvedValue(undefined),
    };

    let isActiveAtSave: boolean | undefined;
    let isActiveAtSendSignal: boolean | undefined;

    goalManager.saveToThread.mockImplementation(async () => {
      isActiveAtSave = goalManager.isActive();
    });
    const sendSignal = vi.fn(() => {
      isActiveAtSendSignal = goalManager.isActive();
      return { accepted: Promise.resolve({ accepted: true, runId: 'run-1' }) };
    });

    const ctx = {
      state: createMockState({
        threadId: 'thread-1',
        session: { sendSignal },
        extra: { pendingNewThread: false, goalManager },
      }),
      addUserMessage: vi.fn(),
      showError: vi.fn(),
      updateStatusLine: vi.fn(),
    } as any;

    await startGoalWithDefaults(ctx, objective, 'Goal cancelled.');

    // Goal becomes active, is persisted while active, and the trigger signal is
    // sent only after entering goal mode.
    expect(goalManager.isActive()).toBe(true);
    expect(goalManager.saveToThread).toHaveBeenCalledTimes(1);
    expect(isActiveAtSave).toBe(true);
    expect(isActiveAtSendSignal).toBe(true);
    expect(goalManager.saveToThread.mock.invocationCallOrder[0]).toBeLessThan(sendSignal.mock.invocationCallOrder[0]);
    expect(sendSignal).toHaveBeenCalledTimes(1);
  });

  it('can activate goal mode without sending a trigger so plan approval can inject through the TUI', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-15T10:00:00.000Z'));
    const goalManager = new GoalManager();
    const sendMessage = vi.fn().mockResolvedValue(undefined);

    const ctx = {
      state: createMockState({
        threadId: 'thread-1',
        session: { sendMessage },
        extra: { pendingNewThread: false, goalManager },
      }),
      addUserMessage: vi.fn(),
      showError: vi.fn(),
      updateStatusLine: vi.fn(),
    } as any;

    await startGoalWithDefaults(ctx, '# Ship it\n\n1. Build\n2. Test', 'Goal cancelled.', { trigger: 'none' });
    vi.setSystemTime(new Date('2026-05-15T15:00:00.000Z'));

    expect(goalManager.isActive()).toBe(true);
    expect(goalManager.getGoal()).toMatchObject({ activeDurationMs: 0, activeStartedAt: undefined });
    expect(sendMessage).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('updates the current goal when judge defaults change', async () => {
    settingsMock.loadSettings.mockReturnValue({
      models: {
        goalJudgeModel: null as unknown as string,
        goalMaxTurns: null as unknown as number,
      },
    });
    const goalManager = {
      updateJudgeDefaults: vi.fn().mockResolvedValue({
        id: 'goal-1',
        objective: 'finish the task',
        status: 'active',
        turnsUsed: 3,
        maxTurns: 25,
        judgeModelId: 'anthropic/claude-sonnet-4-5',
      }),
      saveToThread: vi.fn().mockResolvedValue(undefined),
    };
    const showInfo = vi.fn();
    const ctx = {
      state: createMockState({
        controller: { listAvailableModels: vi.fn().mockResolvedValue([{ id: 'anthropic/claude-sonnet-4-5' }]) },
        extra: { goalManager, ui: { hideOverlay: vi.fn(), showOverlay: vi.fn() } },
      }),
      authStorage: {},
      showInfo,
      showError: vi.fn(),
      updateStatusLine: vi.fn(),
    } as any;

    const promise = handleJudgeCommand(ctx);
    await Promise.resolve();
    promptMocks.modelSelectHandler?.({ id: 'anthropic/claude-sonnet-4-5' });
    await Promise.resolve();
    promptMocks.cyclesSubmitHandler?.(25);
    await promise;

    expect(goalManager.updateJudgeDefaults).toHaveBeenCalledWith(ctx.state, 'anthropic/claude-sonnet-4-5', 25);
    expect(showInfo).toHaveBeenCalledWith(
      'Judge defaults set: anthropic/claude-sonnet-4-5, 25 max attempts. Current goal updated.',
    );
  });

  it('routes /goal judge into the judge defaults flow', async () => {
    settingsMock.loadSettings.mockReturnValue({
      models: {
        goalJudgeModel: null as unknown as string,
        goalMaxTurns: null as unknown as number,
      },
    });
    const goalManager = {
      updateJudgeDefaults: vi.fn().mockResolvedValue(null),
      saveToThread: vi.fn().mockResolvedValue(undefined),
    };
    const showInfo = vi.fn();
    const ctx = {
      state: createMockState({
        controller: { listAvailableModels: vi.fn().mockResolvedValue([{ id: 'anthropic/claude-sonnet-4-5' }]) },
        extra: { goalManager, ui: { hideOverlay: vi.fn(), showOverlay: vi.fn() } },
      }),
      authStorage: {},
      showInfo,
      showError: vi.fn(),
      updateStatusLine: vi.fn(),
    } as any;

    const promise = handleGoalCommand(ctx, ['judge']);
    await Promise.resolve();
    promptMocks.modelSelectHandler?.({ id: 'anthropic/claude-sonnet-4-5' });
    await Promise.resolve();
    promptMocks.cyclesSubmitHandler?.(25);
    await promise;

    expect(goalManager.updateJudgeDefaults).toHaveBeenCalledWith(ctx.state, 'anthropic/claude-sonnet-4-5', 25);
  });

  it('does not resume a completed goal', async () => {
    const goalManager = {
      getGoal: vi.fn(() => ({
        id: 'goal-1',
        objective: 'finish the task',
        status: 'done',
        turnsUsed: 2,
        maxTurns: DEFAULT_MAX_TURNS,
        judgeModelId: '__GATEWAY_OPENAI_MODEL__',
      })),
      resume: vi.fn(),
      saveToThread: vi.fn(),
    };
    const sendSignal = vi.fn();
    const showInfo = vi.fn();
    const ctx = {
      state: createMockState({ session: { sendSignal }, extra: { goalManager } }),
      showInfo,
      updateStatusLine: vi.fn(),
    } as any;

    await handleGoalCommand(ctx, ['resume']);

    expect(showInfo).toHaveBeenCalledWith('Goal is already done. Use /goal <text> to set a new goal.');
    expect(goalManager.resume).not.toHaveBeenCalled();
    expect(goalManager.saveToThread).not.toHaveBeenCalled();
    expect(sendSignal).not.toHaveBeenCalled();
  });

  it('clears planStartedGoalId when /goal clear is called', async () => {
    const goalManager = {
      clear: vi.fn(),
      saveToThread: vi.fn(),
    };
    const abort = vi.fn();
    const state = createMockState({
      session: { abort, run: { isRunning: vi.fn(() => false) }, suspensions: { hasPending: vi.fn(() => false) } },
      extra: {
        goalManager,
        planStartedGoalId: 'plan-goal-123',
        pendingInlineQuestions: [],
        pendingAskUserComponents: new Map(),
      },
    }) as any;
    const showInfo = vi.fn();
    const ctx = {
      state,
      showInfo,
      updateStatusLine: vi.fn(),
    } as any;

    await handleGoalCommand(ctx, ['clear']);

    expect(goalManager.clear).toHaveBeenCalled();
    expect(goalManager.saveToThread).toHaveBeenCalledWith(state);
    expect(state.planStartedGoalId).toBeUndefined();
    expect(showInfo).toHaveBeenCalledWith('Goal cleared.');
    // Not running → must not abort.
    expect(abort).not.toHaveBeenCalled();
  });

  it('aborts the in-flight turn when /goal clear is called while running', async () => {
    const goalManager = {
      clear: vi.fn(),
      saveToThread: vi.fn(),
    };
    const abort = vi.fn();
    const state = createMockState({
      session: { abort, run: { isRunning: vi.fn(() => true) }, suspensions: { hasPending: vi.fn(() => false) } },
      extra: {
        goalManager,
        planStartedGoalId: undefined,
        activeInlineQuestion: {},
        pendingInlineQuestions: [() => {}],
        pendingAskUserComponents: new Map([['t', {}]]),
      },
    }) as any;
    const ctx = {
      state,
      showInfo: vi.fn(),
      updateStatusLine: vi.fn(),
    } as any;

    await handleGoalCommand(ctx, ['clear']);

    expect(goalManager.clear).toHaveBeenCalled();
    expect(abort).toHaveBeenCalledTimes(1);
    expect((state as any).userInitiatedAbort).toBe(true);
    expect(state.activeInlineQuestion).toBeUndefined();
    expect(state.pendingInlineQuestions).toHaveLength(0);
    expect((state.pendingAskUserComponents as Map<string, unknown>).size).toBe(0);
  });

  it('clears planStartedGoalId when starting a new manual goal', async () => {
    const goal = {
      id: 'manual-goal-456',
      objective: 'new manual objective',
      status: 'active' as const,
      turnsUsed: 0,
      maxTurns: 50,
      judgeModelId: '__GATEWAY_OPENAI_MODEL__',
      startedAt: new Date().toISOString(),
    };
    const goalManager = {
      getGoal: vi.fn(() => null),
      setGoal: vi.fn(() => goal),
      persistOnNextThreadCreate: vi.fn(),
      saveToThread: vi.fn().mockResolvedValue(undefined),
    };
    const sendSignal = vi.fn().mockResolvedValue({ accepted: Promise.resolve() });
    const state = createMockState({
      threadId: 'thread-1',
      session: { model: { get: vi.fn(() => '__GATEWAY_OPENAI_MODEL__') }, sendSignal },
      controller: { listAvailableModels: vi.fn().mockResolvedValue([{ id: '__GATEWAY_OPENAI_MODEL__' }]) },
      extra: { goalManager, planStartedGoalId: 'plan-goal-xyz' },
    }) as any;
    const showInfo = vi.fn();
    const showError = vi.fn();
    const ctx = {
      state,
      showInfo,
      showError,
      updateStatusLine: vi.fn(),
    } as any;

    await handleGoalCommand(ctx, ['new', 'manual', 'objective']);

    expect(goalManager.setGoal).toHaveBeenCalledWith(
      state,
      'new manual objective',
      expect.any(String),
      expect.any(Number),
    );
    expect(state.planStartedGoalId).toBeUndefined();
  });
});
