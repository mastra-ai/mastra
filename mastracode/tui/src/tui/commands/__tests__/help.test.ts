import { beforeEach, describe, expect, it, vi } from 'vitest';

const { loadSettingsMock } = vi.hoisted(() => ({
  loadSettingsMock: vi.fn(),
}));

vi.mock('@internal/mastracode/onboarding/settings', () => ({
  loadSettings: loadSettingsMock,
}));

import { handleHelpCommand } from '../help.js';

function createCtx(modeCount = 2) {
  return {
    controller: {
      listModes: vi.fn(() => Array.from({ length: modeCount }, (_, i) => ({ id: `mode-${i}` }))),
    },
    customSlashCommands: [
      { name: 'deploy', description: 'Deploy to production', template: '', sourcePath: '/commands/deploy.md' },
    ],
    showInfo: vi.fn(),
  } as any;
}

describe('handleHelpCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.MASTRACODE_SHELL;
    delete process.env.MASTRACODE_SHELL_MODE;
    loadSettingsMock.mockReturnValue({
      shellPassthrough: {
        executable: '/bin/zsh',
        mode: 'login',
        family: 'posix',
      },
    });
  });

  it('renders compact help through showInfo using modes, custom commands, and shell settings', () => {
    const ctx = createCtx(3);

    handleHelpCommand(ctx);

    const text = ctx.showInfo.mock.calls[0]?.[0] as string;
    expect(text).toContain('Commands');
    expect(text).toContain('/browser');
    expect(text).toContain('/api-keys');
    expect(text).toContain('/observability');
    expect(text).not.toContain('/feedback');
    expect(text).toContain('//deploy');
    expect(text).toContain('Deploy to production');
    expect(text).toContain('!<cmd>');
    expect(text).toContain('Run a direct shell command (zsh (posix, login/profile))');
    expect(text).toMatch(/\/mode\s+Switch or list modes/);
    expect(text).toContain('⇧+Tab');
    expect(text).toContain('Enter');
    expect(text).toContain('Send message');
    expect(text).toContain('Ctrl+F');
    expect(text).toContain('Queue follow-up');
    expect(text).toContain('Ctrl+Z');
    expect(text).toContain('Suspend process (fg to resume)');
    expect(text).toContain('Alt+Z');
    expect(text).toContain('Undo last clear');
  });

  it('hides mode switching help for single-mode sessions', () => {
    const ctx = createCtx(1);

    handleHelpCommand(ctx);

    const text = ctx.showInfo.mock.calls[0]?.[0] as string;
    expect(text).not.toMatch(/\/mode\s+Switch or list modes/);
    expect(text).not.toContain('⇧+Tab');
    expect(text).toContain('/help');
  });
});
