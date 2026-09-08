import type { McpServerStatus } from '@mastra/code-sdk/mcp/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { handleMcpCommand } from '../mcp.js';
import type { SlashCommandContext } from '../types.js';

const selectorConstructorMock = vi.fn();
const showModalOverlayMock = vi.fn();

vi.mock('../../components/mcp-selector.js', () => ({
  McpSelectorComponent: class {
    focused = false;
    dispose = vi.fn();

    constructor(options: unknown) {
      selectorConstructorMock(options);
    }
  },
}));

vi.mock('../../overlay.js', () => ({
  showModalOverlay: (...args: unknown[]) => showModalOverlayMock(...args),
}));

vi.mock('../../display.js', () => ({
  showInfo: vi.fn(),
}));

function createContext() {
  const statuses: McpServerStatus[] = [
    {
      name: 'filesystem',
      connected: true,
      connecting: false,
      transport: 'stdio',
      toolCount: 2,
      toolNames: ['read_file', 'write_file'],
    },
  ];
  const skipped = [{ name: 'disabled', reason: 'disabled in config' }];
  const reload = vi.fn(async () => undefined);
  const reconnectServer = vi.fn(async () => ({ ok: true }));
  const getServerLogs = vi.fn(() => ['server log']);
  const setServerDisabled = vi.fn(
    async (name: string, disabled: boolean): Promise<McpServerStatus> => ({
      name,
      connected: !disabled,
      connecting: false,
      transport: 'stdio',
      toolCount: disabled ? 0 : 2,
      toolNames: disabled ? [] : ['read_file', 'write_file'],
      ...(disabled ? { disabled: true } : {}),
    }),
  );
  const setAllDisabled = vi.fn(async () => undefined);
  const isAllDisabledGlobally = vi.fn(() => false);
  const mcpManager = {
    hasServers: vi.fn(() => true),
    getConfigPaths: vi.fn(() => ({
      project: '/repo/.mastracode/mcp.json',
      global: '~/.mastracode/mcp.json',
      claude: '~/.claude/mcp.json',
    })),
    getServerStatuses: vi.fn(() => statuses),
    getSkippedServers: vi.fn(() => skipped),
    reload,
    reconnectServer,
    getServerLogs,
    setServerDisabled,
    setAllDisabled,
    isAllDisabledGlobally,
  };
  const ctx = {
    state: { ui: { hideOverlay: vi.fn(), requestRender: vi.fn() } },
    mcpManager,
    showInfo: vi.fn(),
    showError: vi.fn(),
  } as unknown as SlashCommandContext;

  return {
    ctx,
    mcpManager,
    statuses,
    skipped,
    reload,
    reconnectServer,
    getServerLogs,
    setServerDisabled,
    setAllDisabled,
  };
}

describe('handleMcpCommand', () => {
  beforeEach(() => {
    selectorConstructorMock.mockClear();
    showModalOverlayMock.mockClear();
  });

  it('opens the selector with live manager state when MCP is configured', async () => {
    const { ctx, mcpManager, statuses, skipped, reload, reconnectServer, getServerLogs } = createContext();

    await handleMcpCommand(ctx, []);

    expect(ctx.showInfo).not.toHaveBeenCalledWith('MCP system not initialized.');
    expect(mcpManager.hasServers).toHaveBeenCalledOnce();
    expect(selectorConstructorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        tui: ctx.state.ui,
        statuses,
        skipped,
        configPaths: {
          project: '/repo/.mastracode/mcp.json',
          global: '~/.mastracode/mcp.json',
          claude: '~/.claude/mcp.json',
        },
        getStatuses: expect.any(Function),
        onReloadAll: expect.any(Function),
        onReconnectServer: expect.any(Function),
        onSetServerDisabled: expect.any(Function),
        getServerLogs: expect.any(Function),
        showInfo: expect.any(Function),
        onClose: expect.any(Function),
      }),
    );
    expect(showModalOverlayMock).toHaveBeenCalledWith(ctx.state.ui, expect.objectContaining({ focused: true }), {
      widthPercent: 0.8,
      maxHeight: '70%',
    });

    const options = selectorConstructorMock.mock.calls[0]![0] as {
      getStatuses: () => unknown;
      onReloadAll: () => Promise<unknown>;
      onReconnectServer: (name: string) => Promise<unknown>;
      onSetServerDisabled: (name: string, disabled: boolean, options?: { global?: boolean }) => Promise<unknown>;
      getServerLogs: (name: string) => string[];
    };
    expect(options.getStatuses()).toEqual({ statuses, skipped });
    await expect(options.onReloadAll()).resolves.toEqual({ statuses, skipped });
    await expect(options.onReconnectServer('filesystem')).resolves.toEqual({ ok: true });
    await expect(options.onSetServerDisabled('filesystem', true)).resolves.toEqual({ statuses, skipped });
    expect(options.getServerLogs('filesystem')).toEqual(['server log']);
    expect(reload).toHaveBeenCalledOnce();
    expect(reconnectServer).toHaveBeenCalledWith('filesystem');
    expect(mcpManager.setServerDisabled).toHaveBeenCalledWith('filesystem', true, undefined);
    await expect(options.onSetServerDisabled('registry', true, { global: true })).resolves.toEqual({
      statuses,
      skipped,
    });
    expect(mcpManager.setServerDisabled).toHaveBeenCalledWith('registry', true, { global: true });
    expect(getServerLogs).toHaveBeenCalledWith('filesystem');
  });

  it('reports a needs-auth server as a notification, not a raw connect error, on reload', async () => {
    const { ctx, mcpManager } = createContext();
    mcpManager.getServerStatuses.mockReturnValue([
      {
        name: 'oauth_server',
        connected: false,
        connecting: false,
        transport: 'http',
        toolCount: 0,
        toolNames: [],
        needsAuth: true,
        error: 'HTTP 401 Unauthorized',
      },
    ]);

    await handleMcpCommand(ctx, ['reload']);

    expect(ctx.showInfo).toHaveBeenCalledWith(
      'MCP: \u26a0 "oauth_server" needs authentication \u2192 run /mcp to authenticate',
    );
    expect(ctx.showInfo).not.toHaveBeenCalledWith('MCP: Failed to connect to "oauth_server": HTTP 401 Unauthorized');
  });

  it('reports a genuinely failed (non-auth) server with the raw connect error on reload', async () => {
    const { ctx, mcpManager } = createContext();
    mcpManager.getServerStatuses.mockReturnValue([
      {
        name: 'broken',
        connected: false,
        connecting: false,
        transport: 'stdio',
        toolCount: 0,
        toolNames: [],
        needsAuth: false,
        error: 'spawn ENOENT',
      },
    ]);

    await handleMcpCommand(ctx, ['reload']);

    expect(ctx.showInfo).toHaveBeenCalledWith('MCP: Failed to connect to "broken": spawn ENOENT');
    expect(ctx.showInfo).not.toHaveBeenCalledWith(expect.stringContaining('needs authentication'));
  });

  it('does not report disabled servers as connection failures on reload', async () => {
    const { ctx, mcpManager } = createContext();
    mcpManager.getServerStatuses.mockReturnValue([
      {
        name: 'off',
        connected: false,
        connecting: false,
        transport: 'stdio',
        toolCount: 0,
        toolNames: [],
        disabled: true,
      },
    ]);

    await handleMcpCommand(ctx, ['reload']);

    expect(ctx.showInfo).toHaveBeenCalledWith('MCP: Reloaded. 0 server(s) connected, 0 tool(s).');
    expect(ctx.showInfo).not.toHaveBeenCalledWith(expect.stringContaining('Failed to connect to "off"'));
  });

  it('shows usage when /mcp disable is missing a target', async () => {
    const { ctx, setServerDisabled, setAllDisabled } = createContext();

    await handleMcpCommand(ctx, ['disable']);

    expect(ctx.showInfo).toHaveBeenCalledWith('Usage: /mcp disable <server-name|all> [--global]');
    expect(setServerDisabled).not.toHaveBeenCalled();
    expect(setAllDisabled).not.toHaveBeenCalled();
  });

  it('disables a single server via /mcp disable <name>', async () => {
    const { ctx, setServerDisabled } = createContext();

    await handleMcpCommand(ctx, ['disable', 'filesystem']);

    expect(setServerDisabled).toHaveBeenCalledWith('filesystem', true, { global: false });
    expect(ctx.showInfo).toHaveBeenCalledWith('MCP: Disabled "filesystem". Re-enable with /mcp enable filesystem.');
  });

  it('disables a single server globally via /mcp disable <name> --global', async () => {
    const { ctx, setServerDisabled } = createContext();

    await handleMcpCommand(ctx, ['disable', 'filesystem', '--global']);

    expect(setServerDisabled).toHaveBeenCalledWith('filesystem', true, { global: true });
    expect(ctx.showInfo).toHaveBeenCalledWith(
      'MCP: Disabled "filesystem" globally (all projects). Re-enable with /mcp enable filesystem --global.',
    );
  });

  it('explains when project-level enable leaves a global disable in effect', async () => {
    const { ctx, setServerDisabled } = createContext();
    setServerDisabled.mockResolvedValueOnce({
      name: 'filesystem',
      connected: false,
      connecting: false,
      transport: 'stdio',
      toolCount: 0,
      toolNames: [],
      disabled: true,
      disabledScope: 'global',
    });

    await handleMcpCommand(ctx, ['enable', 'filesystem']);

    expect(ctx.showInfo).toHaveBeenCalledWith(
      'MCP: "filesystem" is still disabled globally — re-enable with /mcp enable filesystem --global.',
    );
  });

  it('reports failure when disabling an unknown server', async () => {
    const { ctx, setServerDisabled } = createContext();
    setServerDisabled.mockResolvedValueOnce({
      name: 'nope',
      connected: false,
      connecting: false,
      transport: 'stdio',
      toolCount: 0,
      toolNames: [],
      error: 'Server "nope" not found',
    });

    await handleMcpCommand(ctx, ['disable', 'nope']);

    expect(ctx.showInfo).toHaveBeenCalledWith('MCP: Failed to disable "nope": Server "nope" not found');
  });

  it('enables a single server via /mcp enable <name> and reports tool count', async () => {
    const { ctx, setServerDisabled } = createContext();

    await handleMcpCommand(ctx, ['enable', 'filesystem']);

    expect(setServerDisabled).toHaveBeenCalledWith('filesystem', false, { global: false });
    expect(ctx.showInfo).toHaveBeenCalledWith('MCP: Enabled "filesystem" — 2 tool(s)');
  });

  it('reports needs-auth when an enabled server requires authentication', async () => {
    const { ctx, setServerDisabled } = createContext();
    setServerDisabled.mockResolvedValueOnce({
      name: 'oauth_server',
      connected: false,
      connecting: false,
      transport: 'http',
      toolCount: 0,
      toolNames: [],
      needsAuth: true,
    });

    await handleMcpCommand(ctx, ['enable', 'oauth_server']);

    expect(ctx.showInfo).toHaveBeenCalledWith(
      'MCP: Enabled "oauth_server" — needs authentication \u2192 run /mcp to authenticate',
    );
  });

  it('disables and enables all servers via /mcp disable|enable all', async () => {
    const { ctx, mcpManager, setAllDisabled } = createContext();

    await handleMcpCommand(ctx, ['disable', 'all']);
    expect(setAllDisabled).toHaveBeenCalledWith(true, { global: false });
    expect(ctx.showInfo).toHaveBeenCalledWith('MCP: All servers disabled. Re-enable with /mcp enable all.');

    await handleMcpCommand(ctx, ['enable', 'all']);
    expect(setAllDisabled).toHaveBeenCalledWith(false, { global: false });
    expect(mcpManager.getServerStatuses).toHaveBeenCalled();
    expect(ctx.showInfo).toHaveBeenCalledWith('MCP: All servers enabled. 1 server(s) connected, 2 tool(s).');
  });

  it('disables and enables all servers globally via /mcp disable|enable all --global', async () => {
    const { ctx, setAllDisabled } = createContext();

    await handleMcpCommand(ctx, ['disable', 'all', '--global']);
    expect(setAllDisabled).toHaveBeenCalledWith(true, { global: true });
    expect(ctx.showInfo).toHaveBeenCalledWith(
      'MCP: All servers disabled globally (all projects). Re-enable with /mcp enable all --global.',
    );

    await handleMcpCommand(ctx, ['enable', 'all', '--global']);
    expect(setAllDisabled).toHaveBeenCalledWith(false, { global: true });
    expect(ctx.showInfo).toHaveBeenCalledWith(
      'MCP: All servers enabled globally (all projects). 1 server(s) connected, 2 tool(s).',
    );
  });

  it('lists servers still disabled in the other scope after enable all', async () => {
    const { ctx, mcpManager } = createContext();
    mcpManager.getServerStatuses.mockReturnValue([
      {
        name: 'filesystem',
        connected: false,
        connecting: false,
        transport: 'stdio',
        toolCount: 0,
        toolNames: [],
        disabled: true,
        disabledScope: 'global',
      },
    ]);

    await handleMcpCommand(ctx, ['enable', 'all']);

    expect(ctx.showInfo).toHaveBeenCalledWith(
      'MCP: Still disabled globally: filesystem — re-enable with /mcp enable <name|all> --global.',
    );
  });

  it('points project-scoped enable all at the global kill switch when it is active', async () => {
    const { ctx, mcpManager } = createContext();
    mcpManager.isAllDisabledGlobally.mockReturnValue(true);
    mcpManager.getServerStatuses.mockReturnValue([
      {
        name: 'filesystem',
        connected: false,
        connecting: false,
        transport: 'stdio',
        toolCount: 0,
        toolNames: [],
        disabled: true,
        disabledScope: 'global',
      },
    ]);

    await handleMcpCommand(ctx, ['enable', 'all']);

    expect(ctx.showInfo).toHaveBeenCalledWith(
      'MCP: All MCP is still disabled globally — re-enable with /mcp enable all --global.',
    );
  });

  it('surfaces the global kill switch in /mcp status', async () => {
    const { ctx, mcpManager } = createContext();
    mcpManager.isAllDisabledGlobally.mockReturnValue(true);

    await handleMcpCommand(ctx, ['status']);

    expect(ctx.showInfo).toHaveBeenCalledWith(
      expect.stringContaining('All MCP is disabled globally — re-enable via /mcp enable all --global'),
    );
  });
});
