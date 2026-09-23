import { EventEmitter } from 'node:events';

import { describe, expect, it, vi } from 'vitest';

import { startDevelopment, waitForDevelopmentHealth } from '../../src/dev-supervisor.js';

class FakeChild extends EventEmitter {
  killed = false;
  readonly signals: NodeJS.Signals[] = [];

  kill(signal: NodeJS.Signals = 'SIGTERM') {
    this.killed = true;
    this.signals.push(signal);
    return true;
  }
}

async function preserveExitCode(operation: () => Promise<void>) {
  const original = process.exitCode;
  try {
    await operation();
  } finally {
    process.exitCode = original;
  }
}

describe('development supervisor', () => {
  it('starts Hono before Studio, reserves a distinct Studio port, and stops both', async () => {
    const server = new FakeChild();
    const studio = new FakeChild();
    const calls: Array<
      Readonly<{
        command: string;
        args: readonly string[];
        env?: NodeJS.ProcessEnv;
      }>
    > = [];
    const spawnChild = vi.fn((command, args, options) => {
      calls.push({ command, args, env: options.env });
      return calls.length === 1 ? server : studio;
    });

    const supervisor = await startDevelopment({
      root: '/synthetic/project',
      environment: { PORT: '3900', MASTRA_STORAGE_URL: 'file:./shared.db' },
      spawnChild,
      fetchHealth: async url => {
        expect(url).toBe('http://127.0.0.1:3900/health');
        return { ok: true };
      },
    });

    expect(calls).toHaveLength(2);
    expect(calls[0]!.args).toContain('src/start.ts');
    expect(calls[1]!.args).toEqual(['dev']);
    expect(calls[0]!.env).toMatchObject({
      PORT: '3900',
      MASTRA_STORAGE_URL: 'file:./shared.db',
    });
    expect(calls[1]!.env).toMatchObject({
      MASTRA_STORAGE_URL: 'file:./shared.db',
    });
    expect(calls[1]!.env?.PORT).toBe('');

    supervisor.stop('SIGINT');
    expect(server.signals).toEqual(['SIGINT']);
    expect(studio.signals).toEqual(['SIGINT']);
  });

  it('does not start Studio and terminates Hono when health never becomes ready', async () => {
    const server = new FakeChild();
    const spawnChild = vi.fn(() => server);

    await expect(
      startDevelopment({
        spawnChild,
        healthTimeoutMs: 1,
        healthRetryMs: 0,
        fetchHealth: async () => ({ ok: false }),
        sleep: async () => undefined,
      }),
    ).rejects.toThrow('Hono health check timed out');

    expect(spawnChild).toHaveBeenCalledTimes(1);
    expect(server.signals).toEqual(['SIGTERM']);
  });

  it('keeps retries bounded and abortable', async () => {
    let attempts = 0;
    await expect(
      waitForDevelopmentHealth('http://127.0.0.1:3000/health', {
        timeoutMs: 1,
        retryMs: 0,
        fetchHealth: async (_url, init) => {
          attempts += 1;
          expect(init.signal).toBeInstanceOf(AbortSignal);
          return { ok: false };
        },
        sleep: async () => undefined,
      }),
    ).rejects.toThrow('Hono health check timed out');
    expect(attempts).toBeGreaterThan(0);
  });

  it('fails globally for an unexpected clean Studio exit and terminates Hono', async () => {
    await preserveExitCode(async () => {
      const server = new FakeChild();
      const studio = new FakeChild();
      let spawnCount = 0;
      const spawnChild = vi.fn(() => (++spawnCount === 1 ? server : studio));
      const errors: string[] = [];
      await startDevelopment({
        spawnChild,
        fetchHealth: async () => ({ ok: true }),
        reportError: message => errors.push(message),
      });

      studio.emit('exit', 0, null);

      expect(process.exitCode).toBe(1);
      expect(errors).toEqual(['Mastra Studio exited before shutdown (code=0, signal=null)']);
      expect(server.signals).toEqual(['SIGTERM']);
      expect(studio.signals).toEqual(['SIGTERM']);
    });
  });

  it('rejects a Hono exit during health and never spawns Studio', async () => {
    await preserveExitCode(async () => {
      const server = new FakeChild();
      const spawnChild = vi.fn(() => server);
      await expect(
        startDevelopment({
          spawnChild,
          fetchHealth: async () => {
            server.emit('exit', 1, null);
            return { ok: true };
          },
          reportError: () => {},
        }),
      ).rejects.toThrow('Hono server exited before shutdown');

      expect(spawnChild).toHaveBeenCalledTimes(1);
      expect(server.signals).toEqual(['SIGTERM']);
    });
  });

  it('owns startup signals before health and never spawns Studio after abort', async () => {
    const signals = new EventEmitter();
    const server = new FakeChild();
    const spawnChild = vi.fn(() => server);

    const supervisor = await startDevelopment({
      installSignalHandlers: true,
      signalTarget: signals as never,
      spawnChild,
      fetchHealth: async () => {
        signals.emit('SIGINT');
        return { ok: true };
      },
      reportError: () => {},
    });

    expect(spawnChild).toHaveBeenCalledTimes(1);
    expect(server.signals).toEqual(['SIGINT']);
    supervisor.stop('SIGTERM');
    expect(server.signals).toEqual(['SIGINT']);
  });
});
