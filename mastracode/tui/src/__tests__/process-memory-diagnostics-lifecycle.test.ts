import { describe, expect, it, vi } from 'vitest';

import {
  createShutdownCoordinator,
  startTuiProcessMemoryDiagnostics,
} from '../process-memory-diagnostics-lifecycle.js';

function createDiagnosticsSetup(
  options: { enabled?: boolean; error?: string | null; startState?: 'active' | 'error' } = {},
) {
  const start = vi.fn(async () => ({
    state: options.startState ?? 'active',
    error: options.startState === 'error' ? 'inspector unavailable' : null,
  }));
  const diagnostics = { start };
  return {
    diagnostics,
    setup: {
      diagnostics,
      enabled: options.enabled ?? true,
      error: options.error ?? null,
    },
  };
}

describe('startTuiProcessMemoryDiagnostics', () => {
  it('does not start diagnostics when the environment does not enable them', async () => {
    const { diagnostics, setup } = createDiagnosticsSetup({ enabled: false });
    const createSetup = vi.fn(() => setup as never);
    const warn = vi.fn();

    const result = await startTuiProcessMemoryDiagnostics({}, warn, createSetup);

    expect(result).toBe(diagnostics);
    expect(createSetup).toHaveBeenCalledOnce();
    expect(diagnostics.start).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });

  it('starts enabled diagnostics before returning the process handle', async () => {
    const { diagnostics, setup } = createDiagnosticsSetup();
    const warn = vi.fn();

    const result = await startTuiProcessMemoryDiagnostics({ MASTRACODE_PROFILE: '1' }, warn, () => setup as never);

    expect(result).toBe(diagnostics);
    expect(diagnostics.start).toHaveBeenCalledOnce();
    expect(warn).not.toHaveBeenCalled();
  });

  it('reports configuration and inspector failures without failing TUI startup', async () => {
    const invalid = createDiagnosticsSetup({ error: 'sample interval is too low' });
    const inspector = createDiagnosticsSetup({ startState: 'error' });
    const warn = vi.fn();

    await expect(startTuiProcessMemoryDiagnostics({}, warn, () => invalid.setup as never)).resolves.toBe(
      invalid.diagnostics,
    );
    await expect(startTuiProcessMemoryDiagnostics({}, warn, () => inspector.setup as never)).resolves.toBe(
      inspector.diagnostics,
    );

    expect(warn).toHaveBeenNthCalledWith(1, 'Process memory diagnostics were not started: sample interval is too low');
    expect(warn).toHaveBeenNthCalledWith(2, 'Process memory diagnostics were not started: inspector unavailable');
  });
});

describe('createShutdownCoordinator', () => {
  it('shares one cleanup and exit across concurrent fatal and signal shutdowns', async () => {
    let releaseCleanup!: () => void;
    const cleanup = vi.fn(
      () =>
        new Promise<void>(resolve => {
          releaseCleanup = resolve;
        }),
    );
    const exit = vi.fn((_exitCode: number): never => {
      throw new Error('exit');
    });
    const shutdown = createShutdownCoordinator(cleanup, exit);

    const fatal = shutdown(1);
    const signal = shutdown(0);

    expect(fatal).toBe(signal);
    expect(cleanup).toHaveBeenCalledOnce();
    expect(exit).not.toHaveBeenCalled();

    releaseCleanup();
    await expect(fatal).rejects.toThrow('exit');
    expect(exit).toHaveBeenCalledOnce();
    expect(exit).toHaveBeenCalledWith(1);
  });

  it('exits after the timeout when cleanup does not settle', async () => {
    vi.useFakeTimers();
    const cleanup = vi.fn(() => new Promise<void>(() => {}));
    const exit = vi.fn((_exitCode: number): never => {
      throw new Error('exit');
    });
    const shutdown = createShutdownCoordinator(cleanup, exit, 100);

    const stopping = expect(shutdown(1)).rejects.toThrow('exit');
    await vi.advanceTimersByTimeAsync(100);
    await stopping;

    expect(cleanup).toHaveBeenCalledOnce();
    expect(exit).toHaveBeenCalledWith(1);
  });

  it('exits even when cleanup rejects', async () => {
    const cleanupError = new Error('cleanup failed');
    const cleanup = vi.fn().mockRejectedValue(cleanupError);
    const exit = vi.fn((_exitCode: number): never => {
      throw new Error('exit');
    });
    const shutdown = createShutdownCoordinator(cleanup, exit);

    await expect(shutdown(1)).rejects.toThrow('exit');

    expect(cleanup).toHaveBeenCalledOnce();
    expect(exit).toHaveBeenCalledOnce();
    expect(exit).toHaveBeenCalledWith(1);
  });
});
