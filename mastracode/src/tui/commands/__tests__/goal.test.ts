import { describe, expect, it, vi } from 'vitest';

const settingsMock = vi.hoisted(() => ({
  loadSettings: vi.fn(() => ({
    models: {
      goalJudgeModel: 'openai/gpt-5.5',
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

vi.mock('../../../onboarding/settings.js', () => settingsMock);

vi.mock('@mariozechner/pi-tui', () => ({
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
}));

vi.mock('@mastra/core/processors', () => ({
  PrefillErrorHandler: class {},
  ProviderHistoryCompat: class {},
  StreamErrorRetryProcessor: class {},
}));

vi.mock('../../../agents/model.js', () => ({
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

import { DEFAULT_MAX_TURNS, GoalManager } from '../../goal-manager.js';
import { createGoalReminderMessage, handleGoalCommand, handleJudgeCommand, startGoalWithDefaults } from '../goal.js';

describe('createGoalReminderMessage', () => {
  it('creates a canonical goal system reminder for chat history', () => {
    const message = createGoalReminderMessage(
      'goal-1',
      'Finish <the> task & verify it',
      DEFAULT_MAX_TURNS,
      'openai/gpt-5.5',
    );

    expect(message).toMatchObject({
      id: 'goal-goal-1',
      role: 'user',
      content: [
        {
          type: 'system_reminder',
          reminderType: 'goal',
          message: 'Finish <the> task & verify it',
          goalMaxTurns: DEFAULT_MAX_TURNS,
          judgeModelId: 'openai/gpt-5.5',
        },
      ],
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
    } as any;

    const result = handleGoalCommand(ctx, []);

    expect(overlayMocks.showModalOverlay).toHaveBeenCalledTimes(1);
    expect(ctx.showInfo).not.toHaveBeenCalledWith('No goal set. Use /goal <text> to set one.');
    const modal = overlayMocks.showModalOverlay.mock.calls[0]?.[1] as { handleInput?: (data: string) => void };
    expect(modal.handleInput).toEqual(expect.any(Function));
    void result;
  });

  it('resumes a paused goal without resetting the turn counter', async () => {
    const goal = {
      id: 'goal-1',
      objective: 'finish the task',
      status: 'paused',
      turnsUsed: 3,
      maxTurns: DEFAULT_MAX_TURNS,
      judgeModelId: 'openai/gpt-5.5',
    };
    const goalManager = {
      getGoal: vi.fn(() => goal),
      resume: vi.fn(() => {
        goal.status = 'active';
        return goal;
      }),
      saveToThread: vi.fn(),
    };
    const sendMessage = vi.fn();
    const showInfo = vi.fn();
    const ctx = {
      state: {
        goalManager,
        harness: { sendMessage },
      },
      showInfo,
      showError: vi.fn(),
    } as any;

    await handleGoalCommand(ctx, ['resume']);

    expect(goalManager.resume).toHaveBeenCalledTimes(1);
    expect(goalManager.saveToThread).toHaveBeenCalledTimes(1);
    expect(showInfo).toHaveBeenCalledWith(
      `Goal resumed: "finish the task" — 3/${DEFAULT_MAX_TURNS} turns used. Sending continuation...`,
    );
    expect(sendMessage).toHaveBeenCalledWith({ content: 'Continue working toward the goal: finish the task' });
  });

  it('retriggers judge evaluation instead of main agent when resume follows a judge failure', async () => {
    const goal = {
      id: 'goal-1',
      objective: 'finish the task',
      status: 'paused',
      turnsUsed: 3,
      maxTurns: DEFAULT_MAX_TURNS,
      judgeModelId: 'openai/gpt-5.5',
      lastPauseWasJudgeFailure: true,
    };
    const goalManager = new GoalManager();
    // Inject the goal state directly
    (goalManager as any).goal = goal;
    const evaluateAfterTurn = vi.spyOn(goalManager, 'evaluateAfterTurn').mockResolvedValue({
      continuation: null,
      judgeResult: { decision: 'paused', reason: 'Judge returned no structured decision.' },
    });
    const sendMessage = vi.fn();
    const showInfo = vi.fn();
    const ctx = {
      state: {
        goalManager,
        harness: { sendMessage },
        chatContainer: { addChild: vi.fn(), children: [] },
        gradientAnimator: { start: vi.fn(), fadeOut: vi.fn() },
        activeGoalJudge: undefined,
        ui: { requestRender: vi.fn() },
      },
      showInfo,
      showError: vi.fn(),
      updateStatusLine: vi.fn(),
    } as any;

    await handleGoalCommand(ctx, ['resume']);

    // Should NOT send a main-agent continuation
    expect(sendMessage).not.toHaveBeenCalled();
    // Should show the judge retrigger message
    expect(showInfo).toHaveBeenCalledWith(expect.stringContaining('retriggering judge evaluation'));
    // evaluateAfterTurn should have been called (via triggerGoalJudge)
    expect(evaluateAfterTurn).toHaveBeenCalled();
  });

  it('does not send a goal continuation when judge-failure resume has no assistant response to evaluate', async () => {
    const goal = {
      id: 'goal-1',
      objective: 'finish the task',
      status: 'paused',
      turnsUsed: 3,
      maxTurns: DEFAULT_MAX_TURNS,
      judgeModelId: 'openai/gpt-5.5',
      lastPauseWasJudgeFailure: true,
    };
    const goalManager = new GoalManager();
    (goalManager as any).goal = goal;
    const sendSignal = vi.fn();
    const saveSystemReminderMessage = vi.fn().mockResolvedValue(null);
    const ctx = {
      state: {
        goalManager,
        harness: {
          sendSignal,
          saveSystemReminderMessage,
          listMessages: vi.fn().mockResolvedValue([{ role: 'user', content: [{ type: 'text', text: 'resume goal' }] }]),
          setThreadSetting: vi.fn(),
          getCurrentThreadId: vi.fn(() => 'thread-1'),
          getResourceId: vi.fn(() => 'resource-1'),
        },
        chatContainer: { addChild: vi.fn(), children: [] },
        gradientAnimator: { start: vi.fn(), fadeOut: vi.fn() },
        activeGoalJudge: undefined,
        ui: { requestRender: vi.fn() },
      },
      showInfo: vi.fn(),
      showError: vi.fn(),
      updateStatusLine: vi.fn(),
    } as any;

    await handleGoalCommand(ctx, ['resume']);

    await vi.waitFor(() => {
      expect(saveSystemReminderMessage).toHaveBeenCalledWith({
        reminderType: 'goal-judge',
        message: 'paused (3/50)\nJudge could not evaluate this turn: no assistant response.',
      });
    });
    expect(sendSignal).not.toHaveBeenCalled();
    expect(goalManager.getGoal()).toMatchObject({ status: 'paused', lastPauseWasJudgeFailure: true });
  });

  it('pauses and saves the goal when judge continuation signal fails', async () => {
    const goal = {
      id: 'goal-1',
      objective: 'finish the task',
      status: 'paused',
      turnsUsed: 3,
      maxTurns: DEFAULT_MAX_TURNS,
      judgeModelId: 'openai/gpt-5.5',
      lastPauseWasJudgeFailure: true,
    };
    const goalManager = new GoalManager();
    (goalManager as any).goal = goal;
    vi.spyOn(goalManager, 'evaluateAfterTurn').mockResolvedValue({
      continuation: 'Continue working toward the goal: finish the task',
      judgeResult: { decision: 'continue', reason: 'Keep going.' },
    });
    const saveToThread = vi.spyOn(goalManager, 'saveToThread').mockResolvedValue(undefined);
    const sendSignal = vi.fn(() => ({ accepted: Promise.reject(new Error('signal failed')) }));
    const showError = vi.fn();
    const ctx = {
      state: {
        goalManager,
        harness: { sendSignal },
        chatContainer: { addChild: vi.fn(), children: [] },
        gradientAnimator: { start: vi.fn(), fadeOut: vi.fn() },
        activeGoalJudge: undefined,
        ui: { requestRender: vi.fn() },
      },
      showInfo: vi.fn(),
      showError,
      updateStatusLine: vi.fn(),
    } as any;

    await handleGoalCommand(ctx, ['resume']);

    await vi.waitFor(() => {
      expect(showError).toHaveBeenCalledWith('Failed to send goal continuation: signal failed');
    });
    expect(goalManager.getGoal()).toMatchObject({ status: 'paused' });
    expect(saveToThread).toHaveBeenCalledTimes(2);
  });

  it('continues goal judge completion handling when judge-result persistence fails', async () => {
    const goal = {
      id: 'goal-1',
      objective: 'finish the task',
      status: 'paused',
      turnsUsed: 3,
      maxTurns: DEFAULT_MAX_TURNS,
      judgeModelId: 'openai/gpt-5.5',
      lastPauseWasJudgeFailure: true,
    };
    const goalManager = new GoalManager();
    (goalManager as any).goal = goal;
    vi.spyOn(goalManager, 'evaluateAfterTurn').mockImplementation(async () => {
      const currentGoal = goalManager.getGoal();
      if (currentGoal) currentGoal.status = 'done';
      return { continuation: null, judgeResult: { decision: 'done', reason: 'Complete.' } };
    });
    const switchMode = vi.fn().mockResolvedValue(undefined);
    const showError = vi.fn();
    const ctx = {
      state: {
        goalManager,
        planStartedGoalId: 'goal-1',
        harness: {
          saveSystemReminderMessage: vi.fn().mockRejectedValue(new Error('persist failed')),
          switchMode,
        },
        chatContainer: { addChild: vi.fn(), children: [] },
        gradientAnimator: { start: vi.fn(), fadeOut: vi.fn() },
        activeGoalJudge: undefined,
        ui: { requestRender: vi.fn() },
      },
      showInfo: vi.fn(),
      showError,
      updateStatusLine: vi.fn(),
    } as any;

    await handleGoalCommand(ctx, ['resume']);

    await vi.waitFor(() => {
      expect(showError).toHaveBeenCalledWith('Failed to persist goal judge result: persist failed');
      expect(switchMode).toHaveBeenCalledWith({ modeId: 'plan' });
    });
    expect(ctx.state.planStartedGoalId).toBeUndefined();
  });

  it('creates the pending new thread before saving a new goal', async () => {
    let currentThreadId = 'loaded-thread';
    const goal = {
      id: 'goal-1',
      objective: 'finish the task',
      status: 'active',
      turnsUsed: 0,
      maxTurns: 50,
      judgeModelId: 'openai/gpt-5.5',
    };
    const goalManager = {
      setGoal: vi.fn(() => goal),
      persistOnNextThreadCreate: vi.fn(),
      saveToThread: vi.fn(),
    };
    const createThread = vi.fn(async () => {
      currentThreadId = 'new-thread';
    });
    const sendSignal = vi.fn(() => ({ accepted: Promise.resolve({ accepted: true, runId: 'run-1' }) }));
    const ctx = {
      state: {
        pendingNewThread: true,
        goalManager,
        harness: {
          createThread,
          getCurrentThreadId: vi.fn(() => currentThreadId),
          sendSignal,
        },
      },
      addUserMessage: vi.fn(),
      showError: vi.fn(),
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
      metadata: { goalId: 'goal-1', maxTurns: 50, judgeModelId: 'openai/gpt-5.5' },
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
      judgeModelId: 'openai/gpt-5.5',
    };
    const goalManager = {
      setGoal: vi.fn(() => goal),
      persistOnNextThreadCreate: vi.fn(),
      saveToThread: vi.fn(),
      isActive: vi.fn(() => true),
    };
    const sendSignal = vi.fn(() => ({ accepted: Promise.resolve({ accepted: true, runId: 'run-1' }) }));
    const ctx = {
      state: {
        pendingNewThread: false,
        goalManager,
        harness: {
          getCurrentThreadId: vi.fn(() => 'thread-1'),
          sendSignal,
        },
      },
      addUserMessage: vi.fn(),
      showError: vi.fn(),
    } as any;

    await startGoalWithDefaults(ctx, objective, 'Goal cancelled.');

    // Goal lifecycle is entered before the trigger message is sent so the
    // judge runs after the agent's first response.
    expect(goalManager.setGoal).toHaveBeenCalledWith(objective, 'openai/gpt-5.5', 50);
    expect(goalManager.saveToThread).toHaveBeenCalledTimes(1);
    expect(goalManager.saveToThread.mock.invocationCallOrder[0]).toBeLessThan(sendSignal.mock.invocationCallOrder[0]);
    expect(goalManager.isActive()).toBe(true);

    expect(sendSignal).toHaveBeenCalledTimes(1);
    expect(sendSignal).toHaveBeenCalledWith({
      type: 'system-reminder',
      contents: '# Ship it\n\n1. Build\n2. Test',
      attributes: { type: 'goal' },
      metadata: { goalId: 'goal-1', maxTurns: 50, judgeModelId: 'openai/gpt-5.5' },
    });
  });

  it('enters real goal mode (active + persisted) before sending the trigger so the judge runs on agent_end', async () => {
    // Regression for Tyler's review: "do we make sure we enter into goal mode
    // too? I noticed after approving a plan as goal, when the agent went idle
    // the judge would not kick in." This test uses the real GoalManager (not
    // a mock) and proves that by the time the trigger message is sent —
    // which is the only point at which the suspended submit_plan turn can
    // produce an agent_end after resuming — (1) goalManager.isActive() is
    // true, and (2) the goal has already been persisted to thread metadata
    // with status='active'. handleAgentEnd's maybeGoalContinuation only
    // checks isActive(), so this guarantees the judge runs after the agent's
    // first response on the plan-approval path.
    const goalManager = new GoalManager();
    const objective = '# Ship it\n\n1. Build\n2. Test';

    let isActiveAtSetThreadSetting: boolean | undefined;
    let persistedGoalAtSetThreadSetting: unknown;
    let isActiveAtSendMessage: boolean | undefined;

    const setThreadSetting = vi.fn(async ({ value }: { key: string; value: unknown }) => {
      isActiveAtSetThreadSetting = goalManager.isActive();
      persistedGoalAtSetThreadSetting = value;
    });
    const sendSignal = vi.fn(() => {
      isActiveAtSendMessage = goalManager.isActive();
      return { accepted: Promise.resolve({ accepted: true, runId: 'run-1' }) };
    });

    const ctx = {
      state: {
        pendingNewThread: false,
        goalManager,
        harness: {
          getCurrentThreadId: vi.fn(() => 'thread-1'),
          setThreadSetting,
          sendSignal,
        },
      },
      addUserMessage: vi.fn(),
      showError: vi.fn(),
    } as any;

    await startGoalWithDefaults(ctx, objective, 'Goal cancelled.');

    // Goal is active in memory AND was active when persisted, AND was active
    // when the trigger was sent. handleAgentEnd's maybeGoalContinuation
    // checks isActive() and only that — so this proves the judge will fire on
    // the next agent_end (incl. the suspended submit_plan turn that resumes
    // when the plan-approval response is delivered, since setGoal is sync).
    expect(goalManager.isActive()).toBe(true);
    expect(isActiveAtSetThreadSetting).toBe(true);
    expect(isActiveAtSendMessage).toBe(true);

    // Persisted thread metadata captures status='active' so reloads stay in
    // goal mode.
    expect(persistedGoalAtSetThreadSetting).toMatchObject({
      objective,
      status: 'active',
      judgeModelId: 'openai/gpt-5.5',
      maxTurns: 50,
      turnsUsed: 0,
    });

    // The persisted goal id is stable and matches the live goal — proves we
    // didn't accidentally save a different/stale goal record.
    const liveGoal = goalManager.getGoal();
    expect(liveGoal).not.toBeNull();
    expect((persistedGoalAtSetThreadSetting as { id: string }).id).toBe(liveGoal!.id);
  });

  it('can activate goal mode without sending a trigger so plan approval can inject through the TUI', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-15T10:00:00.000Z'));
    const goalManager = new GoalManager();
    const sendMessage = vi.fn().mockResolvedValue(undefined);

    const ctx = {
      state: {
        pendingNewThread: false,
        goalManager,
        harness: {
          getCurrentThreadId: vi.fn(() => 'thread-1'),
          setThreadSetting: vi.fn().mockResolvedValue(undefined),
          sendMessage,
        },
      },
      addUserMessage: vi.fn(),
      showError: vi.fn(),
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
      updateJudgeDefaults: vi.fn(() => ({
        id: 'goal-1',
        objective: 'finish the task',
        status: 'active',
        turnsUsed: 3,
        maxTurns: 25,
        judgeModelId: 'anthropic/claude-sonnet-4-5',
      })),
      saveToThread: vi.fn(),
    };
    const showInfo = vi.fn();
    const ctx = {
      state: {
        goalManager,
        harness: {
          listAvailableModels: vi.fn().mockResolvedValue([{ id: 'anthropic/claude-sonnet-4-5' }]),
          getCurrentModelId: vi.fn(() => 'anthropic/claude-sonnet-4-5'),
        },
        ui: { hideOverlay: vi.fn(), showOverlay: vi.fn() },
      },
      authStorage: {},
      showInfo,
      showError: vi.fn(),
    } as any;

    const promise = handleJudgeCommand(ctx);
    await Promise.resolve();
    promptMocks.modelSelectHandler?.({ id: 'anthropic/claude-sonnet-4-5' });
    await Promise.resolve();
    promptMocks.cyclesSubmitHandler?.(25);
    await promise;

    expect(goalManager.updateJudgeDefaults).toHaveBeenCalledWith('anthropic/claude-sonnet-4-5', 25);
    expect(goalManager.saveToThread).toHaveBeenCalledWith(ctx.state);
    expect(showInfo).toHaveBeenCalledWith(
      'Judge defaults set: anthropic/claude-sonnet-4-5, 25 max attempts. Current goal updated.',
    );
  });

  it('does not resume a completed goal', async () => {
    const goalManager = {
      getGoal: vi.fn(() => ({
        id: 'goal-1',
        objective: 'finish the task',
        status: 'done',
        turnsUsed: 2,
        maxTurns: DEFAULT_MAX_TURNS,
        judgeModelId: 'openai/gpt-5.5',
      })),
      resume: vi.fn(),
      saveToThread: vi.fn(),
    };
    const sendMessage = vi.fn();
    const showInfo = vi.fn();
    const ctx = {
      state: {
        goalManager,
        harness: { sendMessage },
      },
      showInfo,
    } as any;

    await handleGoalCommand(ctx, ['resume']);

    expect(showInfo).toHaveBeenCalledWith('Goal is already done. Use /goal <text> to set a new goal.');
    expect(goalManager.resume).not.toHaveBeenCalled();
    expect(goalManager.saveToThread).not.toHaveBeenCalled();
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('clears planStartedGoalId when /goal clear is called', async () => {
    const goalManager = {
      clear: vi.fn(),
      saveToThread: vi.fn(),
    };
    const state = {
      goalManager,
      planStartedGoalId: 'plan-goal-123',
    };
    const showInfo = vi.fn();
    const ctx = {
      state,
      showInfo,
    } as any;

    await handleGoalCommand(ctx, ['clear']);

    expect(goalManager.clear).toHaveBeenCalled();
    expect(goalManager.saveToThread).toHaveBeenCalledWith(state);
    expect(state.planStartedGoalId).toBeUndefined();
    expect(showInfo).toHaveBeenCalledWith('Goal cleared.');
  });

  it('clears planStartedGoalId when starting a new manual goal', async () => {
    const goal = {
      id: 'manual-goal-456',
      objective: 'new manual objective',
      status: 'active' as const,
      turnsUsed: 0,
      maxTurns: 50,
      judgeModelId: 'openai/gpt-5.5',
      startedAt: new Date().toISOString(),
    };
    const goalManager = {
      getGoal: vi.fn(() => null),
      setGoal: vi.fn(() => goal),
      persistOnNextThreadCreate: vi.fn(),
      saveToThread: vi.fn().mockResolvedValue(undefined),
    };
    const sendSignal = vi.fn().mockResolvedValue({ accepted: Promise.resolve() });
    const state = {
      goalManager,
      harness: {
        getCurrentThreadId: vi.fn(() => 'thread-1'),
        sendSignal,
      },
      planStartedGoalId: 'plan-goal-xyz',
    };
    const showInfo = vi.fn();
    const showError = vi.fn();
    const ctx = {
      state,
      showInfo,
      showError,
    } as any;

    await handleGoalCommand(ctx, ['new', 'manual', 'objective']);

    expect(goalManager.setGoal).toHaveBeenCalledWith('new manual objective', expect.any(String), expect.any(Number));
    expect(state.planStartedGoalId).toBeUndefined();
  });
});
