import { describe, expect, it, vi, beforeEach } from 'vitest';

const {
  fetchLatestVersionMock,
  fetchChangelogMock,
  detectPackageManagerMock,
  isNewerVersionMock,
  runUpdateMock,
  getInstallCommandMock,
  loadSettingsMock,
  saveSettingsMock,
} = vi.hoisted(() => ({
  fetchLatestVersionMock: vi.fn(),
  fetchChangelogMock: vi.fn(),
  detectPackageManagerMock: vi.fn(),
  isNewerVersionMock: vi.fn(),
  runUpdateMock: vi.fn(),
  getInstallCommandMock: vi.fn(),
  loadSettingsMock: vi.fn(),
  saveSettingsMock: vi.fn(),
}));

vi.mock('@mastra/code-sdk/utils/update-check', () => ({
  fetchLatestVersion: fetchLatestVersionMock,
  fetchChangelog: fetchChangelogMock,
  detectPackageManager: detectPackageManagerMock,
  isNewerVersion: isNewerVersionMock,
  runUpdate: runUpdateMock,
  getInstallCommand: getInstallCommandMock,
}));

vi.mock('@mastra/code-sdk/onboarding/settings', () => ({
  loadSettings: loadSettingsMock,
  saveSettings: saveSettingsMock,
}));

vi.mock('../../components/ask-question-inline.js', () => ({
  AskQuestionInlineComponent: class {
    focused = false;
    constructor(
      public config: any,
      public ui: any,
    ) {}
  },
}));

import { handleUpdateCommand } from '../update.js';

function createCtx(version = '0.1.0') {
  return {
    state: {
      options: { version },
      chatContainer: { addChild: vi.fn() },
      ui: { requestRender: vi.fn() },
      activeInlineQuestion: undefined,
    },
    showInfo: vi.fn(),
    showError: vi.fn(),
    stop: vi.fn(),
  } as any;
}

async function flushPromises(times = 4) {
  for (let i = 0; i < times; i++) {
    await Promise.resolve();
  }
}

describe('handleUpdateCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchLatestVersionMock.mockResolvedValue('0.2.0');
    fetchChangelogMock.mockResolvedValue('  • New thing');
    detectPackageManagerMock.mockResolvedValue('pnpm');
    isNewerVersionMock.mockReturnValue(true);
    runUpdateMock.mockResolvedValue(false);
    getInstallCommandMock.mockReturnValue('pnpm add -g mastracode@0.2.0');
    loadSettingsMock.mockReturnValue({ updateDismissedVersion: null });
  });

  it('reports registry failure without opening an inline update prompt', async () => {
    fetchLatestVersionMock.mockResolvedValue(null);
    const ctx = createCtx();

    await handleUpdateCommand(ctx);

    expect(ctx.showInfo).toHaveBeenCalledWith('Checking for updates…');
    expect(ctx.showError).toHaveBeenCalledWith('Could not reach the npm registry. Check your network connection.');
    expect(ctx.state.chatContainer.addChild).not.toHaveBeenCalled();
    expect(fetchChangelogMock).not.toHaveBeenCalled();
  });

  it('reports already-latest versions without clearing dismissed update state', async () => {
    isNewerVersionMock.mockReturnValue(false);
    const settings = { updateDismissedVersion: '0.2.0' };
    loadSettingsMock.mockReturnValue(settings);
    const ctx = createCtx('0.2.0');

    await handleUpdateCommand(ctx);

    expect(ctx.showInfo).toHaveBeenCalledWith('You are already on the latest version (v0.2.0).');
    expect(saveSettingsMock).not.toHaveBeenCalled();
    expect(ctx.state.chatContainer.addChild).not.toHaveBeenCalled();
  });

  it('shows changelog text, clears previous dismissals, and persists No for the new version', async () => {
    const settings = { updateDismissedVersion: '0.1.9' };
    loadSettingsMock.mockReturnValue(settings);
    const ctx = createCtx('0.1.0');

    const command = handleUpdateCommand(ctx);
    await flushPromises();

    const component = ctx.state.activeInlineQuestion;
    expect(component.config.question).toContain('A new version is available: v0.2.0 (current: v0.1.0).');
    expect(component.config.question).toContain("What's new:\n  • New thing");
    expect(component.config.options).toEqual([
      { label: 'Yes', description: 'Update and restart' },
      { label: 'No', description: 'Skip this version' },
    ]);
    expect(ctx.state.chatContainer.addChild).toHaveBeenCalledWith(component);
    expect(component.focused).toBe(true);
    expect(ctx.state.ui.requestRender).toHaveBeenCalled();
    expect(saveSettingsMock).toHaveBeenCalledWith({ updateDismissedVersion: null });

    component.config.onSubmit('No');
    await command;

    expect(saveSettingsMock).toHaveBeenLastCalledWith({ updateDismissedVersion: '0.2.0' });
    expect(ctx.showInfo).toHaveBeenLastCalledWith('Update skipped.');
    expect(runUpdateMock).not.toHaveBeenCalled();
    expect(ctx.state.activeInlineQuestion).toBeUndefined();
  });

  it('shows the manual install command when the selected update fails', async () => {
    const ctx = createCtx('0.1.0');

    const command = handleUpdateCommand(ctx);
    await flushPromises();
    ctx.state.activeInlineQuestion.config.onSubmit('Yes');
    await command;

    expect(runUpdateMock).toHaveBeenCalledWith('pnpm', '0.2.0');
    expect(getInstallCommandMock).toHaveBeenCalledWith('pnpm', '0.2.0');
    expect(ctx.showError).toHaveBeenCalledWith('Auto-update failed. Run `pnpm add -g mastracode@0.2.0` manually.');
    expect(ctx.stop).not.toHaveBeenCalled();
  });
});
