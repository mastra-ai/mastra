import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Agent } from '../../agent';
import { InMemoryStore } from '../../storage/mock';
import type { Workspace } from '../../workspace';

import { HarnessConfigError } from './errors';
import { Harness } from './harness';
import type { HeartbeatHandler } from './types';

function makeAgent() {
  return new Agent({
    id: 'default',
    name: 'Default',
    instructions: 'test',
    model: '__GATEWAY_OPENAI_MODEL_MINI__' as any,
  });
}

function makeHarness(heartbeatHandlers?: HeartbeatHandler[]) {
  return new Harness({
    agents: { default: makeAgent() },
    storage: new InMemoryStore(),
    modes: [{ id: 'default', agentId: 'default' }],
    defaultModeId: 'default',
    heartbeatHandlers,
  });
}

describe('Harness v1 — heartbeat handlers', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('starts configured handlers on init and runs immediate handlers', async () => {
    const handler = vi.fn();
    const harness = makeHarness([{ id: 'sync', intervalMs: 1_000, handler }]);

    await harness.init();

    expect(handler).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(handler).toHaveBeenCalledTimes(2);

    await harness.shutdown();
  });

  it('does not start configured handlers before init', async () => {
    const handler = vi.fn();
    const harness = makeHarness([{ id: 'sync', intervalMs: 1_000, handler }]);

    await vi.advanceTimersByTimeAsync(1_000);
    expect(handler).not.toHaveBeenCalled();

    await harness.init();
    expect(handler).toHaveBeenCalledTimes(1);

    await harness.shutdown();
  });

  it('does not start configured handlers when init fails before heartbeat startup', async () => {
    const error = new Error('workspace init failed');
    const handler = vi.fn();
    const workspace = {
      init: vi.fn(() => {
        throw error;
      }),
      destroy: vi.fn(),
    } as unknown as Workspace;
    const harness = new Harness({
      agents: { default: makeAgent() },
      storage: new InMemoryStore(),
      modes: [{ id: 'default', agentId: 'default' }],
      defaultModeId: 'default',
      workspace: { kind: 'shared', workspace, eager: true },
      heartbeatHandlers: [{ id: 'sync', intervalMs: 1_000, handler }],
    });

    await expect(harness.init()).rejects.toThrow(error);
    await vi.advanceTimersByTimeAsync(1_000);

    expect(handler).not.toHaveBeenCalled();
  });

  it('starts directly registered handlers before init', async () => {
    const handler = vi.fn();
    const harness = makeHarness();

    harness.registerHeartbeat({ id: 'direct', intervalMs: 1_000, handler });

    expect(handler).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(handler).toHaveBeenCalledTimes(2);

    await harness.shutdown();
  });

  it('lets configured handlers replace direct pre-init registrations with the same id', async () => {
    const direct = vi.fn();
    const directShutdown = vi.fn();
    const configured = vi.fn();
    const harness = makeHarness([{ id: 'same-id', intervalMs: 1_000, handler: configured, immediate: false }]);

    harness.registerHeartbeat({
      id: 'same-id',
      intervalMs: 1_000,
      handler: direct,
      immediate: false,
      shutdown: directShutdown,
    });
    await harness.init();
    await Promise.resolve();

    expect(directShutdown).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1_000);
    expect(direct).not.toHaveBeenCalled();
    expect(configured).toHaveBeenCalledTimes(1);

    await harness.shutdown();
  });

  it('replaces duplicate handler ids when registering', async () => {
    const first = vi.fn();
    const firstShutdown = vi.fn();
    const second = vi.fn();
    const harness = makeHarness();

    await harness.init();
    harness.registerHeartbeat({ id: 'duplicate', intervalMs: 1_000, handler: first, shutdown: firstShutdown });
    harness.registerHeartbeat({ id: 'duplicate', intervalMs: 1_000, handler: second, immediate: false });

    await Promise.resolve();
    expect(first).toHaveBeenCalledTimes(1);
    expect(firstShutdown).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1_000);
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);

    await harness.shutdown();
  });

  it('removes handlers by clearing timers and running shutdown callbacks', async () => {
    const handler = vi.fn();
    const shutdown = vi.fn();
    const harness = makeHarness();

    await harness.init();
    harness.registerHeartbeat({ id: 'remove-me', intervalMs: 1_000, handler, shutdown });

    await harness.removeHeartbeat({ id: 'remove-me' });
    await vi.advanceTimersByTimeAsync(1_000);
    await harness.removeHeartbeat({ id: 'remove-me' });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(shutdown).toHaveBeenCalledTimes(1);

    await harness.shutdown();
  });

  it('lets immediate handlers remove themselves before their interval is installed', async () => {
    let harness!: Harness;
    const shutdown = vi.fn();
    const handler = vi.fn(() => {
      void harness.removeHeartbeat({ id: 'self-remove' });
    });
    harness = makeHarness([{ id: 'self-remove', intervalMs: 1_000, handler, shutdown }]);

    await harness.init();
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(1_000);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(shutdown).toHaveBeenCalledTimes(1);

    await harness.shutdown();
  });

  it('ignores removal of unknown handler ids', async () => {
    const harness = makeHarness();

    await expect(harness.removeHeartbeat({ id: 'missing' })).resolves.toBeUndefined();

    await harness.shutdown();
  });

  it('logs synchronous handler failures without failing init or timer ticks', async () => {
    const error = new Error('handler failed');
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const harness = makeHarness([
      {
        id: 'sync-failure',
        intervalMs: 1_000,
        handler: () => {
          throw error;
        },
      },
    ]);

    await expect(harness.init()).resolves.toBeUndefined();
    await vi.advanceTimersByTimeAsync(1_000);

    expect(errorSpy).toHaveBeenCalledWith('[Heartbeat:sync-failure] failed:', error);
    expect(errorSpy).toHaveBeenCalledTimes(2);

    await harness.shutdown();
  });

  it('logs async configured handler failures without failing init or timer ticks', async () => {
    const error = new Error('async handler failed');
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const harness = makeHarness([
      {
        id: 'async-failure',
        intervalMs: 1_000,
        handler: vi.fn(() => Promise.reject(error)),
      },
    ]);

    await expect(harness.init()).resolves.toBeUndefined();
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(1_000);

    expect(errorSpy).toHaveBeenCalledWith('[Heartbeat:async-failure] failed:', error);
    expect(errorSpy).toHaveBeenCalledTimes(2);

    await harness.shutdown();
  });

  it('validates configured handlers before starting timers', async () => {
    const handler = vi.fn();

    expect(() =>
      makeHarness([
        { id: 'valid', intervalMs: 1_000, handler },
        { id: 'invalid', intervalMs: 0, handler: vi.fn() },
      ]),
    ).toThrow(HarnessConfigError);

    await vi.advanceTimersByTimeAsync(1_000);
    expect(handler).not.toHaveBeenCalled();
  });

  it('rejects heartbeat intervals above the Node timer limit', () => {
    expect(() => makeHarness([{ id: 'too-large', intervalMs: 2_147_483_648, handler: vi.fn() }])).toThrow(
      HarnessConfigError,
    );
  });

  it('uses the constructor-validated configured handler snapshot during init', async () => {
    const handler = vi.fn();
    const configured = { id: 'snapshot', intervalMs: 1_000, handler };
    const harness = makeHarness([configured]);

    configured.intervalMs = 0;

    await harness.init();
    await vi.advanceTimersByTimeAsync(1_000);

    expect(handler).toHaveBeenCalledTimes(2);

    await harness.shutdown();
  });

  it('rejects duplicate configured handler ids', () => {
    expect(() =>
      makeHarness([
        { id: 'duplicate', intervalMs: 1_000, handler: vi.fn() },
        { id: 'duplicate', intervalMs: 2_000, handler: vi.fn() },
      ]),
    ).toThrow(HarnessConfigError);
  });

  it('uses direct registration paths in direct registration validation errors', () => {
    const harness = makeHarness();

    expect(() => harness.registerHeartbeat({ id: 'bad', intervalMs: 0, handler: vi.fn() })).toThrow(
      /registerHeartbeat\["bad"\]\.intervalMs/,
    );
  });

  it('rejects registration after shutdown', async () => {
    const harness = makeHarness();

    await harness.init();
    await harness.shutdown();

    expect(() => harness.registerHeartbeat({ id: 'late', intervalMs: 1_000, handler: vi.fn() })).toThrow(
      HarnessConfigError,
    );
  });

  it('logs shutdown callback failures without leaving stale state', async () => {
    const error = new Error('shutdown failed');
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const shutdown = vi.fn(() => {
      throw error;
    });
    const harness = makeHarness();

    await harness.init();
    harness.registerHeartbeat({ id: 'failing-shutdown', intervalMs: 1_000, handler: vi.fn(), shutdown });

    await expect(harness.removeHeartbeat({ id: 'failing-shutdown' })).resolves.toBeUndefined();
    await expect(harness.removeHeartbeat({ id: 'failing-shutdown' })).resolves.toBeUndefined();

    expect(shutdown).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith('[Heartbeat:failing-shutdown] shutdown failed:', error);

    await harness.shutdown();
  });

  it('logs async configured shutdown failures without leaving stale state', async () => {
    const error = new Error('async shutdown failed');
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const shutdown = vi.fn(() => Promise.reject(error));
    const harness = makeHarness([{ id: 'configured-shutdown', intervalMs: 1_000, handler: vi.fn(), shutdown }]);

    await harness.init();
    await expect(harness.removeHeartbeat({ id: 'configured-shutdown' })).resolves.toBeUndefined();
    await expect(harness.removeHeartbeat({ id: 'configured-shutdown' })).resolves.toBeUndefined();

    expect(shutdown).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith('[Heartbeat:configured-shutdown] shutdown failed:', error);

    await harness.shutdown();
  });

  it('waits for replaced handler shutdowns during stopHeartbeats', async () => {
    let resolveShutdown: (() => void) | undefined;
    const shutdown = vi.fn(
      () =>
        new Promise<void>(resolve => {
          resolveShutdown = resolve;
        }),
    );
    const harness = makeHarness();

    await harness.init();
    harness.registerHeartbeat({ id: 'replace-me', intervalMs: 1_000, handler: vi.fn(), shutdown });
    harness.registerHeartbeat({ id: 'replace-me', intervalMs: 1_000, handler: vi.fn(), immediate: false });

    let stopped = false;
    const stop = harness.stopHeartbeats().then(() => {
      stopped = true;
    });
    await Promise.resolve();

    expect(shutdown).toHaveBeenCalledTimes(1);
    expect(stopped).toBe(false);

    resolveShutdown?.();
    await stop;
    expect(stopped).toBe(true);

    await harness.shutdown();
  });

  it('waits for in-flight handler runs during stopHeartbeats', async () => {
    let resolveRun: (() => void) | undefined;
    const handler = vi.fn(
      () =>
        new Promise<void>(resolve => {
          resolveRun = resolve;
        }),
    );
    const harness = makeHarness([{ id: 'slow-run', intervalMs: 1_000, handler, immediate: false }]);

    await harness.init();
    vi.advanceTimersByTime(1_000);
    await Promise.resolve();

    let stopped = false;
    const stop = harness.stopHeartbeats().then(() => {
      stopped = true;
    });
    await Promise.resolve();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(stopped).toBe(false);

    resolveRun?.();
    await stop;
    expect(stopped).toBe(true);

    await harness.shutdown();
  });

  it('waits for other in-flight handler runs when a handler stops heartbeats', async () => {
    let harness!: Harness;
    let resolveSlowRun: (() => void) | undefined;
    let stopped = false;
    const slow = vi.fn(
      () =>
        new Promise<void>(resolve => {
          resolveSlowRun = resolve;
        }),
    );
    const stopper = vi.fn(async () => {
      await Promise.resolve();
      await harness.stopHeartbeats();
      stopped = true;
    });
    harness = makeHarness([
      { id: 'slow-run', intervalMs: 1_000, handler: slow },
      { id: 'self-stop', intervalMs: 1_000, handler: stopper },
    ]);

    await harness.init();
    await Promise.resolve();
    await Promise.resolve();

    expect(slow).toHaveBeenCalledTimes(1);
    expect(stopper).toHaveBeenCalledTimes(1);
    expect(stopped).toBe(false);

    resolveSlowRun?.();
    await vi.waitFor(() => {
      expect(stopped).toBe(true);
    });

    await harness.shutdown();
  });

  it('does not wait on the current handler run when a handler stops heartbeats', async () => {
    let harness!: Harness;
    let stopped = false;
    const handler = vi.fn(async () => {
      await Promise.resolve();
      await harness.stopHeartbeats();
      stopped = true;
    });
    harness = makeHarness([{ id: 'self-stop', intervalMs: 1_000, handler }]);

    await harness.init();

    await vi.waitFor(() => {
      expect(stopped).toBe(true);
    });

    await harness.shutdown();
  });

  it('does not wait on the current handler run when a handler shuts down the harness', async () => {
    let harness!: Harness;
    let shutDown = false;
    const handler = vi.fn(async () => {
      await Promise.resolve();
      await harness.shutdown();
      shutDown = true;
    });
    harness = makeHarness([{ id: 'self-shutdown', intervalMs: 1_000, handler }]);

    await harness.init();

    await vi.waitFor(() => {
      expect(shutDown).toBe(true);
    });
    expect(() => harness.registerHeartbeat({ id: 'late', intervalMs: 1_000, handler: vi.fn() })).toThrow(
      HarnessConfigError,
    );
  });

  it('does not deadlock when multiple handler runs stop heartbeats concurrently', async () => {
    let harness!: Harness;
    let firstStopped = false;
    let secondStopped = false;
    const first = vi.fn(async () => {
      await Promise.resolve();
      await harness.stopHeartbeats();
      firstStopped = true;
    });
    const second = vi.fn(async () => {
      await Promise.resolve();
      await harness.stopHeartbeats();
      secondStopped = true;
    });
    harness = makeHarness([
      { id: 'self-stop-a', intervalMs: 1_000, handler: first },
      { id: 'self-stop-b', intervalMs: 1_000, handler: second },
    ]);

    await harness.init();

    await vi.waitFor(() => {
      expect(firstStopped).toBe(true);
      expect(secondStopped).toBe(true);
    });

    await harness.shutdown();
  });

  it('does not deadlock when a shutdown callback stops heartbeats', async () => {
    let harness!: Harness;
    let shutdownStopped = false;
    const shutdown = vi.fn(async () => {
      await harness.stopHeartbeats();
      shutdownStopped = true;
    });
    harness = makeHarness([{ id: 'shutdown-self-stop', intervalMs: 1_000, handler: vi.fn(), shutdown }]);

    await harness.init();
    await harness.stopHeartbeats();

    expect(shutdown).toHaveBeenCalledTimes(1);
    expect(shutdownStopped).toBe(true);
  });

  it('stops all handlers from a deterministic snapshot', async () => {
    const first = vi.fn();
    const second = vi.fn();
    const firstShutdown = vi.fn();
    const secondShutdown = vi.fn();
    const harness = makeHarness();

    await harness.init();
    harness.registerHeartbeat({ id: 'first', intervalMs: 1_000, handler: first, shutdown: firstShutdown });
    harness.registerHeartbeat({ id: 'second', intervalMs: 1_000, handler: second, shutdown: secondShutdown });

    await harness.stopHeartbeats();
    await harness.stopHeartbeats();
    await vi.advanceTimersByTimeAsync(1_000);

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    expect(firstShutdown).toHaveBeenCalledTimes(1);
    expect(secondShutdown).toHaveBeenCalledTimes(1);

    await harness.shutdown();
  });

  it('allows direct registrations after stopHeartbeats when not shutting down', async () => {
    const first = vi.fn();
    const second = vi.fn();
    const harness = makeHarness();

    await harness.init();
    harness.registerHeartbeat({ id: 'first', intervalMs: 1_000, handler: first });
    await harness.stopHeartbeats();

    harness.registerHeartbeat({ id: 'second', intervalMs: 1_000, handler: second });
    await vi.advanceTimersByTimeAsync(1_000);

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(2);

    await harness.shutdown();
  });

  it('stops heartbeat timers during shutdown', async () => {
    const handler = vi.fn();
    const shutdown = vi.fn();
    const harness = makeHarness([{ id: 'shutdown-owned', intervalMs: 1_000, handler, shutdown }]);

    await harness.init();
    await harness.shutdown();
    await vi.advanceTimersByTimeAsync(1_000);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(shutdown).toHaveBeenCalledTimes(1);
  });

  it('does not start configured handlers when shutdown interrupts init', async () => {
    let resolveWorkspaceInit: (() => void) | undefined;
    const handler = vi.fn();
    const workspace = {
      init: vi.fn(
        () =>
          new Promise<void>(resolve => {
            resolveWorkspaceInit = resolve;
          }),
      ),
      destroy: vi.fn(),
    } as unknown as Workspace;
    const harness = new Harness({
      agents: { default: makeAgent() },
      storage: new InMemoryStore(),
      modes: [{ id: 'default', agentId: 'default' }],
      defaultModeId: 'default',
      workspace: { kind: 'shared', workspace, eager: true },
      heartbeatHandlers: [{ id: 'sync', intervalMs: 1_000, handler }],
    });

    const init = harness.init().catch(error => error);
    const shutdown = harness.shutdown();
    resolveWorkspaceInit?.();

    await expect(init).resolves.toBeInstanceOf(HarnessConfigError);
    await shutdown;
    await vi.advanceTimersByTimeAsync(1_000);

    expect(handler).not.toHaveBeenCalled();
  });

  it('stops direct pre-init handlers before waiting for interrupted init', async () => {
    let resolveWorkspaceInit: (() => void) | undefined;
    const handler = vi.fn();
    const workspace = {
      init: vi.fn(
        () =>
          new Promise<void>(resolve => {
            resolveWorkspaceInit = resolve;
          }),
      ),
      destroy: vi.fn(),
    } as unknown as Workspace;
    const harness = new Harness({
      agents: { default: makeAgent() },
      storage: new InMemoryStore(),
      modes: [{ id: 'default', agentId: 'default' }],
      defaultModeId: 'default',
      workspace: { kind: 'shared', workspace, eager: true },
    });

    harness.registerHeartbeat({ id: 'direct', intervalMs: 1_000, handler });
    const init = harness.init().catch(error => error);
    const shutdown = harness.shutdown();
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(1_000);
    resolveWorkspaceInit?.();

    await expect(init).resolves.toBeInstanceOf(HarnessConfigError);
    await shutdown;
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('starts configured handlers when stopHeartbeats is called before init', async () => {
    const handler = vi.fn();
    const harness = makeHarness([{ id: 'configured', intervalMs: 1_000, handler }]);

    await harness.stopHeartbeats();
    await harness.init();
    await vi.advanceTimersByTimeAsync(1_000);

    expect(handler).toHaveBeenCalledTimes(2);

    await harness.shutdown();
  });

  it('does not restart configured handlers on repeated init after stopHeartbeats', async () => {
    const handler = vi.fn();
    const harness = makeHarness([{ id: 'configured', intervalMs: 1_000, handler }]);

    await harness.init();
    await harness.stopHeartbeats();
    await harness.init();
    await vi.advanceTimersByTimeAsync(1_000);

    expect(handler).toHaveBeenCalledTimes(1);

    await harness.shutdown();
  });
});
