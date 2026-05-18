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
