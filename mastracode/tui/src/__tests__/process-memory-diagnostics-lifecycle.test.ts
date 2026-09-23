import { execFile } from 'node:child_process';

import { describe, expect, it, vi } from 'vitest';

import {
  createOneShotFatalErrorHandler,
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

describe('createOneShotFatalErrorHandler', () => {
  it('ignores fatal errors raised while reporting the first fatal error', () => {
    const firstError = new Error('initial failure');
    const reportingError = Object.assign(new Error('write EIO'), { code: 'EIO' });
    const handled: unknown[] = [];
    let handleFatalError!: (error: unknown) => void;

    handleFatalError = createOneShotFatalErrorHandler(error => {
      handled.push(error);
      handleFatalError(reportingError);
    });

    handleFatalError(firstError);
    handleFatalError(new Error('later failure'));

    expect(handled).toEqual([firstError]);
  });

  it('prevents an asynchronous stderr error from recursively starving shutdown', async () => {
    // Isolate the real process-level error path so the unhandled stream error cannot escape into Vitest.
    const lifecycleModuleUrl = new URL('../process-memory-diagnostics-lifecycle.ts', import.meta.url).href;
    const script = `
      import { EventEmitter } from 'node:events';
      import { createOneShotFatalErrorHandler } from ${JSON.stringify(lifecycleModuleUrl)};

      const stderr = new EventEmitter();
      let reports = 0;

      stderr.write = () => {
        process.nextTick(() => {
          const error = Object.assign(new Error('write EIO'), { code: 'EIO' });
          stderr.emit('error', error);
        });
      };
      Object.defineProperty(process, 'stderr', { configurable: true, value: stderr });

      const handleFatalError = createOneShotFatalErrorHandler(error => {
        reports += 1;
        process.stderr.write(\`Fatal error: \${error.message}\\n\`);
        setTimeout(() => {
          process.stdout.write(String(reports));
          process.exit(1);
        }, 20);
      });

      process.on('uncaughtException', handleFatalError);
      handleFatalError(new Error('initial failure'));
    `;

    const result = await new Promise<{ code: number | null; stdout: string; timedOut: boolean }>(resolve => {
      execFile(
        process.execPath,
        ['--import', import.meta.resolve('tsx'), '--input-type=module', '-e', script],
        { timeout: 1_000 },
        (error, stdout) => {
          const code =
            typeof (error as NodeJS.ErrnoException | null)?.code === 'number' ? error.code : error ? null : 0;
          resolve({ code, stdout, timedOut: Boolean((error as NodeJS.ErrnoException | null)?.killed) });
        },
      );
    });

    expect(result).toEqual({ code: 1, stdout: '1', timedOut: false });
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
