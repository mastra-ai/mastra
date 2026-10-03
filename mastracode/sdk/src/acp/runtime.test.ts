import { afterEach, describe, expect, it, vi } from 'vitest';
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
    threadScheduler: { stop: vi.fn() },
    stopNotificationDispatch: vi.fn().mockResolvedValue(undefined),
    signalsPubSub: pubsub,
    storage: { close },
    stopWorkers,
  };
}

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

describe('ACP runtime factory', () => {
  afterEach(() => vi.useRealTimers());

  it('rejects legacy SSE servers before starting a runtime', async () => {
    vi.mocked(createMastraCode).mockClear();
    await expect(
      createAcpSession({
        cwd: '/project',
        mcpServers: [{ name: 'legacy', type: 'sse', url: 'https://example.com/sse', headers: [] }],
      }),
    ).rejects.toMatchObject({ code: -32602, message: expect.stringContaining('SSE') });
    expect(createMastraCode).not.toHaveBeenCalled();
  });

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
    expect(boot.session.abort).toHaveBeenCalledTimes(1);
    expect(boot.session.thread.detachFromCurrent).toHaveBeenCalledTimes(1);
    expect(boot.session.thread.clearAndReleaseLock).toHaveBeenCalledTimes(1);
    expect(boot.mcpManager.disconnect).toHaveBeenCalledTimes(1);
    expect(boot.stopWorkers).toHaveBeenCalledTimes(1);
    expect(boot.stopPluginSignalProviders).toHaveBeenCalledTimes(1);
    expect(boot.githubSignals.stopAllPolling).toHaveBeenCalledTimes(1);
    expect(boot.threadScheduler.stop).toHaveBeenCalledTimes(1);
    expect(boot.stopNotificationDispatch).toHaveBeenCalledTimes(1);
    expect(boot.signalsPubSub.close).toHaveBeenCalledTimes(1);
    expect(boot.storage.close).toHaveBeenCalledTimes(1);
  });

  it('stops producers before dispatch, drains dispatch before consumers, and shares concurrent cleanup', async () => {
    vi.useFakeTimers();
    const boot = bootResult();
    const dispatch = deferred();
    boot.stopNotificationDispatch.mockImplementationOnce(() => {
      expect(boot.stopPluginSignalProviders).toHaveBeenCalledOnce();
      expect(boot.githubSignals.stopAllPolling).toHaveBeenCalledOnce();
      expect(boot.threadScheduler.stop).toHaveBeenCalledOnce();
      return dispatch.promise;
    });
    vi.mocked(createMastraCode).mockResolvedValueOnce(boot as never);
    const runtime = await createAcpSession({ cwd: '/project', mcpServers: [] });
    const cleanup = runtime.cleanup?.();
    expect(runtime.cleanup?.()).toBe(cleanup);
    await vi.advanceTimersByTimeAsync(0);
    expect(boot.stopNotificationDispatch).toHaveBeenCalledOnce();
    expect(boot.stopWorkers).not.toHaveBeenCalled();
    expect(boot.controller.stopIntervals).not.toHaveBeenCalled();
    expect(boot.mcpManager.disconnect).not.toHaveBeenCalled();
    expect(boot.signalsPubSub.close).not.toHaveBeenCalled();
    expect(boot.storage.close).not.toHaveBeenCalled();
    dispatch.resolve();
    await cleanup;
    expect(boot.stopNotificationDispatch).toHaveBeenCalledOnce();
    expect(boot.stopWorkers).toHaveBeenCalledOnce();
    expect(boot.signalsPubSub.close).toHaveBeenCalledOnce();
    expect(boot.storage.close).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(['workers', 'MCP', 'intervals', 'thread lock'] as const)(
    'keeps PubSub and storage open until %s settle',
    async consumer => {
      vi.useFakeTimers();
      const boot = bootResult();
      const gate = deferred();
      const stop = {
        workers: boot.stopWorkers,
        MCP: boot.mcpManager.disconnect,
        intervals: boot.controller.stopIntervals,
        'thread lock': boot.session.thread.clearAndReleaseLock,
      }[consumer];
      stop.mockImplementationOnce(() => gate.promise);
      vi.mocked(createMastraCode).mockResolvedValueOnce(boot as never);
      const runtime = await createAcpSession({ cwd: '/project', mcpServers: [] });
      const cleanup = runtime.cleanup?.();
      await vi.advanceTimersByTimeAsync(0);
      expect(stop).toHaveBeenCalledOnce();
      expect(boot.signalsPubSub.close).not.toHaveBeenCalled();
      expect(boot.storage.close).not.toHaveBeenCalled();
      gate.resolve();
      await cleanup;
      expect(boot.signalsPubSub.close).toHaveBeenCalledOnce();
      expect(boot.storage.close).toHaveBeenCalledOnce();
    },
  );

  it('waits for optional PubSub close before closing storage', async () => {
    vi.useFakeTimers();
    const boot = bootResult();
    const gate = deferred();
    boot.signalsPubSub.close.mockImplementationOnce(function (this: unknown) {
      expect(this).toBe(boot.signalsPubSub);
      return gate.promise;
    });
    vi.mocked(createMastraCode).mockResolvedValueOnce(boot as never);
    const runtime = await createAcpSession({ cwd: '/project', mcpServers: [] });
    const cleanup = runtime.cleanup?.();
    await vi.advanceTimersByTimeAsync(0);
    expect(boot.signalsPubSub.close).toHaveBeenCalledOnce();
    expect(boot.storage.close).not.toHaveBeenCalled();
    gate.resolve();
    await cleanup;
    expect(boot.storage.close).toHaveBeenCalledOnce();
  });

  it.each(['resolve', 'reject'] as const)(
    'continues teardown after two seconds even if dispatch later %ss',
    async late => {
      vi.useFakeTimers();
      const boot = bootResult();
      const dispatch = deferred();
      boot.stopNotificationDispatch.mockReturnValueOnce(dispatch.promise);
      vi.mocked(createMastraCode).mockResolvedValueOnce(boot as never);
      const runtime = await createAcpSession({ cwd: '/project', mcpServers: [] });
      const cleanup = runtime.cleanup?.();
      await vi.advanceTimersByTimeAsync(1_999);
      expect(boot.stopWorkers).not.toHaveBeenCalled();
      expect(boot.storage.close).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      await cleanup;
      expect(boot.stopWorkers).toHaveBeenCalledOnce();
      expect(boot.mcpManager.disconnect).toHaveBeenCalledOnce();
      expect(boot.signalsPubSub.close).toHaveBeenCalledOnce();
      expect(boot.storage.close).toHaveBeenCalledOnce();
      expect(vi.getTimerCount()).toBe(0);
      if (late === 'resolve') {
        dispatch.resolve();
        await dispatch.promise;
      } else {
        dispatch.reject(new Error('late dispatch failure'));
        await vi.advanceTimersByTimeAsync(0);
      }
      await runtime.cleanup?.();
      expect(boot.storage.close).toHaveBeenCalledOnce();
    },
  );

  it.each(['reject', 'throw'] as const)('continues every cleanup phase when teardown hooks %s', async failure => {
    vi.useFakeTimers();
    const boot = bootResult();
    const fail = () => {
      if (failure === 'throw') throw new Error('cleanup hook failed');
      return Promise.reject(new Error('cleanup hook failed'));
    };
    boot.session.abort.mockImplementationOnce(fail);
    boot.session.thread.detachFromCurrent.mockImplementationOnce(fail);
    boot.stopPluginSignalProviders.mockImplementationOnce(fail);
    boot.stopNotificationDispatch.mockImplementationOnce(fail);
    boot.stopWorkers.mockImplementationOnce(fail);
    boot.signalsPubSub.close.mockImplementationOnce(fail);
    vi.mocked(createMastraCode).mockResolvedValueOnce(boot as never);
    const runtime = await createAcpSession({ cwd: '/project', mcpServers: [] });
    await runtime.cleanup?.();
    expect(boot.githubSignals.stopAllPolling).toHaveBeenCalledOnce();
    expect(boot.threadScheduler.stop).toHaveBeenCalledOnce();
    expect(boot.stopNotificationDispatch).toHaveBeenCalledOnce();
    expect(boot.mcpManager.disconnect).toHaveBeenCalledOnce();
    expect(boot.controller.stopIntervals).toHaveBeenCalledOnce();
    expect(boot.signalsPubSub.close).toHaveBeenCalledOnce();
    expect(boot.storage.close).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('cleans up when the optional event PubSub is absent', async () => {
    const boot = { ...bootResult(), signalsPubSub: undefined };
    vi.mocked(createMastraCode).mockResolvedValueOnce(boot as never);
    const runtime = await createAcpSession({ cwd: '/project', mcpServers: [] });
    await runtime.cleanup?.();
    expect(boot.stopNotificationDispatch).toHaveBeenCalledOnce();
    expect(boot.storage.close).toHaveBeenCalledOnce();
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

  it('preserves a thrown MCP initialization error while draining dispatch before storage', async () => {
    const boot = bootResult();
    const startupError = new Error('MCP startup failed');
    boot.mcpManager.initInBackground.mockRejectedValueOnce(startupError);
    boot.session.thread.detachFromCurrent.mockImplementationOnce(() => {
      throw new Error('thread unsubscribe failed');
    });
    boot.storage.close.mockImplementationOnce(async () => {
      expect(boot.threadScheduler.stop).toHaveBeenCalledOnce();
      expect(boot.stopNotificationDispatch).toHaveBeenCalledOnce();
      expect(boot.signalsPubSub.close).toHaveBeenCalledOnce();
    });
    vi.mocked(createMastraCode).mockResolvedValueOnce(boot as never);
    await expect(createAcpSession({ cwd: '/project', mcpServers: [] })).rejects.toBe(startupError);
    expect(boot.stopWorkers).toHaveBeenCalledOnce();
    expect(boot.storage.close).toHaveBeenCalledOnce();
  });

  it('preserves the MCP initialization error when storage cleanup fails', async () => {
    const boot = bootResult();
    const cleanupError = new Error('storage close failed');
    boot.mcpManager.initInBackground.mockResolvedValueOnce({
      failed: [{ name: 'broken', error: 'command not found' }],
    } as never);
    boot.storage.close.mockRejectedValueOnce(cleanupError);
    vi.mocked(createMastraCode).mockResolvedValueOnce(boot as never);
    await expect(
      createAcpSession({
        cwd: '/project',
        mcpServers: [{ name: 'broken', command: '/missing-command', args: [], env: [] }],
      }),
    ).rejects.toMatchObject({
      code: -32603,
      message: expect.stringContaining('broken: command not found'),
      cause: expect.objectContaining({ errors: [cleanupError] }),
    });
  });
});
