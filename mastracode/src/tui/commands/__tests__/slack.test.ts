import { beforeEach, describe, expect, it, vi } from 'vitest';

import { handleSlackCommand } from '../slack.js';
import type { SlashCommandContext } from '../types.js';

const loadSettingsMock = vi.fn();
const saveSettingsMock = vi.fn();
const setSlackLoginContextMock = vi.fn();
const hasSlackTokenMock = vi.fn();
const resolveSlackClientIdMock = vi.fn();

vi.mock('../../../onboarding/settings.js', () => ({
  loadSettings: () => loadSettingsMock(),
  saveSettings: (value: unknown) => saveSettingsMock(value),
}));

vi.mock('../../../slack/oauth.js', () => ({
  SLACK_AUTH_PROVIDER_ID: 'slack',
  setSlackLoginContext: (ctx: unknown) => setSlackLoginContextMock(ctx),
}));

vi.mock('../../../slack/config.js', () => ({
  SLACK_MCP_SERVER_NAME: 'slack',
  hasSlackToken: (...args: unknown[]) => hasSlackTokenMock(...args),
}));

vi.mock('../../../slack/client-id.js', () => ({
  resolveSlackClientId: (...args: unknown[]) => resolveSlackClientIdMock(...args),
}));

// Login dialog + overlay are UI-only; connect flow is exercised via login mock.
vi.mock('../../components/login-dialog.js', () => ({
  LoginDialogComponent: class {
    focused = false;
    signal = undefined;
    constructor(
      public ui: unknown,
      public providerId: string,
      public onComplete: () => void,
    ) {}
    showAuth() {}
    showPrompt() {
      return Promise.resolve('');
    }
    showProgress() {}
  },
}));

vi.mock('../../overlay.js', () => ({
  showModalOverlay: vi.fn(),
}));

function createContext(overrides: { login?: ReturnType<typeof vi.fn>; logout?: ReturnType<typeof vi.fn> } = {}) {
  const login = overrides.login ?? vi.fn(async () => undefined);
  const logout = overrides.logout ?? vi.fn();
  const reload = vi.fn(async () => undefined);
  const getServerStatuses = vi.fn(() => [] as Array<{ name: string; connected: boolean; toolCount: number }>);
  const authStorage = {
    login,
    logout,
    get: vi.fn(() => undefined),
  };
  const ctx = {
    authStorage,
    mcpManager: { reload, getServerStatuses },
    state: { ui: { hideOverlay: vi.fn() } },
    showInfo: vi.fn(),
    showError: vi.fn(),
  } as unknown as SlashCommandContext;
  return { ctx, login, logout, reload, getServerStatuses, authStorage };
}

describe('handleSlackCommand', () => {
  beforeEach(() => {
    loadSettingsMock.mockReset();
    saveSettingsMock.mockReset();
    setSlackLoginContextMock.mockReset();
    hasSlackTokenMock.mockReset();
    resolveSlackClientIdMock.mockReset();

    loadSettingsMock.mockReturnValue({ slack: { enabled: true, permissionLevel: 'read-only' } });
    hasSlackTokenMock.mockReturnValue(false);
    resolveSlackClientIdMock.mockReturnValue('client-123');
  });

  it('shows disabled status with no args when off', async () => {
    loadSettingsMock.mockReturnValue({ slack: { enabled: false, permissionLevel: 'read-only' } });
    const { ctx } = createContext();
    await handleSlackCommand(ctx, []);
    const message = (ctx.showInfo as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(message).toContain('Slack integration: disabled');
    expect(message).toContain('Connected: no');
  });

  it('shows status with no args', async () => {
    const { ctx } = createContext();
    await handleSlackCommand(ctx, []);
    const message = (ctx.showInfo as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(message).toContain('Slack integration: enabled');
    expect(message).toContain('Connected: no');
    expect(message).toContain('Permission level: read-only');
  });

  it('rejects an unknown permission level on connect', async () => {
    const { ctx, login } = createContext();
    await handleSlackCommand(ctx, ['connect', 'bogus']);
    expect(ctx.showError).toHaveBeenCalledWith(expect.stringContaining("Unknown permission level 'bogus'"));
    expect(login).not.toHaveBeenCalled();
  });

  it('runs the login flow on connect and reloads the MCP manager', async () => {
    const { ctx, login, reload } = createContext();
    await handleSlackCommand(ctx, ['connect', 'read-write']);
    expect(setSlackLoginContextMock).toHaveBeenCalledWith(expect.objectContaining({ permissionLevel: 'read-write' }));
    expect(login).toHaveBeenCalledWith('slack', expect.any(Object));
    expect(reload).toHaveBeenCalled();
    // Connecting turns the integration on.
    expect(saveSettingsMock).toHaveBeenCalledWith(
      expect.objectContaining({ slack: expect.objectContaining({ enabled: true }) }),
    );
  });

  it('errors on connect when no client_id can be resolved', async () => {
    resolveSlackClientIdMock.mockReturnValue(undefined);
    const { ctx, login } = createContext();
    await handleSlackCommand(ctx, ['connect']);
    expect(ctx.showError).toHaveBeenCalledWith(expect.stringContaining('No Slack client_id'));
    expect(login).not.toHaveBeenCalled();
  });

  it('changes the permission level and persists it', async () => {
    const { ctx } = createContext();
    await handleSlackCommand(ctx, ['level', 'full']);
    expect(saveSettingsMock).toHaveBeenCalledWith(
      expect.objectContaining({ slack: expect.objectContaining({ permissionLevel: 'full' }) }),
    );
    expect(ctx.showInfo).toHaveBeenCalledWith(expect.stringContaining('re-authorize'));
  });

  it('rejects an unknown permission level on level', async () => {
    const { ctx } = createContext();
    await handleSlackCommand(ctx, ['level', 'nope']);
    expect(ctx.showError).toHaveBeenCalledWith(expect.stringContaining("Unknown permission level 'nope'"));
    expect(saveSettingsMock).not.toHaveBeenCalled();
  });

  it('reports not-connected on disconnect when no token exists and disabled', async () => {
    loadSettingsMock.mockReturnValue({ slack: { enabled: false, permissionLevel: 'read-only' } });
    hasSlackTokenMock.mockReturnValue(false);
    const { ctx, logout } = createContext();
    await handleSlackCommand(ctx, ['disconnect']);
    expect(ctx.showInfo).toHaveBeenCalledWith('Slack is not connected.');
    expect(logout).not.toHaveBeenCalled();
  });

  it('logs out, disables, and reloads on disconnect when connected', async () => {
    hasSlackTokenMock.mockReturnValue(true);
    const { ctx, logout, reload } = createContext();
    await handleSlackCommand(ctx, ['disconnect']);
    expect(logout).toHaveBeenCalledWith('slack');
    expect(reload).toHaveBeenCalled();
    // Disconnecting turns the integration off.
    expect(saveSettingsMock).toHaveBeenCalledWith(
      expect.objectContaining({ slack: expect.objectContaining({ enabled: false }) }),
    );
    expect(ctx.showInfo).toHaveBeenCalledWith('Disconnected from Slack.');
  });

  it('shows usage on an unrecognized action', async () => {
    const { ctx } = createContext();
    await handleSlackCommand(ctx, ['frobnicate']);
    expect(ctx.showError).toHaveBeenCalledWith(expect.stringContaining('Usage: /slack'));
  });
});
