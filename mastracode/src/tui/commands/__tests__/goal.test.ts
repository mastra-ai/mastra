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

import { DEFAULT_MAX_TURNS } from '../../goal-manager.js';
import { createGoalReminderMessage, handleGoalCommand, handleJudgeCommand } from '../goal.js';

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
