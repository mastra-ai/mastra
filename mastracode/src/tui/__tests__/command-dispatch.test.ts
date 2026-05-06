import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => vi.resetModules());

const mocks = vi.hoisted(() => ({
  handleModelsPackCommand: vi.fn().mockResolvedValue(undefined),
  handleCustomProvidersCommand: vi.fn().mockResolvedValue(undefined),
  processSlashCommand: vi.fn().mockResolvedValue('custom output'),
  showError: vi.fn(),
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
  handleSetupCommand: vi.fn(),
  handleThemeCommand: vi.fn(),
}));

vi.mock('../display.js', () => ({
  showError: mocks.showError,
  showInfo: vi.fn(),
}));

vi.mock('../../utils/slash-command-processor.js', () => ({
  processSlashCommand: mocks.processSlashCommand,
}));

import { dispatchSlashCommand } from '../command-dispatch.js';

describe('dispatchSlashCommand models routing', () => {
  beforeEach(() => {
    mocks.handleModelsPackCommand.mockClear();
    mocks.handleCustomProvidersCommand.mockClear();
    mocks.processSlashCommand.mockClear();
    mocks.showError.mockClear();
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
