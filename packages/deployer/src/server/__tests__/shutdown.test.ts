import type { Mastra } from '@mastra/core/mastra';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createNodeServer } from '../index';

const { serveMock } = vi.hoisted(() => ({
  serveMock: vi.fn(),
}));

vi.mock('@hono/node-server', () => ({
  serve: serveMock,
}));

vi.mock('@hono/node-server/serve-static', () => ({
  serveStatic: vi.fn(() => async (ctx: any) => ctx.notFound()),
}));

vi.mock('@hono/swagger-ui', () => ({
  swaggerUI: vi.fn(() => vi.fn()),
}));

vi.mock('@mastra/server/a2a/store', () => ({
  InMemoryTaskStore: vi.fn(),
}));

vi.mock('../handlers/mcp', () => ({
  MCP_ROUTES: [],
  getMcpServerMessageHandler: vi.fn(),
  getMcpServerSseHandler: vi.fn(),
}));

vi.mock('../handlers/auth', () => ({
  authenticationMiddleware: vi.fn((c, next) => next()),
  authorizationMiddleware: vi.fn((c, next) => next()),
}));

vi.mock('../handlers/error', () => ({
  errorHandler: vi.fn(),
}));

vi.mock('../handlers/health', () => ({
  healthHandler: vi.fn(c => c.json({ status: 'ok' })),
}));

const { closeRefreshStreamsMock } = vi.hoisted(() => ({
  closeRefreshStreamsMock: vi.fn(),
}));

vi.mock('../handlers/client', () => ({
  closeRefreshStreams: closeRefreshStreamsMock,
  handleClientsRefresh: vi.fn(ctx => ctx.json({ refresh: true })),
  handleTriggerClientsRefresh: vi.fn(ctx => ctx.json({ triggered: true })),
  isHotReloadDisabled: vi.fn(() => false),
}));

vi.mock('../handlers/restart-active-runs', () => ({
  restartAllActiveWorkflowRunsHandler: vi.fn(ctx => ctx.json({ restarted: true })),
}));

vi.mock('../welcome', () => ({
  welcomeHtml: vi.fn(() => '<html><body>Welcome to Mastra</body></html>'),
}));

async function flushMicrotasks() {
  for (let i = 0; i < 10; i++) {
    await Promise.resolve();
  }
}

describe('createNodeServer graceful shutdown', () => {
  let mockMastra: Mastra;
  let logger: {
    info: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    debug: ReturnType<typeof vi.fn>;
  };
  let fakeServer: {
    close: ReturnType<typeof vi.fn>;
    closeIdleConnections: ReturnType<typeof vi.fn>;
    closeAllConnections: ReturnType<typeof vi.fn>;
    on: ReturnType<typeof vi.fn>;
  };
  let closeCallbacks: Array<() => void>;
  let shutdownMock: ReturnType<typeof vi.fn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let priorSigintListeners: NodeJS.SignalsListener[];
  let priorSigtermListeners: NodeJS.SignalsListener[];

  beforeEach(() => {
    vi.clearAllMocks();

    priorSigintListeners = process.listeners('SIGINT');
    priorSigtermListeners = process.listeners('SIGTERM');

    logger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    };

    closeCallbacks = [];
    fakeServer = {
      close: vi.fn((cb?: () => void) => {
        if (cb) closeCallbacks.push(cb);
      }),
      closeIdleConnections: vi.fn(),
      closeAllConnections: vi.fn(),
      on: vi.fn(),
    };

    serveMock.mockImplementation((_options: any, callback?: () => void) => {
      callback?.();
      return fakeServer;
    });

    shutdownMock = vi.fn(() => Promise.resolve());

    mockMastra = {
      getServer: vi.fn(() => ({})),
      getServerMiddleware: vi.fn(() => []),
      getLogger: vi.fn(() => logger),
      startWorkers: vi.fn(),
      startEventEngine: vi.fn(),
      listAgents: vi.fn(() => []),
      setMastraServer: vi.fn(),
      shutdown: shutdownMock,
    } as unknown as Mastra;

    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
  });

  afterEach(() => {
    vi.useRealTimers();
    exitSpy.mockRestore();
    for (const listener of process.listeners('SIGINT')) {
      if (!priorSigintListeners.includes(listener)) {
        process.removeListener('SIGINT', listener);
      }
    }
    for (const listener of process.listeners('SIGTERM')) {
      if (!priorSigtermListeners.includes(listener)) {
        process.removeListener('SIGTERM', listener);
      }
    }
  });

  it('drains in-flight HTTP requests before calling mastra.shutdown()', async () => {
    await createNodeServer(mockMastra, { tools: {} });

    process.emit('SIGTERM', 'SIGTERM');
    await flushMicrotasks();

    // close() called with a callback; hot-reload SSE streams and idle
    // keep-alive sockets closed eagerly.
    expect(fakeServer.close).toHaveBeenCalledOnce();
    expect(closeRefreshStreamsMock).toHaveBeenCalledOnce();
    expect(fakeServer.closeIdleConnections).toHaveBeenCalledOnce();
    // Drain has not completed: core shutdown must not have started.
    expect(shutdownMock).not.toHaveBeenCalled();
    expect(exitSpy).not.toHaveBeenCalled();

    // In-flight requests finish -> close callback fires.
    closeCallbacks.forEach(cb => cb());
    await vi.waitFor(() => expect(exitSpy).toHaveBeenCalledWith(0));

    expect(shutdownMock).toHaveBeenCalledOnce();
    expect(fakeServer.closeAllConnections).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('sweeps idle connections periodically so keep-alive sockets that go idle mid-drain do not stall the drain', async () => {
    vi.useFakeTimers();
    await createNodeServer(mockMastra, { tools: {} });

    process.emit('SIGTERM', 'SIGTERM');
    await flushMicrotasks();

    // Initial eager sweep.
    expect(fakeServer.closeIdleConnections).toHaveBeenCalledOnce();

    // A keep-alive socket whose in-flight response finishes after the initial
    // sweep only becomes idle later — the periodic sweep must pick it up
    // instead of waiting for the full drain timeout.
    await vi.advanceTimersByTimeAsync(300);
    expect(fakeServer.closeIdleConnections.mock.calls.length).toBeGreaterThan(1);

    // Sweep closed the last socket -> close callback fires -> clean exit
    // without hitting the drain timeout.
    closeCallbacks.forEach(cb => cb());
    await vi.waitFor(() => expect(exitSpy).toHaveBeenCalledWith(0));
    expect(fakeServer.closeAllConnections).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('closes remaining connections and still runs mastra.shutdown() when the drain hangs past the default 5s', async () => {
    vi.useFakeTimers();
    await createNodeServer(mockMastra, { tools: {} });

    process.emit('SIGTERM', 'SIGTERM');
    await flushMicrotasks();

    await vi.advanceTimersByTimeAsync(4999);
    expect(fakeServer.closeAllConnections).not.toHaveBeenCalled();
    expect(exitSpy).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    await flushMicrotasks();

    expect(logger.warn).toHaveBeenCalledWith('Mastra server drain timed out; closing remaining HTTP connections', {
      timeoutMs: 5000,
    });
    expect(fakeServer.closeAllConnections).toHaveBeenCalledOnce();
    // Core teardown must still run even though the drain timed out (e.g. so
    // DuckDB releases its file lock on dev hot reloads).
    expect(shutdownMock).toHaveBeenCalledOnce();
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('respects a custom server.drainTimeout for the drain window', async () => {
    vi.useFakeTimers();
    (mockMastra.getServer as ReturnType<typeof vi.fn>).mockReturnValue({ drainTimeout: 60_000 });
    await createNodeServer(mockMastra, { tools: {} });

    process.emit('SIGTERM', 'SIGTERM');
    await flushMicrotasks();

    // Default deadline passes without force-close.
    await vi.advanceTimersByTimeAsync(5000);
    expect(fakeServer.closeAllConnections).not.toHaveBeenCalled();
    expect(exitSpy).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(55_000);
    await flushMicrotasks();

    expect(logger.warn).toHaveBeenCalledWith('Mastra server drain timed out; closing remaining HTTP connections', {
      timeoutMs: 60_000,
    });
    expect(shutdownMock).toHaveBeenCalledOnce();
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('bounds a hanging mastra.shutdown() separately from the drain window', async () => {
    vi.useFakeTimers();
    shutdownMock.mockImplementation(() => new Promise<void>(() => {}));
    await createNodeServer(mockMastra, { tools: {} });

    process.emit('SIGTERM', 'SIGTERM');
    await flushMicrotasks();
    // Drain completes immediately.
    closeCallbacks.forEach(cb => cb());
    await flushMicrotasks();
    expect(shutdownMock).toHaveBeenCalledOnce();
    expect(exitSpy).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(5000);
    await flushMicrotasks();

    expect(logger.warn).toHaveBeenCalledWith('Mastra shutdown timed out; forcing exit', { timeoutMs: 5000 });
    expect(fakeServer.closeAllConnections).not.toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('waits for mastra.shutdown() when it completes within the core shutdown deadline', async () => {
    let resolveShutdown!: () => void;
    shutdownMock.mockImplementation(
      () =>
        new Promise<void>(resolve => {
          resolveShutdown = resolve;
        }),
    );
    await createNodeServer(mockMastra, { tools: {} });

    process.emit('SIGTERM', 'SIGTERM');
    await flushMicrotasks();
    closeCallbacks.forEach(cb => cb());
    await vi.waitFor(() => expect(shutdownMock).toHaveBeenCalledOnce());

    expect(exitSpy).not.toHaveBeenCalled();
    resolveShutdown();
    await vi.waitFor(() => expect(exitSpy).toHaveBeenCalledWith(0));
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('force-exits when any second shutdown signal arrives', async () => {
    await createNodeServer(mockMastra, { tools: {} });

    process.emit('SIGINT', 'SIGINT');
    await flushMicrotasks();
    process.emit('SIGTERM', 'SIGTERM');
    await flushMicrotasks();

    expect(logger.info).toHaveBeenCalledWith('Shutting down Mastra server', { signal: 'SIGINT' });
    expect(logger.info).not.toHaveBeenCalledWith('Shutting down Mastra server', { signal: 'SIGTERM' });
    expect(fakeServer.close).toHaveBeenCalledOnce();
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('skips waiting for in-flight requests when server.drainTimeout is zero', async () => {
    vi.useFakeTimers();
    (mockMastra.getServer as ReturnType<typeof vi.fn>).mockReturnValue({ drainTimeout: 0 });
    await createNodeServer(mockMastra, { tools: {} });

    process.emit('SIGTERM', 'SIGTERM');
    await vi.advanceTimersByTimeAsync(0);
    await flushMicrotasks();

    expect(fakeServer.closeAllConnections).toHaveBeenCalledOnce();
    expect(shutdownMock).toHaveBeenCalledOnce();
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY, 2_147_483_648])(
    'rejects an invalid server.drainTimeout of %s',
    async drainTimeout => {
      (mockMastra.getServer as ReturnType<typeof vi.fn>).mockReturnValue({ drainTimeout });

      await expect(createNodeServer(mockMastra, { tools: {} })).rejects.toThrow(
        'server.drainTimeout must be a finite number between 0 and 2147483647 milliseconds',
      );
      expect(serveMock).not.toHaveBeenCalled();
    },
  );

  it('still runs mastra.shutdown() when starting the HTTP drain throws', async () => {
    const error = new Error('server already stopped');
    fakeServer.close.mockImplementation(() => {
      throw error;
    });
    await createNodeServer(mockMastra, { tools: {} });

    process.emit('SIGTERM', 'SIGTERM');
    await vi.waitFor(() => expect(exitSpy).toHaveBeenCalledWith(0));

    expect(logger.error).toHaveBeenCalledWith('Error while draining Mastra server', { error });
    expect(shutdownMock).toHaveBeenCalledOnce();
  });

  it('still drains HTTP for older cores without mastra.shutdown()', async () => {
    delete (mockMastra as any).shutdown;
    await createNodeServer(mockMastra, { tools: {} });

    process.emit('SIGTERM', 'SIGTERM');
    await flushMicrotasks();
    expect(exitSpy).not.toHaveBeenCalled();

    closeCallbacks.forEach(cb => cb());
    await vi.waitFor(() => expect(exitSpy).toHaveBeenCalledWith(0));
  });

  it('does not register signal handlers when server.handleShutdownSignals is false', async () => {
    (mockMastra.getServer as ReturnType<typeof vi.fn>).mockReturnValue({ handleShutdownSignals: false });
    const sigintBefore = process.listenerCount('SIGINT');
    const sigtermBefore = process.listenerCount('SIGTERM');

    await createNodeServer(mockMastra, { tools: {} });

    expect(process.listenerCount('SIGINT')).toBe(sigintBefore);
    expect(process.listenerCount('SIGTERM')).toBe(sigtermBefore);
  });
});
