import { describe, expect, it, vi, beforeEach } from 'vitest';

const {
  fetchLatestVersionMock,
  fetchChangelogMock,
  detectPackageManagerMock,
  isNewerVersionMock,
  performUpdateMock,
  loadSettingsMock,
  saveSettingsMock,
  showInfoMock,
  showLinesMock,
  stopProgressMock,
  showProgressMock,
} = vi.hoisted(() => {
  const stopProgressMock = vi.fn();
  return {
    fetchLatestVersionMock: vi.fn(),
    fetchChangelogMock: vi.fn(),
    detectPackageManagerMock: vi.fn(),
    isNewerVersionMock: vi.fn(),
    performUpdateMock: vi.fn(),
    loadSettingsMock: vi.fn(),
    saveSettingsMock: vi.fn(),
    showInfoMock: vi.fn(),
    showLinesMock: vi.fn(),
    stopProgressMock,
    showProgressMock: vi.fn(() => stopProgressMock),
  };
});

vi.mock('@mastra/code-sdk/utils/update-check', () => ({
  fetchLatestVersion: fetchLatestVersionMock,
  fetchChangelog: fetchChangelogMock,
  detectPackageManager: detectPackageManagerMock,
  isNewerVersion: isNewerVersionMock,
  performUpdate: performUpdateMock,
  describeUpdate: (pm: string, version: string) => ({ via: pm, command: `${pm} add -g mastracode@${version}` }),
}));

vi.mock('@mastra/code-sdk/onboarding/settings', () => ({
  loadSettings: loadSettingsMock,
  saveSettings: saveSettingsMock,
}));

vi.mock('../../display.js', () => ({
  showInfo: showInfoMock,
  showLines: showLinesMock,
  showProgress: showProgressMock,
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

const plain = (text: string) => text.replace(/\x1b\[[0-9;]*m/g, '');
const shownLines = () => showLinesMock.mock.calls.map(([, lines]) => (lines as string[]).map(plain));

function createCtx(version = '0.1.0') {
  return {
    state: {
      options: { version },
      chatContainer: { children: [] as any[] },
      ui: { requestRender: vi.fn() },
      activeInlineQuestion: undefined,
    },
    showInfo: vi.fn(),
    showError: vi.fn(),
    stop: vi.fn(),
    exit: vi.fn(),
  } as any;
}

async function flushPromises(times = 4) {
  for (let i = 0; i < times; i++) {
    await Promise.resolve();
  }
}

async function answer(ctx: any, choice: string) {
  const command = handleUpdateCommand(ctx);
  await flushPromises();
  ctx.state.activeInlineQuestion.config.onSubmit(choice);
  await command;
}

describe('handleUpdateCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchLatestVersionMock.mockResolvedValue('0.2.0');
    fetchChangelogMock.mockResolvedValue('  • New thing');
    detectPackageManagerMock.mockResolvedValue('pnpm');
    isNewerVersionMock.mockReturnValue(true);
    performUpdateMock.mockResolvedValue({
      status: 'failed',
      message: '',
      command: 'pnpm add -g mastracode@0.2.0',
    });
    loadSettingsMock.mockReturnValue({ updateDismissedVersion: null });
  });

  it('spins while checking, then reports a registry failure without opening a prompt', async () => {
    fetchLatestVersionMock.mockResolvedValue(null);
    const ctx = createCtx();

    await handleUpdateCommand(ctx);

    expect(showProgressMock).toHaveBeenCalledWith(ctx.state, 'Checking for updates');
    expect(stopProgressMock).toHaveBeenCalled();
    expect(shownLines()).toEqual([
      ['Mastra Code  v0.1.0', "✗ Couldn't reach the npm registry. Check your connection and try again."],
    ]);
    expect(ctx.state.chatContainer.children).toHaveLength(0);
    expect(fetchChangelogMock).not.toHaveBeenCalled();
  });

  it('reports already-latest versions without clearing dismissed update state', async () => {
    isNewerVersionMock.mockReturnValue(false);
    loadSettingsMock.mockReturnValue({ updateDismissedVersion: '0.2.0' });
    const ctx = createCtx('0.2.0');

    await handleUpdateCommand(ctx);

    expect(shownLines()).toEqual([['Mastra Code  v0.2.0', '✓ Up to date']]);
    expect(saveSettingsMock).not.toHaveBeenCalled();
    expect(ctx.state.chatContainer.children).toHaveLength(0);
  });

  it('shows the versions and changelog, clears previous dismissals, and persists No', async () => {
    loadSettingsMock.mockReturnValue({ updateDismissedVersion: '0.1.9' });
    const ctx = createCtx('0.1.0');

    const command = handleUpdateCommand(ctx);
    await flushPromises();

    const component = ctx.state.activeInlineQuestion;
    expect(component.config.question).toBe("Mastra Code v0.1.0 → v0.2.0\n\nWhat's new\n  • New thing\n\nUpdate now?");
    expect(component.config.options).toEqual([
      { label: 'Yes', description: 'Install with pnpm and restart' },
      { label: 'No', description: 'Skip v0.2.0' },
    ]);
    expect(ctx.state.chatContainer.children).toContain(component);
    expect(component.focused).toBe(true);
    expect(ctx.state.ui.requestRender).toHaveBeenCalled();
    expect(saveSettingsMock).toHaveBeenCalledWith({ updateDismissedVersion: null });

    component.config.onSubmit('No');
    await command;

    expect(saveSettingsMock).toHaveBeenLastCalledWith({ updateDismissedVersion: '0.2.0' });
    expect(showInfoMock).toHaveBeenLastCalledWith(ctx.state, 'Skipped v0.2.0. Run /update to install it later.');
    expect(performUpdateMock).not.toHaveBeenCalled();
    expect(ctx.state.activeInlineQuestion).toBeUndefined();
  });

  it('spins while installing, then shows the failure and the command to run', async () => {
    performUpdateMock.mockResolvedValue({
      status: 'failed',
      message: '',
      command: 'pnpm add -g mastracode@0.2.0',
      details: 'npm ERR! permission denied',
    });
    const ctx = createCtx('0.1.0');

    await answer(ctx, 'Yes');

    expect(performUpdateMock).toHaveBeenCalledWith('pnpm', '0.2.0');
    expect(plain(showProgressMock.mock.calls[1]![1] as string)).toBe(
      'Installing with pnpm  pnpm add -g mastracode@0.2.0',
    );
    expect(stopProgressMock).toHaveBeenCalledTimes(2);
    expect(shownLines()).toEqual([
      ['✗ Update failed', '  npm ERR! permission denied', '', 'Run it yourself:  pnpm add -g mastracode@0.2.0'],
    ]);
    expect(ctx.stop).not.toHaveBeenCalled();
  });

  it('explains (without restarting) when the running install did not change', async () => {
    performUpdateMock.mockResolvedValue({
      status: 'unchanged',
      message: '',
      command: 'pnpm add -g mastracode@0.2.0',
      installDir: '/opt/vite-plus/mastracode',
    });
    const ctx = createCtx('0.1.0');

    await answer(ctx, 'Yes');

    expect(shownLines()[0]).toEqual([
      "! This Mastra Code wasn't updated",
      '  It was installed by another tool, at /opt/vite-plus/mastracode',
      '',
      'Update it with the tool that installed it, or run:  pnpm add -g mastracode@0.2.0',
    ]);
    expect(ctx.stop).not.toHaveBeenCalled();
  });

  it('stops the TUI, prints the result to the shell, and exits on success', async () => {
    const logSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    performUpdateMock.mockResolvedValue({ status: 'updated', message: '', via: 'pnpm' });
    const ctx = createCtx('0.1.0');

    await answer(ctx, 'Yes');

    // The confirmation is printed after the TUI stops so it survives the exit.
    expect(ctx.stop).toHaveBeenCalled();
    expect(plain(logSpy.mock.calls[0]![0] as string)).toBe(
      'Mastra Code  v0.1.0 → v0.2.0\n✓ Updated with pnpm. Run mastracode to start the new version.',
    );
    expect(ctx.exit).toHaveBeenCalledWith(0);
    logSpy.mockRestore();
  });
});
