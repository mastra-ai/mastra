import { EventEmitter } from 'node:events';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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
});

describe('start command - server stderr handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.removeAllListeners('SIGINT');
    process.removeAllListeners('SIGTERM');
  });

  function createFakeServer() {
    const server = new EventEmitter() as EventEmitter & {
      stderr: EventEmitter;
      kill: ReturnType<typeof vi.fn>;
    };
    server.stderr = new EventEmitter();
    server.kill = vi.fn();
    return server;
  }

  it('streams the running server stderr through live so logs stay visible', async () => {
    const server = createFakeServer();
    spawnMock.mockReturnValue(server);
    const writeSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    try {
      const { start } = await import('./start');
      await start({ dir: 'output' });

      const line = Buffer.from('[chat-sdk:slack] Could not fetch bot user ID { invalid_auth }\n');
      server.stderr.emit('data', line);

      expect(writeSpy).toHaveBeenCalledWith(line);
    } finally {
      writeSpy.mockRestore();
    }
  });
});
