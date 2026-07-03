import { Container } from '@earendil-works/pi-tui';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => vi.resetModules());

const mocks = vi.hoisted(() => ({
  handleModelsPackCommand: vi.fn().mockResolvedValue(undefined),
  handleCustomProvidersCommand: vi.fn().mockResolvedValue(undefined),
  handleGoalCommand: vi.fn().mockResolvedValue(undefined),
  handleSkillCommand: vi.fn().mockResolvedValue(undefined),
  handleJudgeCommand: vi.fn().mockResolvedValue(undefined),
  handleGithubCommand: vi.fn().mockResolvedValue(undefined),
  handleReportIssueCommand: vi.fn().mockResolvedValue(undefined),
  handleMcpCommand: vi.fn().mockResolvedValue(undefined),
  handlePluginsCommand: vi.fn().mockResolvedValue(undefined),
  processSlashCommand: vi.fn().mockResolvedValue('custom output'),
  startGoalWithDefaults: vi.fn().mockResolvedValue(undefined),
  showError: vi.fn(),
  trackCommand: vi.fn(),
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
  handleMcpCommand: mocks.handleMcpCommand,
  handleModeCommand: vi.fn(),
  handleSkillCommand: mocks.handleSkillCommand,
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
  handleReportIssueCommand: mocks.handleReportIssueCommand,
  handleSetupCommand: vi.fn(),
  handleBrowserCommand: vi.fn(),
  handleThemeCommand: vi.fn(),
  handleUpdateCommand: vi.fn(),
  handleMemoryGatewayCommand: vi.fn(),
  handleApiKeysCommand: vi.fn(),
  handlePluginsCommand: mocks.handlePluginsCommand,
  handleFeedbackCommand: vi.fn(),
  handleObservabilityCommand: vi.fn(),
  handleGithubCommand: mocks.handleGithubCommand,
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
import { isChatBoundarySpacer } from '../components/chat-boundary-spacer.js';
import { SlashCommandComponent } from '../components/slash-command.js';
import { GOAL_JUDGE_INPUT_LOCK_MESSAGE } from '../goal-input-lock.js';
import { createMockState } from './agent-controller-mock.js';

describe('dispatchSlashCommand models routing', () => {
  beforeEach(() => {
    mocks.handleModelsPackCommand.mockClear();
    mocks.handleCustomProvidersCommand.mockClear();
    mocks.handleGoalCommand.mockClear();
    mocks.handleSkillCommand.mockClear();
    mocks.handleJudgeCommand.mockClear();
    mocks.handleGithubCommand.mockClear();
    mocks.handleReportIssueCommand.mockClear();
    mocks.handleMcpCommand.mockClear();
    mocks.handlePluginsCommand.mockClear();
    mocks.processSlashCommand.mockClear();
    mocks.startGoalWithDefaults.mockClear();
    mocks.showError.mockClear();
    mocks.trackCommand.mockClear();
    mocks.showInfo.mockClear();
  });

  it('routes /models to handleModelsPackCommand', async () => {
    const state = {
      customSlashCommands: [],
      session: {
        identity: { getResourceId: vi.fn(() => 'resource-1') },
        thread: { getId: vi.fn(() => 'thread-1') },
        mode: { get: vi.fn(() => 'build') },
      },
    } as any;
    const ctx = { analytics: { trackCommand: mocks.trackCommand } } as any;

    const handled = await dispatchSlashCommand('/models', state, () => ctx);

    expect(handled).toBe(true);
    expect(mocks.handleModelsPackCommand).toHaveBeenCalledTimes(1);
    expect(mocks.handleModelsPackCommand).toHaveBeenCalledWith(ctx);
    expect(mocks.trackCommand).toHaveBeenCalledWith('models', {
      action: 'attempted',
      threadId: 'thread-1',
      resourceId: 'resource-1',
      mode: 'build',
    });
  });

  it('routes /custom-providers to handleCustomProvidersCommand', async () => {
    const state = {
      customSlashCommands: [],
      session: {
        identity: { getResourceId: vi.fn(() => 'resource-1') },
        thread: { getId: vi.fn(() => 'thread-1') },
        mode: { get: vi.fn(() => 'build') },
      },
    } as any;
    const ctx = { analytics: { trackCommand: mocks.trackCommand } } as any;

    const handled = await dispatchSlashCommand('/custom-providers', state, () => ctx);

    expect(handled).toBe(true);
    expect(mocks.handleCustomProvidersCommand).toHaveBeenCalledTimes(1);
    expect(mocks.handleCustomProvidersCommand).toHaveBeenCalledWith(ctx);
    expect(mocks.trackCommand).toHaveBeenCalledWith('custom-providers', {
      action: 'attempted',
      threadId: 'thread-1',
      resourceId: 'resource-1',
      mode: 'build',
    });
  });

  it('treats /models:pack as unknown command', async () => {
    const state = { customSlashCommands: [] } as any;

    const handled = await dispatchSlashCommand('/models:pack', state, () => ({}) as any);

    expect(handled).toBe(true);
    expect(mocks.handleModelsPackCommand).not.toHaveBeenCalled();
    expect(mocks.showError).toHaveBeenCalledWith(state, 'Unknown command: models:pack');
  });

  it('routes /goal judge to handleGoalCommand', async () => {
    const state = { customSlashCommands: [] } as any;
    const ctx = {} as any;

    const handled = await dispatchSlashCommand('/goal judge', state, () => ctx);

    expect(handled).toBe(true);
    expect(mocks.handleGoalCommand).toHaveBeenCalledTimes(1);
    expect(mocks.handleGoalCommand).toHaveBeenCalledWith(ctx, ['judge']);
  });

  it('routes /github to handleGithubCommand', async () => {
    const state = { customSlashCommands: [] } as any;
    const ctx = {} as any;

    const handled = await dispatchSlashCommand('/github mastra-ai/mastra#17447', state, () => ctx);

    expect(handled).toBe(true);
    expect(mocks.handleGithubCommand).toHaveBeenCalledTimes(1);
    expect(mocks.handleGithubCommand).toHaveBeenCalledWith(ctx, ['mastra-ai/mastra#17447']);
  });

  it('routes /plugins to handlePluginsCommand', async () => {
    const state = { customSlashCommands: [] } as any;
    const ctx = {} as any;

    const handled = await dispatchSlashCommand('/plugins', state, () => ctx);

    expect(handled).toBe(true);
    expect(mocks.handlePluginsCommand).toHaveBeenCalledTimes(1);
    expect(mocks.handlePluginsCommand).toHaveBeenCalledWith(ctx, []);
  });

  it('routes /report-issue to handleReportIssueCommand', async () => {
    const state = { customSlashCommands: [] } as any;
    const ctx = {} as any;

    const handled = await dispatchSlashCommand('/report-issue startup hangs', state, () => ctx);

    expect(handled).toBe(true);
    expect(mocks.handleReportIssueCommand).toHaveBeenCalledTimes(1);
    expect(mocks.handleReportIssueCommand).toHaveBeenCalledWith(ctx, ['startup', 'hangs']);
  });

  it('keeps removed /fix-issue command absent from dispatch', async () => {
    const state = { customSlashCommands: [] } as any;

    const handled = await dispatchSlashCommand('/fix-issue 123', state, () => ({}) as any);

    expect(handled).toBe(true);
    expect(mocks.handleReportIssueCommand).not.toHaveBeenCalled();
    expect(mocks.showError).toHaveBeenCalledWith(state, 'Unknown command: fix-issue');
  });

  it('routes /mcp with the slash command context that owns the manager', async () => {
    const mcpManager = { hasServers: vi.fn(() => true) };
    const state = { customSlashCommands: [] } as any;
    const ctx = { mcpManager } as any;

    const handled = await dispatchSlashCommand('/mcp status', state, () => ctx);

    expect(handled).toBe(true);
    expect(mocks.handleMcpCommand).toHaveBeenCalledTimes(1);
    expect(mocks.handleMcpCommand).toHaveBeenCalledWith(ctx, ['status']);
  });

  it('routes /skill/name to handleSkillCommand', async () => {
    const state = { customSlashCommands: [] } as any;
    const ctx = {} as any;

    const handled = await dispatchSlashCommand('/skill/github-triage focus tests', state, () => ctx);

    expect(handled).toBe(true);
    expect(mocks.handleSkillCommand).toHaveBeenCalledTimes(1);
    expect(mocks.handleSkillCommand).toHaveBeenCalledWith(ctx, 'github-triage', ['focus', 'tests']);
    expect(mocks.showError).not.toHaveBeenCalled();
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

  it('eagerly resolves workspace for /goal skill aliases before the first message', async () => {
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
    const workspace = { skills: { get: vi.fn().mockResolvedValue(skill) } };
    const ctx = {
      state,
      getResolvedWorkspace: vi.fn(() => undefined),
      controller: {
        hasWorkspace: vi.fn(() => true),
        resolveWorkspace: vi.fn().mockResolvedValue(workspace),
      },
    } as any;

    const handled = await dispatchSlashCommand('/goal/review focus tests', state, () => ctx);

    expect(handled).toBe(true);
    expect(ctx.controller.resolveWorkspace).toHaveBeenCalledTimes(1);
    expect(workspace.skills.get).toHaveBeenCalledWith('/skills/review');
    expect(mocks.startGoalWithDefaults).toHaveBeenCalledWith(
      ctx,
      '# Skill goal: review\n\nReview the code carefully.\n\nARGUMENTS: focus tests',
    );
    expect(mocks.showError).not.toHaveBeenCalled();
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

  it('routes //deploy to a matching custom slash command with immediate boundary spacing', async () => {
    const previousComponent = new Container();
    (previousComponent as any).getChatSpacingKind = () => 'user-message';
    const chatContainer = new Container();
    chatContainer.addChild(previousComponent);
    const state = createMockState({
      threadId: 'thread-1',
      extra: {
        customSlashCommands: [
          { name: 'deploy', description: 'Deploy to prod', template: 'deploy now', sourcePath: '' },
        ],
        pendingNewThread: false,
        allSlashCommandComponents: [],
        messageComponentsById: new Map(),
        chatContainer,
        ui: { requestRender: vi.fn() },
      },
    }) as any;

    const handled = await dispatchSlashCommand('//deploy', state, () => ({}) as any);

    expect(handled).toBe(true);
    expect(mocks.processSlashCommand).toHaveBeenCalledTimes(1);
    expect(mocks.processSlashCommand).toHaveBeenCalledWith(state.customSlashCommands[0], [], process.cwd());
    expect(state.session.thread.create).not.toHaveBeenCalled();
    expect(state.session.sendMessage).toHaveBeenCalledWith({
      content: '<slash-command name="deploy">\ncustom output\n</slash-command>',
    });
    expect(state.chatContainer.children).toHaveLength(3);
    expect(state.chatContainer.children[0]).toBe(previousComponent);
    expect(isChatBoundarySpacer(state.chatContainer.children[1]!)).toBe(true);
    expect(state.chatContainer.children[2]).toBeInstanceOf(SlashCommandComponent);
    expect(mocks.showError).not.toHaveBeenCalled();
  });

  it('renders a pending message when a custom slash command signals an active run', async () => {
    const sendSignal = vi
      .fn()
      .mockReturnValue({ id: 'signal-custom-1', accepted: Promise.resolve({ accepted: true, runId: 'run-1' }) });
    const state = createMockState({
      session: {
        stream: { isActive: vi.fn(() => true) },
        displayState: { get: vi.fn(() => ({ isRunning: true })) },
        sendSignal,
      },
      extra: {
        customSlashCommands: [
          { name: 'deploy', description: 'Deploy to prod', template: 'deploy now', sourcePath: '' },
        ],
        pendingNewThread: false,
        allSlashCommandComponents: [],
        messageComponentsById: new Map(),
        pendingSignalMessageComponentsById: new Map(),
        followUpComponents: [],
        chatContainer: new Container(),
        ui: { requestRender: vi.fn() },
      },
    }) as any;

    const handled = await dispatchSlashCommand('//deploy staging', state, () => ({}) as any);

    expect(handled).toBe(true);
    expect(sendSignal).toHaveBeenCalledWith({
      content: '<slash-command name="deploy">\ncustom output\n</slash-command>',
    });
    expect(state.session.sendMessage).not.toHaveBeenCalled();
    expect(state.pendingSignalMessageComponentsById.get('signal-custom-1')?.text).toBe('//deploy staging');
    expect(state.allSlashCommandComponents).toHaveLength(0);
    expect(state.chatContainer.children.length).toBe(1);
  });

  it('removes the pending message when custom slash command signal delivery fails', async () => {
    const sendSignal = vi
      .fn()
      .mockReturnValue({ id: 'signal-custom-1', accepted: Promise.reject(new Error('rejected')) });
    const state = createMockState({
      session: {
        stream: { isActive: vi.fn(() => true) },
        displayState: { get: vi.fn(() => ({ isRunning: true })) },
        sendSignal,
      },
      extra: {
        customSlashCommands: [
          { name: 'deploy', description: 'Deploy to prod', template: 'deploy now', sourcePath: '' },
        ],
        pendingNewThread: false,
        allSlashCommandComponents: [],
        messageComponentsById: new Map(),
        pendingSignalMessageComponentsById: new Map(),
        followUpComponents: [],
        chatContainer: new Container(),
        ui: { requestRender: vi.fn() },
      },
    }) as any;

    const handled = await dispatchSlashCommand('//deploy staging', state, () => ({}) as any);

    expect(handled).toBe(true);
    expect(state.pendingSignalMessageComponentsById.has('signal-custom-1')).toBe(false);
    expect(state.chatContainer.children.length).toBe(0);
    expect(mocks.showError).toHaveBeenCalledWith(state, 'Error executing //deploy: rejected');
  });

  it('creates the pending new thread before sending a custom slash command', async () => {
    const state = createMockState({
      extra: {
        customSlashCommands: [
          { name: 'deploy', description: 'Deploy to prod', template: 'deploy now', sourcePath: '' },
        ],
        pendingNewThread: true,
        allSlashCommandComponents: [],
        messageComponentsById: new Map(),
        chatContainer: new Container(),
        ui: { requestRender: vi.fn() },
      },
    }) as any;

    const handled = await dispatchSlashCommand('//deploy', state, () => ({}) as any);

    expect(handled).toBe(true);
    expect(state.session.thread.create).toHaveBeenCalledTimes(1);
    expect(state.session.sendMessage).toHaveBeenCalledWith({
      content: '<slash-command name="deploy">\ncustom output\n</slash-command>',
    });
    expect(state.session.thread.create.mock.invocationCallOrder[0]).toBeLessThan(
      state.session.sendMessage.mock.invocationCallOrder[0],
    );
    expect(state.pendingNewThread).toBe(false);
  });

  it('keeps /new routed to the built-in command when a custom command has the same name', async () => {
    const state = {
      customSlashCommands: [{ name: 'new', description: 'Custom new', template: 'custom new', sourcePath: '' }],
      session: {
        identity: { getResourceId: vi.fn(() => 'resource-1') },
        thread: { getId: vi.fn(() => null) },
        mode: { get: vi.fn(() => 'build') },
      },
    } as any;
    const ctx = { analytics: { trackCommand: mocks.trackCommand } } as any;

    const handled = await dispatchSlashCommand('/new', state, () => ctx);

    expect(handled).toBe(true);
    expect(mocks.handleModelsPackCommand).not.toHaveBeenCalled();
    expect(mocks.processSlashCommand).not.toHaveBeenCalled();
    expect(mocks.trackCommand).toHaveBeenCalledWith('new', {
      action: 'attempted',
      threadId: null,
      resourceId: 'resource-1',
      mode: 'build',
    });
  });

  it('routes //new to the matching custom command even when a built-in exists', async () => {
    const state = createMockState({
      threadId: 'thread-1',
      extra: {
        customSlashCommands: [{ name: 'new', description: 'Custom new', template: 'custom new', sourcePath: '' }],
        allSlashCommandComponents: [],
        messageComponentsById: new Map(),
        chatContainer: new Container(),
        ui: { requestRender: vi.fn() },
      },
    }) as any;

    const handled = await dispatchSlashCommand('//new', state, () => ({}) as any);

    expect(handled).toBe(true);
    expect(mocks.processSlashCommand).toHaveBeenCalledTimes(1);
    expect(mocks.processSlashCommand).toHaveBeenCalledWith(state.customSlashCommands[0], [], process.cwd());
  });
});
