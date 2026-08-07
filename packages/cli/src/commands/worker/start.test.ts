import { EventEmitter } from 'node:events';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const spawnMock = vi.fn();
const existsSyncMock = vi.fn().mockReturnValue(true);
const exitMock = vi.fn();
const errorLogMock = vi.fn();

vi.mock('node:child_process', () => ({
  spawn: spawnMock,
}));

vi.mock('node:fs', () => ({
  default: {
    existsSync: existsSyncMock,
  },
}));

vi.mock('dotenv', () => ({
  config: vi.fn(),
}));

vi.mock('../../utils/logger', () => ({
  logger: {
    error: errorLogMock,
  },
}));

vi.mock('../utils', () => ({
  shouldSkipDotenvLoading: vi.fn().mockReturnValue(true),
}));

describe('mastra worker start', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    existsSyncMock.mockReturnValue(true);

    const mockProcess = {
      stderr: { on: vi.fn() },
      on: vi.fn(),
      kill: vi.fn(),
    };
    spawnMock.mockReturnValue(mockProcess);

    vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      exitMock(code);
      throw new Error(`__exit_${code}`);
    }) as typeof process.exit);
  });

  it('spawns index.mjs from the worker output directory', async () => {
    const { startWorker } = await import('./start');
    await startWorker({});

    expect(spawnMock).toHaveBeenCalled();
    const args = spawnMock.mock.calls[0][1] as string[];
    expect(args).toEqual(['index.mjs']);
  });

  it('passes name as MASTRA_WORKERS env when [name] is given', async () => {
    const { startWorker } = await import('./start');
    await startWorker({ name: 'orchestration' });

    const opts = spawnMock.mock.calls[0][2] as { env: Record<string, string> };
    expect(opts.env.MASTRA_WORKERS).toBe('orchestration');
  });

  it('does not set MASTRA_WORKERS when name is omitted', async () => {
    const { startWorker } = await import('./start');
    delete process.env.MASTRA_WORKERS;
    await startWorker({});

    const opts = spawnMock.mock.calls[0][2] as { env: Record<string, string | undefined> };
    expect(opts.env.MASTRA_WORKERS).toBeUndefined();
  });

  it('errors with a clear message when the worker bundle is missing', async () => {
    existsSyncMock.mockReturnValue(false);
    const { startWorker } = await import('./start');

    await expect(startWorker({})).rejects.toThrow('__exit_1');

    expect(spawnMock).not.toHaveBeenCalled();
    expect(errorLogMock).toHaveBeenCalledWith(expect.stringContaining('mastra worker build'));
    expect(exitMock).toHaveBeenCalledWith(1);
  });
});

describe('mastra worker start - stderr buffer handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    existsSyncMock.mockReturnValue(true);

    vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
      exitMock(code);
      throw new Error(`__exit_${code}`);
    }) as typeof process.exit);
  });

  function createFakeChild() {
    const child = new EventEmitter() as EventEmitter & {
      stderr: EventEmitter;
      kill: ReturnType<typeof vi.fn>;
    };
    child.stderr = new EventEmitter();
    child.kill = vi.fn();
    return child;
  }

  it('keeps the retained stderr buffer bounded when the worker floods stderr', async () => {
    const { boundStderr, MAX_STDERR_BUFFER } = await import('./start');

    // Simulate a long-running worker streaming far more stderr than the cap.
    // 500 x 100KB = ~50MB of output, 50x the 1MB bound. Without a bound this
    // grows until it exceeds V8's max string length and throws RangeError.
    const chunk = 'x'.repeat(100_000);
    let buffer = '';
    for (let i = 0; i < 500; i++) {
      buffer = boundStderr(buffer, chunk);
    }

    expect(buffer.length).toBe(MAX_STDERR_BUFFER);
    expect(buffer.length).toBeLessThanOrEqual(MAX_STDERR_BUFFER);
  });

  it('still detects a module-not-found error on the retained tail after a flood', async () => {
    const { boundStderr } = await import('./start');

    // A crashing worker prints the module error at the END of its stderr,
    // so the bounded tail must still contain it after a large flood.
    const filler = 'x'.repeat(100_000);
    let buffer = '';
    for (let i = 0; i < 500; i++) {
      buffer = boundStderr(buffer, filler);
    }
    buffer = boundStderr(buffer, "Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'some-pkg'\n");

    expect(buffer.includes('ERR_MODULE_NOT_FOUND')).toBe(true);
    expect(buffer.match(/Cannot find package '([^']+)'/)?.[1]).toBe('some-pkg');
  });

  it('surfaces a module-not-found crash through startWorker() even after a large stderr flood', async () => {
    const child = createFakeChild();
    spawnMock.mockReturnValue(child);
    const writeSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    try {
      const { startWorker } = await import('./start');
      const started = startWorker({});

      // Flood ~10MB of stderr, then emit the crash marker at the tail.
      const chunk = Buffer.from('x'.repeat(100_000));
      for (let i = 0; i < 100; i++) {
        child.stderr.emit('data', chunk);
      }
      child.stderr.emit('data', Buffer.from("Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'some-pkg'\n"));

      expect(() => child.emit('exit', 1)).toThrow('__exit_1');
      await started;

      expect(errorLogMock).toHaveBeenCalledWith('Module not found while starting Mastra worker', {
        package: 'some-pkg',
      });
    } finally {
      writeSpy.mockRestore();
    }
  });
});
