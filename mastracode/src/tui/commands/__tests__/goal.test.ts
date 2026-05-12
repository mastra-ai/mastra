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

vi.mock('../../../onboarding/settings.js', () => settingsMock);

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
    const sendMessage = vi.fn();
    const ctx = {
      state: {
        pendingNewThread: true,
        goalManager,
        harness: {
          createThread,
          getCurrentThreadId: vi.fn(() => currentThreadId),
          sendMessage,
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
    expect(sendMessage).toHaveBeenCalledWith({
      content: '<system-reminder type="goal">finish the task</system-reminder>',
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
    const sendMessage = vi.fn().mockResolvedValue(undefined);
    const ctx = {
      state: {
        pendingNewThread: false,
        goalManager,
        harness: {
          getCurrentThreadId: vi.fn(() => 'thread-1'),
          sendMessage,
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
    expect(goalManager.saveToThread.mock.invocationCallOrder[0]).toBeLessThan(sendMessage.mock.invocationCallOrder[0]);
    expect(goalManager.isActive()).toBe(true);

    // The trigger is exactly one canonical goal reminder — no preamble, no
    // concatenated reminders. The trailing $ in the assertion mirrors the
    // legacy whole-message reminder regex used at render time.
    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenCalledWith({
      content: '<system-reminder type="goal"># Ship it\n\n1. Build\n2. Test</system-reminder>',
    });
    const sentContent = sendMessage.mock.calls[0][0].content as string;
    expect(sentContent).toMatch(/^<system-reminder type="goal">[\s\S]*<\/system-reminder>$/);
    expect(sentContent).not.toMatch(/begin executing/);
    expect(sentContent.match(/<system-reminder/g)).toHaveLength(1);
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
    const sendMessage = vi.fn(async () => {
      isActiveAtSendMessage = goalManager.isActive();
    });

    const ctx = {
      state: {
        pendingNewThread: false,
        goalManager,
        harness: {
          getCurrentThreadId: vi.fn(() => 'thread-1'),
          setThreadSetting,
          sendMessage,
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

    expect(goalManager.isActive()).toBe(true);
    expect(sendMessage).not.toHaveBeenCalled();
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
});
