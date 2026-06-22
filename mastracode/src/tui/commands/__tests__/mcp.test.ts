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
  const statuses = [
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
  };
  const ctx = {
    state: { ui: { hideOverlay: vi.fn(), requestRender: vi.fn() } },
    mcpManager,
    showInfo: vi.fn(),
    showError: vi.fn(),
  } as unknown as SlashCommandContext;

  return { ctx, mcpManager, statuses, skipped, reload, reconnectServer, getServerLogs };
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
      getServerLogs: (name: string) => string[];
    };
    expect(options.getStatuses()).toEqual({ statuses, skipped });
    await expect(options.onReloadAll()).resolves.toEqual({ statuses, skipped });
    await expect(options.onReconnectServer('filesystem')).resolves.toEqual({ ok: true });
    expect(options.getServerLogs('filesystem')).toEqual(['server log']);
    expect(reload).toHaveBeenCalledOnce();
    expect(reconnectServer).toHaveBeenCalledWith('filesystem');
    expect(getServerLogs).toHaveBeenCalledWith('filesystem');
  });
});
