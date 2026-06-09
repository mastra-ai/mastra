import { describe, it, expect, vi, beforeEach } from 'vitest';

const spawnMock = vi.fn();

vi.mock('node:child_process', () => ({
  spawn: spawnMock,
}));

vi.mock('node:fs', () => ({
  default: {
    existsSync: vi.fn().mockReturnValue(true),
  },
}));

vi.mock('dotenv', () => ({
  config: vi.fn(),
}));

vi.mock('../../utils/logger', () => ({
  logger: {
    error: vi.fn(),
  },
}));

vi.mock('../utils', () => ({
  shouldSkipDotenvLoading: vi.fn().mockReturnValue(true),
}));

describe('start command - customArgs handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    const mockProcess = {
      stderr: { on: vi.fn() },
      on: vi.fn(),
      kill: vi.fn(),
    };
    spawnMock.mockReturnValue(mockProcess);
  });

  it('should pass custom args before index.mjs in spawn commands', async () => {
    const { start } = await import('./start');

    await start({
      customArgs: ['--require=newrelic'],
    });

    expect(spawnMock).toHaveBeenCalled();
    const commands = spawnMock.mock.calls[0][1] as string[];

    expect(commands).toContain('--require=newrelic');
    expect(commands).toContain('index.mjs');
    expect(commands.indexOf('--require=newrelic')).toBeLessThan(commands.indexOf('index.mjs'));
  });

  it('should pass multiple custom args before index.mjs', async () => {
    const { start } = await import('./start');

    await start({
      customArgs: ['--require=newrelic', '--max-old-space-size=4096'],
    });

    expect(spawnMock).toHaveBeenCalled();
    const commands = spawnMock.mock.calls[0][1] as string[];

    expect(commands).toContain('--require=newrelic');
    expect(commands).toContain('--max-old-space-size=4096');
    expect(commands.indexOf('--max-old-space-size=4096')).toBeLessThan(commands.indexOf('index.mjs'));
  });

  it('should only have index.mjs when no custom args provided', async () => {
    const { start } = await import('./start');

    await start({});

    expect(spawnMock).toHaveBeenCalled();
    const commands = spawnMock.mock.calls[0][1] as string[];

    expect(commands).toEqual(['index.mjs']);
  });

  it('should only have index.mjs when customArgs is undefined', async () => {
    const { start } = await import('./start');

    await start();

    expect(spawnMock).toHaveBeenCalled();
    const commands = spawnMock.mock.calls[0][1] as string[];

    expect(commands).toEqual(['index.mjs']);
  });

  it('should stream server stderr while the process is still running', async () => {
    const stderrWrite = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    let stderrHandler: ((data: Buffer) => void) | undefined;
    const mockProcess = {
      stderr: {
        on: vi.fn((event: string, handler: (data: Buffer) => void) => {
          if (event === 'data') {
            stderrHandler = handler;
          }
        }),
      },
      on: vi.fn(),
      kill: vi.fn(),
    };
    spawnMock.mockReturnValue(mockProcess);
    const { start } = await import('./start');

    await start();
    stderrHandler?.(Buffer.from('channel failed\n'));

    expect(stderrWrite).toHaveBeenCalledWith(Buffer.from('channel failed\n'));

    stderrWrite.mockRestore();
  });
});
