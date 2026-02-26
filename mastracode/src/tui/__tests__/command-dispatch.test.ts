import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  handleModelsPackCommand: vi.fn().mockResolvedValue(undefined),
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
  processSlashCommand: vi.fn(),
}));

import { dispatchSlashCommand } from '../command-dispatch.js';

describe('dispatchSlashCommand models routing', () => {
  beforeEach(() => {
    mocks.handleModelsPackCommand.mockClear();
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

  it('treats /models:pack as unknown command', async () => {
    const state = { customSlashCommands: [] } as any;

    const handled = await dispatchSlashCommand('/models:pack', state, () => ({}) as any);

    expect(handled).toBe(true);
    expect(mocks.handleModelsPackCommand).not.toHaveBeenCalled();
    expect(mocks.showError).toHaveBeenCalledWith(state, 'Unknown command: models:pack');
  });
});
