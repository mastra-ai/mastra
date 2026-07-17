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

// start() registers SIGINT/SIGTERM handlers on every call. Snapshot the
// listeners present before each test and remove only the ones added during the
// test, so we never strip handlers owned by the runner or other suites.
type SignalListener = (...args: unknown[]) => void;
let signalListenersBefore: Record<'SIGINT' | 'SIGTERM', SignalListener[]>;

beforeEach(() => {
  signalListenersBefore = {
    SIGINT: process.listeners('SIGINT') as unknown as SignalListener[],
    SIGTERM: process.listeners('SIGTERM') as unknown as SignalListener[],
  };
});

afterEach(() => {
  (['SIGINT', 'SIGTERM'] as const).forEach(signal => {
    (process.listeners(signal) as unknown as SignalListener[]).forEach(listener => {
      if (!signalListenersBefore[signal].includes(listener)) {
        process.removeListener(signal, listener);
      }
    });
  });
});

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

  it('keeps the retained stderr buffer bounded when the server floods stderr', async () => {
    const { boundStderr, MAX_STDERR_BUFFER } = await import('./start');

    // Simulate a long-running server streaming far more stderr than the cap.
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

    // A crashing process prints the module error at the END of its stderr,
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

  it('surfaces a module-not-found crash through start() even after a large stderr flood', async () => {
    const server = createFakeServer();
    spawnMock.mockReturnValue(server);
    const writeSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);

    try {
      const { logger } = await import('../../utils/logger');
      const { start } = await import('./start');
      await start({ dir: 'output' });

      // Flood ~10MB of stderr, then emit the crash marker at the tail.
      const chunk = Buffer.from('x'.repeat(100_000));
      for (let i = 0; i < 100; i++) {
        server.stderr.emit('data', chunk);
      }
      server.stderr.emit('data', Buffer.from("Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'some-pkg'\n"));
      server.emit('exit', 1);

      expect(logger.error).toHaveBeenCalledWith('Module not found while starting Mastra server', {
        package: 'some-pkg',
      });
    } finally {
      writeSpy.mockRestore();
      exitSpy.mockRestore();
    }
  });
});
