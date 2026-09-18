import { describe, expect, it, vi } from 'vitest';
import { createMastraCode } from '../index.js';
import { loadSettings, resolveDefaultThinkingLevel } from '../onboarding/settings.js';
import { createAcpSession } from './runtime.js';

vi.mock('../onboarding/settings.js', () => ({
  loadSettings: vi.fn(() => ({})),
  resolveDefaultThinkingLevel: vi.fn(() => ({ level: 'medium' })),
}));

vi.mock('../index.js', () => ({ createMastraCode: vi.fn() }));

function bootResult() {
  const session = {
    abort: vi.fn(),
    mode: { get: vi.fn(() => 'build') },
    state: { get: vi.fn(() => ({})) },
    thread: { detachFromCurrent: vi.fn(), clearAndReleaseLock: vi.fn().mockResolvedValue(undefined) },
  };
  const stopWorkers = vi.fn().mockResolvedValue(undefined);
  const close = vi.fn().mockResolvedValue(undefined);
  const pubsub = {
    close: vi.fn(function (this: unknown) {
      expect(this).toBe(pubsub);
    }),
  };
  return {
    session,
    controller: { listModes: () => [{ id: 'build' }], getMastra: () => ({ stopWorkers }), stopIntervals: vi.fn() },
    mcpManager: {
      initInBackground: vi.fn().mockResolvedValue({ failed: [] }),
      disconnect: vi.fn().mockResolvedValue(undefined),
    },
    githubSignals: { stopAllPolling: vi.fn() },
    stopPluginSignalProviders: vi.fn(),
    signalsPubSub: pubsub,
    storage: { close },
    stopWorkers,
  };
}

describe('ACP runtime factory', () => {
  it('reads defaults once while observing live mode and session reasoning changes', async () => {
    vi.mocked(loadSettings).mockClear();
    vi.mocked(resolveDefaultThinkingLevel).mockClear();
    const boot = bootResult();
    vi.mocked(createMastraCode).mockResolvedValueOnce(boot as never);
    const runtime = await createAcpSession({ cwd: '/project', mcpServers: [] });
    expect(runtime.getThinkingLevel?.()).toBe('medium');
    boot.session.mode.get.mockReturnValue('plan');
    expect(runtime.getThinkingLevel?.()).toBe('medium');
    expect(loadSettings).toHaveBeenCalledOnce();
    expect(resolveDefaultThinkingLevel).toHaveBeenLastCalledWith({}, 'plan');
    boot.session.state.get.mockReturnValue({ thinkingLevel: 'high' });
    expect(runtime.getThinkingLevel?.()).toBe('high');
    expect(resolveDefaultThinkingLevel).toHaveBeenCalledTimes(2);
    await runtime.cleanup?.();
  });

  it('preserves co-author configuration when booting a session', async () => {
    const boot = bootResult();
    vi.mocked(createMastraCode).mockResolvedValueOnce(boot as never);
    const coAuthor = { name: 'ACP Test', email: 'acp@example.com' };
    await createAcpSession({ cwd: '/project', mcpServers: [] }, { coAuthor });
    expect(createMastraCode).toHaveBeenLastCalledWith(expect.objectContaining({ coAuthor }));
  });
  it('boots in the requested cwd with client MCP servers and uses the wired session', async () => {
    const boot = bootResult();
    vi.mocked(createMastraCode).mockResolvedValueOnce(boot as never);
    const runtime = await createAcpSession({
      cwd: '/project/subdirectory',
      mcpServers: [
        { name: 'local', command: '/mcp', args: ['serve'], env: [{ name: 'TEST_VALUE', value: 'example' }] },
        {
          name: 'remote',
          type: 'http',
          url: 'https://example.com/mcp',
          headers: [{ name: 'X-Test', value: 'example' }],
        },
      ],
    });
    expect(createMastraCode).toHaveBeenCalledWith(
      expect.objectContaining({
        disableEnvFile: true,
        cwd: '/project/subdirectory',
        initialState: {
          projectPath: '/project/subdirectory',
          yolo: false,
          permissionRules: { categories: {}, tools: { ask_user: 'deny' } },
        },
        disabledTools: ['ask_user'],
        mcpServers: {
          local: { command: '/mcp', args: ['serve'], env: { TEST_VALUE: 'example' }, cwd: '/project/subdirectory' },
          remote: { url: 'https://example.com/mcp', headers: { 'X-Test': 'example' } },
        },
      }),
    );
    expect(boot.mcpManager.initInBackground).toHaveBeenCalledTimes(1);
    expect(runtime.session).toBe(boot.session);
    expect(runtime.modes).toEqual([{ id: 'build' }]);
    await runtime.cleanup?.();
    await runtime.cleanup?.();
    expect(boot.session.thread.clearAndReleaseLock).toHaveBeenCalledTimes(1);
    expect(boot.mcpManager.disconnect).toHaveBeenCalledTimes(1);
    expect(boot.stopWorkers).toHaveBeenCalledTimes(1);
    expect(boot.stopPluginSignalProviders).toHaveBeenCalledTimes(1);
    expect(boot.githubSignals.stopAllPolling).toHaveBeenCalledTimes(1);
    expect(boot.signalsPubSub.close).toHaveBeenCalledTimes(1);
    expect(boot.storage.close).toHaveBeenCalledTimes(1);
  });

  it('reports client MCP connection failures and cleans up the failed runtime', async () => {
    const boot = bootResult();
    boot.mcpManager.initInBackground.mockResolvedValueOnce({
      failed: [{ name: 'broken', error: 'command not found' }],
    } as never);
    vi.mocked(createMastraCode).mockResolvedValueOnce(boot as never);
    await expect(
      createAcpSession({
        cwd: '/project',
        mcpServers: [{ name: 'broken', command: '/missing-command', args: [], env: [] }],
      }),
    ).rejects.toMatchObject({ code: -32603, message: expect.stringContaining('broken: command not found') });
    expect(boot.mcpManager.disconnect).toHaveBeenCalledTimes(1);
    expect(boot.storage.close).toHaveBeenCalledTimes(1);
  });

  it('rejects duplicate client MCP server names instead of overwriting one', async () => {
    await expect(
      createAcpSession({
        cwd: '/project',
        mcpServers: [
          { name: 'duplicate', command: '/one', args: [], env: [] },
          { name: 'duplicate', command: '/two', args: [], env: [] },
        ],
      }),
    ).rejects.toMatchObject({ code: -32602 });
  });
});
