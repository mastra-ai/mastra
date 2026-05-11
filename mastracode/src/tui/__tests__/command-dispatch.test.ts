import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => vi.resetModules());

const mocks = vi.hoisted(() => ({
  handleModelsPackCommand: vi.fn().mockResolvedValue(undefined),
  handleCustomProvidersCommand: vi.fn().mockResolvedValue(undefined),
  handleGoalCommand: vi.fn().mockResolvedValue(undefined),
  handleJudgeCommand: vi.fn().mockResolvedValue(undefined),
  processSlashCommand: vi.fn().mockResolvedValue('custom output'),
  startGoalWithDefaults: vi.fn().mockResolvedValue(undefined),
  showError: vi.fn(),
  showInfo: vi.fn(),
}));

vi.mock('../commands/index.js', () => ({
  handleHelpCommand: vi.fn(),
  handleCostCommand: vi.fn(),
  handleYoloCommand: vi.fn(),
  handleThinkCommand: vi.fn(),
  handlePermissionsCommand: vi.fn(),
  handleNameCommand: vi.fn(),
  handleExitCommand: vi.fn(),
  handleHooksCommand: vi.fn(),
  handleMcpCommand: vi.fn(),
  handleModeCommand: vi.fn(),
  handleSkillsCommand: vi.fn(),
  handleNewCommand: vi.fn(),
  handleResourceCommand: vi.fn(),
  handleDiffCommand: vi.fn(),
  handleThreadsCommand: vi.fn(),
  handleThreadTagDirCommand: vi.fn(),
  handleSandboxCommand: vi.fn(),
  handleModelsPackCommand: mocks.handleModelsPackCommand,
  handleCustomProvidersCommand: mocks.handleCustomProvidersCommand,
  handleSubagentsCommand: vi.fn(),
  handleOMCommand: vi.fn(),
  handleSettingsCommand: vi.fn(),
  handleLoginCommand: vi.fn(),
  handleReviewCommand: vi.fn(),
  handleReportIssueCommand: vi.fn(),
  handleSetupCommand: vi.fn(),
  handleBrowserCommand: vi.fn(),
  handleThemeCommand: vi.fn(),
  handleUpdateCommand: vi.fn(),
  handleMemoryGatewayCommand: vi.fn(),
  handleApiKeysCommand: vi.fn(),
  handleFeedbackCommand: vi.fn(),
  handleObservabilityCommand: vi.fn(),
  handleGoalCommand: mocks.handleGoalCommand,
  handleJudgeCommand: mocks.handleJudgeCommand,
}));

vi.mock('../display.js', () => ({
  showError: mocks.showError,
  showInfo: mocks.showInfo,
}));

vi.mock('../../utils/slash-command-processor.js', () => ({
  processSlashCommand: mocks.processSlashCommand,
}));

vi.mock('../commands/goal.js', () => ({
  startGoalWithDefaults: mocks.startGoalWithDefaults,
}));

import { dispatchSlashCommand } from '../command-dispatch.js';
import { GOAL_JUDGE_INPUT_LOCK_MESSAGE } from '../goal-input-lock.js';

describe('dispatchSlashCommand models routing', () => {
  beforeEach(() => {
    mocks.handleModelsPackCommand.mockClear();
    mocks.handleCustomProvidersCommand.mockClear();
    mocks.handleGoalCommand.mockClear();
    mocks.handleJudgeCommand.mockClear();
    mocks.processSlashCommand.mockClear();
    mocks.startGoalWithDefaults.mockClear();
    mocks.showError.mockClear();
    mocks.showInfo.mockClear();
  });

  it('routes /models to handleModelsPackCommand', async () => {
    const state = { customSlashCommands: [] } as any;
    const ctx = {} as any;

    const handled = await dispatchSlashCommand('/models', state, () => ctx);

    expect(handled).toBe(true);
    expect(mocks.handleModelsPackCommand).toHaveBeenCalledTimes(1);
    expect(mocks.handleModelsPackCommand).toHaveBeenCalledWith(ctx);
  });

  it('routes /custom-providers to handleCustomProvidersCommand', async () => {
    const state = { customSlashCommands: [] } as any;
    const ctx = {} as any;

    const handled = await dispatchSlashCommand('/custom-providers', state, () => ctx);

    expect(handled).toBe(true);
    expect(mocks.handleCustomProvidersCommand).toHaveBeenCalledTimes(1);
    expect(mocks.handleCustomProvidersCommand).toHaveBeenCalledWith(ctx);
  });

  it('treats /models:pack as unknown command', async () => {
    const state = { customSlashCommands: [] } as any;

    const handled = await dispatchSlashCommand('/models:pack', state, () => ({}) as any);

    expect(handled).toBe(true);
    expect(mocks.handleModelsPackCommand).not.toHaveBeenCalled();
    expect(mocks.showError).toHaveBeenCalledWith(state, 'Unknown command: models:pack');
  });

  it('routes /judge to handleJudgeCommand', async () => {
    const state = { customSlashCommands: [] } as any;
    const ctx = {} as any;

    const handled = await dispatchSlashCommand('/judge', state, () => ctx);

    expect(handled).toBe(true);
    expect(mocks.handleJudgeCommand).toHaveBeenCalledTimes(1);
    expect(mocks.handleJudgeCommand).toHaveBeenCalledWith(ctx);
  });

  it('routes multiline /goal objectives as a single goal argument', async () => {
    const state = { customSlashCommands: [] } as any;
    const ctx = {} as any;

    const handled = await dispatchSlashCommand('/goal build the feature\nthen verify it', state, () => ctx);

    expect(handled).toBe(true);
    expect(mocks.handleGoalCommand).toHaveBeenCalledTimes(1);
    expect(mocks.handleGoalCommand).toHaveBeenCalledWith(ctx, ['build the feature\nthen verify it']);
    expect(mocks.showError).not.toHaveBeenCalled();
  });

  it('routes /goal objectives that start on the next line', async () => {
    const state = { customSlashCommands: [] } as any;
    const ctx = {} as any;

    const handled = await dispatchSlashCommand('/goal\nbuild the feature', state, () => ctx);

    expect(handled).toBe(true);
    expect(mocks.handleGoalCommand).toHaveBeenCalledTimes(1);
    expect(mocks.handleGoalCommand).toHaveBeenCalledWith(ctx, ['build the feature']);
    expect(mocks.showError).not.toHaveBeenCalled();
  });

  it('blocks slash commands while the goal judge is evaluating', async () => {
    const state = { customSlashCommands: [], activeGoalJudge: { modelId: 'openai/gpt-5.5' } } as any;

    const handled = await dispatchSlashCommand('/models', state, () => ({}) as any);

    expect(handled).toBe(true);
    expect(mocks.handleModelsPackCommand).not.toHaveBeenCalled();
    expect(mocks.showInfo).toHaveBeenCalledWith(state, GOAL_JUDGE_INPUT_LOCK_MESSAGE);
  });

  it('allows goal escape hatches while the goal judge is evaluating', async () => {
    const state = { customSlashCommands: [], activeGoalJudge: { modelId: 'openai/gpt-5.5' } } as any;
    const ctx = {} as any;

    await expect(dispatchSlashCommand('/goal pause', state, () => ctx)).resolves.toBe(true);
    await expect(dispatchSlashCommand('/goal clear', state, () => ctx)).resolves.toBe(true);

    expect(mocks.handleGoalCommand).toHaveBeenCalledTimes(2);
    expect(mocks.handleGoalCommand).toHaveBeenNthCalledWith(1, ctx, ['pause']);
    expect(mocks.handleGoalCommand).toHaveBeenNthCalledWith(2, ctx, ['clear']);
    expect(mocks.showInfo).not.toHaveBeenCalled();
  });

  it('routes /goal/deploy through a goal-enabled custom command', async () => {
    const state = {
      customSlashCommands: [
        { name: 'deploy', description: 'Deploy to prod', template: 'deploy $ARGUMENTS', sourcePath: '', goal: true },
      ],
      goalSkillCommands: [],
    } as any;
    const ctx = {} as any;

    const handled = await dispatchSlashCommand('/goal/deploy staging now', state, () => ctx);

    expect(handled).toBe(true);
    expect(mocks.processSlashCommand).toHaveBeenCalledWith(
      state.customSlashCommands[0],
      ['staging', 'now'],
      process.cwd(),
    );
    expect(mocks.startGoalWithDefaults).toHaveBeenCalledWith(ctx, 'custom output');
  });

  it('rejects custom commands that are not goal-enabled under /goal', async () => {
    const state = {
      customSlashCommands: [{ name: 'deploy', description: 'Deploy to prod', template: 'deploy now', sourcePath: '' }],
      goalSkillCommands: [],
    } as any;

    const handled = await dispatchSlashCommand('/goal/deploy', state, () => ({}) as any);

    expect(handled).toBe(true);
    expect(mocks.processSlashCommand).not.toHaveBeenCalled();
    expect(mocks.startGoalWithDefaults).not.toHaveBeenCalled();
    expect(mocks.showError).toHaveBeenCalledWith(state, 'Unknown goal command: deploy');
  });

  it('routes /goal/review through a goal-enabled skill', async () => {
    const state = {
      customSlashCommands: [],
      goalSkillCommands: [
        { name: 'review', path: '/skills/review', description: 'Review code', metadata: { goal: true } },
      ],
    } as any;
    const skill = {
      name: 'review',
      instructions: 'Review the code carefully.',
      metadata: { goal: true },
    };
    const ctx = { getResolvedWorkspace: () => ({ skills: { get: vi.fn().mockResolvedValue(skill) } }) } as any;

    const handled = await dispatchSlashCommand('/goal/review focus tests', state, () => ctx);

    expect(handled).toBe(true);
    expect(mocks.startGoalWithDefaults).toHaveBeenCalledWith(
      ctx,
      '# Skill goal: review\n\nReview the code carefully.\n\nARGUMENTS: focus tests',
    );
  });

  it('blocks custom slash commands while the goal judge is evaluating', async () => {
    const state = {
      customSlashCommands: [{ name: 'deploy', description: 'Deploy to prod', template: 'deploy now', sourcePath: '' }],
      activeGoalJudge: { modelId: 'openai/gpt-5.5' },
    } as any;

    const handled = await dispatchSlashCommand('//deploy', state, () => ({}) as any);

    expect(handled).toBe(true);
    expect(mocks.processSlashCommand).not.toHaveBeenCalled();
    expect(mocks.showInfo).toHaveBeenCalledWith(state, GOAL_JUDGE_INPUT_LOCK_MESSAGE);
  });

  it('routes //deploy to a matching custom slash command', async () => {
    const state = {
      customSlashCommands: [{ name: 'deploy', description: 'Deploy to prod', template: 'deploy now', sourcePath: '' }],
      getCurrentThreadId: vi.fn(() => 'thread-1'),
      pendingNewThread: false,
      allSlashCommandComponents: [],
      chatContainer: { addChild: vi.fn() },
      ui: { requestRender: vi.fn() },
      harness: {
        createThread: vi.fn().mockResolvedValue(undefined),
        sendMessage: vi.fn().mockResolvedValue(undefined),
      },
    } as any;

    const handled = await dispatchSlashCommand('//deploy', state, () => ({}) as any);

    expect(handled).toBe(true);
    expect(mocks.processSlashCommand).toHaveBeenCalledTimes(1);
    expect(mocks.processSlashCommand).toHaveBeenCalledWith(state.customSlashCommands[0], [], process.cwd());
    expect(state.harness.createThread).not.toHaveBeenCalled();
    expect(mocks.showError).not.toHaveBeenCalled();
  });

  it('creates the pending new thread before sending a custom slash command', async () => {
    const state = {
      customSlashCommands: [{ name: 'deploy', description: 'Deploy to prod', template: 'deploy now', sourcePath: '' }],
      pendingNewThread: true,
      allSlashCommandComponents: [],
      chatContainer: { addChild: vi.fn() },
      ui: { requestRender: vi.fn() },
      harness: {
        createThread: vi.fn().mockResolvedValue(undefined),
        sendMessage: vi.fn().mockResolvedValue(undefined),
      },
    } as any;

    const handled = await dispatchSlashCommand('//deploy', state, () => ({}) as any);

    expect(handled).toBe(true);
    expect(state.harness.createThread).toHaveBeenCalledTimes(1);
    expect(state.harness.sendMessage).toHaveBeenCalledTimes(1);
    expect(state.harness.createThread.mock.invocationCallOrder[0]).toBeLessThan(
      state.harness.sendMessage.mock.invocationCallOrder[0],
    );
    expect(state.pendingNewThread).toBe(false);
  });

  it('keeps /new routed to the built-in command when a custom command has the same name', async () => {
    const state = {
      customSlashCommands: [{ name: 'new', description: 'Custom new', template: 'custom new', sourcePath: '' }],
    } as any;
    const ctx = {} as any;

    const handled = await dispatchSlashCommand('/new', state, () => ctx);

    expect(handled).toBe(true);
    expect(mocks.handleModelsPackCommand).not.toHaveBeenCalled();
    expect(mocks.processSlashCommand).not.toHaveBeenCalled();
  });

  it('routes //new to the matching custom command even when a built-in exists', async () => {
    const state = {
      customSlashCommands: [{ name: 'new', description: 'Custom new', template: 'custom new', sourcePath: '' }],
      getCurrentThreadId: vi.fn(() => 'thread-1'),
      allSlashCommandComponents: [],
      chatContainer: { addChild: vi.fn() },
      ui: { requestRender: vi.fn() },
      harness: { sendMessage: vi.fn().mockResolvedValue(undefined) },
    } as any;

    const handled = await dispatchSlashCommand('//new', state, () => ({}) as any);

    expect(handled).toBe(true);
    expect(mocks.processSlashCommand).toHaveBeenCalledTimes(1);
    expect(mocks.processSlashCommand).toHaveBeenCalledWith(state.customSlashCommands[0], [], process.cwd());
  });
});
