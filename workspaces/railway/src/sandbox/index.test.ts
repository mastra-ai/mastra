/**
 * Railway Sandbox Provider Tests
 *
 * Tests Railway-specific functionality:
 * - Constructor options and ID generation
 * - Lifecycle (create, connect, destroy)
 * - Command execution and result mapping
 * - Process spawning, env/cwd passthrough, and kill
 */

import { SandboxNotReadyError } from '@mastra/core/workspace';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RailwaySandbox } from './index';

// =============================================================================
// Mock the Railway SDK
// =============================================================================

const {
  mockSandbox,
  mockForkedSandbox,
  mockCreate,
  mockConnect,
  mockCheckpoints,
  mockDeleteCheckpoint,
  makeExecHandle,
  MockSandboxNotFoundError,
} = vi.hoisted(() => {
  /**
   * Build a fake ExecHandle: a Promise that resolves to an ExecResult and
   * exposes `kill`. Invokes onStdout/onStderr asynchronously to mimic the
   * real SDK, which streams chunks after the handle is returned.
   */
  const makeExecHandle = (
    result: { exitCode: number | null; stdout?: string; stderr?: string; timedOut?: boolean; truncated?: boolean },
    opts?: { onStdout?: (c: string) => void; onStderr?: (c: string) => void },
  ) => {
    queueMicrotask(() => {
      if (result.stdout) opts?.onStdout?.(result.stdout);
      if (result.stderr) opts?.onStderr?.(result.stderr);
    });
    const execResult = {
      exitCode: result.exitCode,
      stdout: result.stdout ?? '',
      stderr: result.stderr ?? '',
      truncated: result.truncated ?? false,
      timedOut: result.timedOut ?? false,
    };
    const promise = Promise.resolve(execResult) as Promise<typeof execResult> & {
      kill: ReturnType<typeof vi.fn>;
    };
    promise.kill = vi.fn().mockResolvedValue(true);
    return promise;
  };

  const mockForkedSandbox = {
    id: 'rw-forked-456',
    status: 'RUNNING',
    environmentId: 'env-1',
    region: 'us-west',
    networkIsolation: 'ISOLATED',
    idleTimeoutMinutes: 30,
    createdAt: '2026-01-02T00:00:00.000Z',
    exec: vi.fn((_command: string, options?: { onStdout?: (c: string) => void; onStderr?: (c: string) => void }) =>
      makeExecHandle({ exitCode: 0, stdout: 'ok' }, options),
    ),
    destroy: vi.fn().mockResolvedValue(undefined),
  };

  const mockSandbox = {
    id: 'rw-sandbox-123',
    status: 'RUNNING',
    environmentId: 'env-1',
    region: 'us-west',
    networkIsolation: 'ISOLATED',
    idleTimeoutMinutes: 30,
    createdAt: '2026-01-01T00:00:00.000Z',
    exec: vi.fn((_command: string, options?: { onStdout?: (c: string) => void; onStderr?: (c: string) => void }) =>
      makeExecHandle({ exitCode: 0, stdout: 'ok' }, options),
    ),
    fork: vi.fn().mockResolvedValue(mockForkedSandbox),
    checkpoint: vi.fn().mockResolvedValue({ id: 'checkpoint-1', key: 'checkpoint-1', environmentId: 'env-1' }),
    destroy: vi.fn().mockResolvedValue(undefined),
  };

  const mockCreate = vi.fn().mockResolvedValue(mockSandbox);
  const mockConnect = vi.fn().mockResolvedValue(mockSandbox);
  const mockCheckpoints = vi.fn().mockResolvedValue([]);
  const mockDeleteCheckpoint = vi.fn().mockResolvedValue(undefined);

  class MockSandboxNotFoundError extends Error {
    name = 'SandboxNotFoundError';
  }

  return {
    mockSandbox,
    mockForkedSandbox,
    mockCreate,
    mockConnect,
    mockCheckpoints,
    mockDeleteCheckpoint,
    makeExecHandle,
    MockSandboxNotFoundError,
  };
});

vi.mock('railway', () => ({
  Sandbox: {
    create: mockCreate,
    connect: mockConnect,
    checkpoints: mockCheckpoints,
    deleteCheckpoint: mockDeleteCheckpoint,
  },
  SandboxNotFoundError: MockSandboxNotFoundError,
}));

afterEach(() => {
  vi.useRealTimers();
});

// =============================================================================
// Tests
// =============================================================================

describe('RailwaySandbox', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
    mockCreate.mockReset().mockResolvedValue(mockSandbox);
    mockConnect.mockReset().mockResolvedValue(mockSandbox);
    mockCheckpoints.mockReset().mockResolvedValue([]);
    mockDeleteCheckpoint.mockReset().mockResolvedValue(undefined);
    mockSandbox.status = 'RUNNING';
    mockSandbox.idleTimeoutMinutes = 30;
    mockSandbox.exec.mockReset();
    mockSandbox.fork.mockReset().mockResolvedValue(mockForkedSandbox);
    mockSandbox.checkpoint
      .mockReset()
      .mockResolvedValue({ id: 'checkpoint-1', key: 'checkpoint-1', environmentId: 'env-1' });
    mockSandbox.destroy.mockReset().mockResolvedValue(undefined);
    mockSandbox.exec.mockImplementation((_command: string, options?: { onStdout?: (c: string) => void }) =>
      makeExecHandle({ exitCode: 0, stdout: 'ok' }, options),
    );
  });

  describe('constructor', () => {
    it('creates an instance with defaults', () => {
      const sandbox = new RailwaySandbox({ token: 't' });
      expect(sandbox.name).toBe('RailwaySandbox');
      expect(sandbox.provider).toBe('railway');
      expect(sandbox.status).toBe('pending');
      expect(sandbox.id).toMatch(/^railway-sandbox-/);
    });

    it('honors a custom id', () => {
      const sandbox = new RailwaySandbox({ id: 'custom-id' });
      expect(sandbox.id).toBe('custom-id');
    });
  });

  describe('lifecycle', () => {
    it('creates a Railway sandbox on start with configured options', async () => {
      const sandbox = new RailwaySandbox({
        token: 'tok',
        environmentId: 'env-1',
        idleTimeoutMinutes: 45,
        networkIsolation: 'PRIVATE',
        env: { FOO: 'bar' },
      });
      await sandbox._start();

      expect(sandbox.status).toBe('running');
      expect(mockCreate).toHaveBeenCalledTimes(1);
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          token: 'tok',
          environmentId: 'env-1',
          idleTimeoutMinutes: 45,
          networkIsolation: 'PRIVATE',
          env: { FOO: 'bar' },
        }),
      );
    });

    it('reconnects to a configured running sandbox without creating a replacement', async () => {
      const runningSandbox = { ...mockSandbox, id: 'rw-existing', status: 'RUNNING' };
      mockConnect.mockResolvedValueOnce(runningSandbox);

      const sandbox = new RailwaySandbox({ token: 'tok', sandboxId: 'rw-existing' });
      await sandbox._start();

      expect(mockConnect).toHaveBeenCalledWith('rw-existing', expect.objectContaining({ token: 'tok' }));
      expect(mockCreate).not.toHaveBeenCalled();
      expect(sandbox.railway).toBe(runningSandbox);
      expect(sandbox.status).toBe('running');
    });

    it('creates a fresh sandbox when a configured sandbox is no longer running', async () => {
      mockConnect.mockResolvedValueOnce({ ...mockSandbox, status: 'DESTROYED' });
      const replacement = { ...mockSandbox, id: 'rw-replacement', status: 'RUNNING' };
      mockCreate.mockResolvedValueOnce(replacement);

      const sandbox = new RailwaySandbox({ token: 'tok', sandboxId: 'rw-existing' });
      await sandbox._start();

      expect(mockConnect).toHaveBeenCalledWith('rw-existing', expect.objectContaining({ token: 'tok' }));
      expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ token: 'tok' }));
      expect(sandbox.railway).toBe(replacement);
      expect(sandbox.status).toBe('running');
    });

    it("reports outcomes: 'connected' on reattach, 'created' on provision and replacement", async () => {
      mockConnect.mockResolvedValueOnce({ ...mockSandbox, id: 'rw-existing', status: 'RUNNING' });
      const reattached = new RailwaySandbox({ token: 'tok', sandboxId: 'rw-existing' });
      await expect(reattached._start()).resolves.toEqual({ outcome: 'connected' });

      const fresh = new RailwaySandbox({ token: 'tok', environmentId: 'env-1' });
      await expect(fresh._start()).resolves.toEqual({ outcome: 'created' });

      mockConnect.mockResolvedValueOnce({ ...mockSandbox, status: 'DESTROYED' });
      mockCreate.mockResolvedValueOnce({ ...mockSandbox, id: 'rw-replacement', status: 'RUNNING' });
      const replaced = new RailwaySandbox({ token: 'tok', sandboxId: 'rw-existing' });
      await expect(replaced._start()).resolves.toEqual({ outcome: 'created' });
    });

    it('throws SandboxNotReadyError when accessing railway before start', () => {
      const sandbox = new RailwaySandbox({ token: 't' });
      expect(() => sandbox.railway).toThrow(SandboxNotReadyError);
    });

    it('destroys the underlying sandbox', async () => {
      const sandbox = new RailwaySandbox({ token: 't' });
      await sandbox._start();
      await sandbox._destroy();

      expect(mockSandbox.destroy).toHaveBeenCalledTimes(1);
      expect(sandbox.status).toBe('destroyed');
    });
  });

  describe('checkpoint lifecycle', () => {
    it('restores from a saved checkpoint without deleting or recapturing it', async () => {
      mockCheckpoints.mockResolvedValueOnce([
        { id: 'checkpoint-id', key: 'mastracode-repo-abc123', environmentId: 'env-1' },
      ]);
      const sandbox = new RailwaySandbox({ token: 'tok', checkpointName: 'mastracode-repo-abc123' });
      await sandbox._start();

      expect(mockCheckpoints).toHaveBeenCalledWith({ token: 'tok' });
      expect(mockCreate).toHaveBeenCalledWith('mastracode-repo-abc123', expect.objectContaining({ token: 'tok' }));
      expect(mockDeleteCheckpoint).not.toHaveBeenCalled();
      expect(mockSandbox.checkpoint).not.toHaveBeenCalled();
      expect(sandbox.status).toBe('running');
    });

    it('falls back to seedCheckpointName when the primary checkpoint has no state', async () => {
      mockCheckpoints.mockResolvedValueOnce([{ id: 'base-checkpoint-id', key: 'repo-base', environmentId: 'env-1' }]);
      const sandbox = new RailwaySandbox({
        token: 'tok',
        checkpointName: 'session-checkpoint',
        seedCheckpointName: 'repo-base',
      });

      await sandbox._start();

      expect(mockCreate).toHaveBeenCalledWith('repo-base', expect.objectContaining({ token: 'tok' }));
      await expect(sandbox.getInfo()).resolves.toMatchObject({
        metadata: { restoredCheckpointName: 'repo-base' },
      });
    });

    it('prefers checkpointName over seedCheckpointName when both have state', async () => {
      mockCheckpoints.mockResolvedValueOnce([
        { id: 'session-checkpoint-id', key: 'session-checkpoint', environmentId: 'env-1' },
        { id: 'base-checkpoint-id', key: 'repo-base', environmentId: 'env-1' },
      ]);
      const sandbox = new RailwaySandbox({
        token: 'tok',
        checkpointName: 'session-checkpoint',
        seedCheckpointName: 'repo-base',
      });

      await sandbox._start();

      expect(mockCreate).toHaveBeenCalledWith('session-checkpoint', expect.objectContaining({ token: 'tok' }));
      await expect(sandbox.getInfo()).resolves.toMatchObject({
        metadata: { restoredCheckpointName: 'session-checkpoint' },
      });
    });

    it('refreshes checkpoints at the one-second floor when idle timeout is below the safety margin', async () => {
      vi.useFakeTimers();
      const checkpointSandbox = { ...mockSandbox, idleTimeoutMinutes: 1 };
      mockCreate.mockResolvedValueOnce(checkpointSandbox);

      const sandbox = new RailwaySandbox({ token: 'tok', checkpointName: 'mastracode-repo-abc123' });
      await sandbox._start();

      expect(mockSandbox.checkpoint).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(999);
      expect(mockSandbox.checkpoint).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(1);

      expect(mockCheckpoints).toHaveBeenCalledTimes(2);
      expect(mockDeleteCheckpoint).not.toHaveBeenCalled();
      expect(mockSandbox.checkpoint).toHaveBeenCalledOnce();
      expect(mockSandbox.checkpoint).toHaveBeenLastCalledWith('mastracode-repo-abc123');
    });

    describe('captureCheckpoint (public, on-demand)', () => {
      it('delegates snapshot to captureCheckpoint', async () => {
        const sandbox = new RailwaySandbox({ token: 'tok', checkpointName: 'mastracode-repo-abc123' });
        await sandbox._start();
        const captureCheckpoint = vi.spyOn(sandbox, 'captureCheckpoint');

        await expect(sandbox.snapshot()).resolves.toBeUndefined();

        expect(captureCheckpoint).toHaveBeenCalledOnce();
      });

      it('captures the checkpoint synchronously and returns the captured name', async () => {
        mockCheckpoints.mockResolvedValueOnce([
          { id: 'checkpoint-id', key: 'mastracode-repo-abc123', environmentId: 'env-1' },
        ]);
        const sandbox = new RailwaySandbox({ token: 'tok', checkpointName: 'mastracode-repo-abc123' });
        await sandbox._start();

        // Restore path — no capture at start.
        expect(mockSandbox.checkpoint).not.toHaveBeenCalled();

        const outcome = await sandbox.captureCheckpoint();

        expect(outcome).toEqual({ status: 'captured', checkpointName: 'mastracode-repo-abc123' });
        expect(mockSandbox.checkpoint).toHaveBeenCalledTimes(1);
        expect(mockSandbox.checkpoint).toHaveBeenCalledWith('mastracode-repo-abc123');
      });

      it('returns skipped with a reason when no checkpointName is configured', async () => {
        const sandbox = new RailwaySandbox({ token: 'tok' });
        await sandbox._start();

        const outcome = await sandbox.captureCheckpoint();

        expect(outcome).toEqual({ status: 'skipped', reason: 'no-checkpoint-name-configured' });
        expect(mockSandbox.checkpoint).not.toHaveBeenCalled();
      });

      it('returns skipped with a reason when the sandbox has not been started', async () => {
        const sandbox = new RailwaySandbox({ token: 'tok', checkpointName: 'mastracode-repo-abc123' });

        const outcome = await sandbox.captureCheckpoint();

        expect(outcome).toEqual({ status: 'skipped', reason: 'sandbox-not-running' });
        expect(mockSandbox.checkpoint).not.toHaveBeenCalled();
      });

      it('coalesces with an in-flight timer-driven refresh (single upstream capture)', async () => {
        vi.useFakeTimers();
        mockCheckpoints.mockResolvedValueOnce([
          { id: 'checkpoint-id', key: 'mastracode-repo-abc123', environmentId: 'env-1' },
        ]);

        // Hold the checkpoint call open so the timer's refresh is in-flight
        // when captureCheckpoint() arrives.
        let releaseCheckpoint!: () => void;
        const held = new Promise<{ id: string; key: string; environmentId: string }>(resolve => {
          releaseCheckpoint = () =>
            resolve({ id: 'checkpoint-id', key: 'mastracode-repo-abc123', environmentId: 'env-1' });
        });
        mockSandbox.checkpoint.mockImplementationOnce(() => held);

        const sandbox = new RailwaySandbox({
          token: 'tok',
          checkpointName: 'mastracode-repo-abc123',
          idleTimeoutMinutes: 5,
        });
        await sandbox._start();

        // Advance to fire the timer-driven refresh; checkpoint call is now
        // hanging on `held`.
        await vi.advanceTimersByTimeAsync(2 * 60_000);
        expect(mockSandbox.checkpoint).toHaveBeenCalledTimes(1);

        // Concurrent on-demand capture joins the in-flight refresh.
        const outcomePromise = sandbox.captureCheckpoint();

        releaseCheckpoint();
        const outcome = await outcomePromise;

        expect(outcome).toEqual({ status: 'coalesced', checkpointName: 'mastracode-repo-abc123' });
        expect(mockSandbox.checkpoint).toHaveBeenCalledTimes(1);

        vi.useRealTimers();
      });

      it('joins an in-flight timer refresh before stopping without capturing twice', async () => {
        vi.useFakeTimers();
        let releaseCheckpoint!: () => void;
        const held = new Promise<{ id: string; key: string; environmentId: string }>(resolve => {
          releaseCheckpoint = () =>
            resolve({ id: 'checkpoint-id', key: 'mastracode-repo-abc123', environmentId: 'env-1' });
        });
        mockSandbox.checkpoint.mockImplementationOnce(() => held);

        const sandbox = new RailwaySandbox({
          token: 'tok',
          checkpointName: 'mastracode-repo-abc123',
          idleTimeoutMinutes: 5,
        });
        await sandbox._start();
        await vi.advanceTimersByTimeAsync(2 * 60_000);

        const stopPromise = sandbox.stop();
        expect(mockSandbox.checkpoint).toHaveBeenCalledTimes(1);

        releaseCheckpoint();
        await stopPromise;

        expect(mockSandbox.checkpoint).toHaveBeenCalledTimes(1);
        expect(mockSandbox.destroy).toHaveBeenCalledTimes(1);
        vi.useRealTimers();
      });

      it('reschedules the safety-net timer relative to the on-demand capture', async () => {
        vi.useFakeTimers();
        mockCheckpoints.mockResolvedValueOnce([
          { id: 'checkpoint-id', key: 'mastracode-repo-abc123', environmentId: 'env-1' },
        ]);
        const sandbox = new RailwaySandbox({
          token: 'tok',
          checkpointName: 'mastracode-repo-abc123',
          idleTimeoutMinutes: 5,
        });
        await sandbox._start();
        expect(mockSandbox.checkpoint).not.toHaveBeenCalled();

        // Halfway to the safety-net fire, capture on demand.
        await vi.advanceTimersByTimeAsync(60_000);
        await sandbox.captureCheckpoint();
        expect(mockSandbox.checkpoint).toHaveBeenCalledTimes(1);

        // The old safety-net timer at t=120_000 should have been cancelled,
        // and a fresh one scheduled 2min out from now. Advance 119s — the
        // old timer's deadline arrives, no fire should occur.
        await vi.advanceTimersByTimeAsync(119_000);
        expect(mockSandbox.checkpoint).toHaveBeenCalledTimes(1);

        // 2min after capture, the fresh safety-net timer fires.
        await vi.advanceTimersByTimeAsync(1_000);
        expect(mockSandbox.checkpoint).toHaveBeenCalledTimes(2);

        vi.useRealTimers();
      });
    });
  });

  describe('fork', () => {
    it('forks a running sandbox into a new started RailwaySandbox', async () => {
      const sandbox = new RailwaySandbox({ token: 'tok', environmentId: 'env-1' });
      await sandbox._start();

      const child = await sandbox.fork({ idleTimeoutMinutes: 15 });

      expect(mockSandbox.fork).toHaveBeenCalledWith(expect.objectContaining({ idleTimeoutMinutes: 15 }));
      expect(mockConnect).not.toHaveBeenCalled();
      expect(mockCreate).toHaveBeenCalledTimes(2);
      expect(child).toBeInstanceOf(RailwaySandbox);
      expect(child.status).toBe('running');
      expect(child).not.toBe(sandbox);
    });

    it('throws SandboxNotReadyError when forking before start', async () => {
      const sandbox = new RailwaySandbox({ token: 'tok' });
      await expect(sandbox.fork()).rejects.toBeInstanceOf(SandboxNotReadyError);
    });
  });

  describe('clone', () => {
    it('constructs an unstarted sibling without any I/O', () => {
      const template = new RailwaySandbox({ token: 'tok', environmentId: 'env-1' });

      const child = template.clone({ id: 'mc-project-1' });

      expect(child).toBeInstanceOf(RailwaySandbox);
      expect(child).not.toBe(template);
      expect(child.id).toBe('mc-project-1');
      expect(child.status).toBe('pending');
      expect(mockCreate).not.toHaveBeenCalled();
      expect(mockConnect).not.toHaveBeenCalled();
    });

    it('does not require the template to be started', () => {
      const template = new RailwaySandbox({ token: 'tok' });
      expect(() => template.clone()).not.toThrow();
    });

    it('inherits credentials and applies env + idle timeout overrides on start', async () => {
      const template = new RailwaySandbox({
        token: 'tok',
        environmentId: 'env-1',
        idleTimeoutMinutes: 30,
        networkIsolation: 'PRIVATE',
      });

      const child = template.clone({
        env: { GITHUB_TOKEN: 'ghs_abc' },
        idleTimeoutMinutes: 15,
      });
      await child._start();

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          token: 'tok',
          environmentId: 'env-1',
          idleTimeoutMinutes: 15,
          networkIsolation: 'PRIVATE',
          env: { GITHUB_TOKEN: 'ghs_abc' },
        }),
      );
    });

    it('inherits checkpoint configuration when no override is passed', async () => {
      const template = new RailwaySandbox({ token: 'tok', checkpointName: 'root-checkpoint' });

      const child = template.clone({ id: 'mc-project-1' });
      await child._start();

      expect(mockCheckpoints).toHaveBeenCalledWith({ token: 'tok' });
      expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ token: 'tok' }));
      expect(mockSandbox.checkpoint).not.toHaveBeenCalled();
    });

    it('forwards seedCheckpointName to the cloned sandbox', async () => {
      mockCheckpoints.mockResolvedValueOnce([{ id: 'base-checkpoint-id', key: 'repo-base', environmentId: 'env-1' }]);
      const template = new RailwaySandbox({ token: 'tok' });

      const child = template.clone({
        id: 'mc-project-1',
        checkpointName: 'session-checkpoint',
        seedCheckpointName: 'repo-base',
      });
      await child._start();

      expect(mockCreate).toHaveBeenCalledWith('repo-base', expect.objectContaining({ token: 'tok' }));
    });

    it('uses a derived checkpoint override when restoring an existing checkpoint', async () => {
      mockCheckpoints.mockResolvedValueOnce([
        { id: 'checkpoint-id', key: 'session-checkpoint', environmentId: 'env-1' },
      ]);
      const template = new RailwaySandbox({ token: 'tok', checkpointName: 'root-checkpoint' });

      const child = template.clone({ id: 'mc-project-1', checkpointName: 'session-checkpoint' });
      await child._start();

      expect(mockCreate).toHaveBeenCalledWith('session-checkpoint', expect.objectContaining({ token: 'tok' }));
      expect(mockCreate).not.toHaveBeenCalledWith('root-checkpoint', expect.anything());
      expect(mockSandbox.checkpoint).not.toHaveBeenCalled();
    });
  });

  describe('executeCommand', () => {
    it('runs a command and maps a successful result after an explicit start', async () => {
      const sandbox = new RailwaySandbox({ token: 't' });
      await sandbox._start();
      const result = await sandbox.executeCommand!('echo hello');

      expect(result.success).toBe(true);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('ok');
      expect(result.command).toBe('echo hello');
    });

    it('maps a non-zero exit code to failure', async () => {
      mockSandbox.exec.mockImplementationOnce((_command: string, options?: { onStderr?: (c: string) => void }) =>
        makeExecHandle({ exitCode: 2, stderr: 'boom' }, options),
      );
      const sandbox = new RailwaySandbox({ token: 't' });
      await sandbox._start();
      const result = await sandbox.executeCommand!('false');

      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(2);
      expect(result.stderr).toBe('boom');
    });

    it('quotes args into the command', async () => {
      const sandbox = new RailwaySandbox({ token: 't' });
      await sandbox._start();
      await sandbox.executeCommand!('echo', ['a b']);

      const sentCommand = mockSandbox.exec.mock.calls[0]![0] as string;
      expect(sentCommand).toContain("'a b'");
    });

    it('passes timeoutSec derived from the timeout option', async () => {
      const sandbox = new RailwaySandbox({ token: 't' });
      await sandbox._start();
      await sandbox.executeCommand!('sleep 1', [], { timeout: 5000 });

      const sentOptions = mockSandbox.exec.mock.calls[0]![1] as { timeoutSec?: number };
      expect(sentOptions.timeoutSec).toBe(5);
    });

    it('setEnv after construction reaches subsequent commands', async () => {
      const sandbox = new RailwaySandbox({ token: 't' });
      await sandbox._start();

      sandbox.setEnv(env => ({ ...env, GH_TOKEN: 'tok_1' }));
      await sandbox.executeCommand!('echo hello');

      const sentOptions = mockSandbox.exec.mock.calls[0]![1] as { env?: Record<string, string> };
      expect(sentOptions.env).toEqual(expect.objectContaining({ GH_TOKEN: 'tok_1' }));
    });

    it('restarts a checkpoint-enabled sandbox when it is down before execution', async () => {
      const reconnectedSandbox = {
        ...mockSandbox,
        id: 'rw-sandbox-reconnected',
        status: 'RUNNING',
        exec: vi.fn((_command: string, options?: { onStdout?: (c: string) => void }) =>
          makeExecHandle({ exitCode: 0, stdout: 'after restart' }, options),
        ),
      };
      const sandbox = new RailwaySandbox({ token: 't', checkpointName: 'checkpoint' });
      await sandbox._start();
      const start = vi.spyOn(sandbox, 'start');
      mockSandbox.status = 'DESTROYED';
      mockConnect.mockResolvedValueOnce(reconnectedSandbox);

      const result = await sandbox.executeCommand!('echo hello');

      expect(start).toHaveBeenCalledOnce();
      expect(mockConnect).toHaveBeenCalledWith('rw-sandbox-123', expect.objectContaining({ token: 't' }));
      expect(reconnectedSandbox.exec).toHaveBeenCalledWith('echo hello', {});
      expect(result.stdout).toBe('after restart');
      expect(sandbox.status).toBe('running');
    });

    it('joins an in-flight start instead of throwing when executed concurrently', async () => {
      let releaseCreate!: (value: unknown) => void;
      mockCreate.mockReturnValueOnce(new Promise(resolve => (releaseCreate = resolve)));

      const sandbox = new RailwaySandbox({ token: 't', checkpointName: 'checkpoint' });
      const starting = sandbox._start();
      const executing = sandbox.executeCommand!('echo hello');

      releaseCreate(mockSandbox);
      await starting;
      const result = await executing;

      expect(result.exitCode).toBe(0);
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    it('throws instead of self-joining when executed inside the in-flight start (bootstrap reentrancy)', async () => {
      const sandbox = new RailwaySandbox({ token: 't', checkpointName: 'checkpoint' });
      // Simulate the base-class bootstrap window: status already 'running'
      // while the start attempt's promise is still in flight.
      (sandbox as any)._startPromise = new Promise(() => {});
      sandbox.status = 'running';

      await expect(sandbox.executeCommand!('echo hello')).rejects.toThrow(SandboxNotReadyError);
    });

    it('works without checkpointing after an explicit start', async () => {
      vi.useFakeTimers();
      const sandbox = new RailwaySandbox({ token: 't' });
      await sandbox._start();
      const result = await sandbox.executeCommand!('echo hello');
      await vi.advanceTimersByTimeAsync(30 * 60_000);

      expect(result.success).toBe(true);
      expect(mockCheckpoints).not.toHaveBeenCalled();
      expect(mockSandbox.checkpoint).not.toHaveBeenCalled();
      expect(mockDeleteCheckpoint).not.toHaveBeenCalled();
    });
  });

  describe('process manager', () => {
    it('spawns and waits on a process', async () => {
      const sandbox = new RailwaySandbox({ token: 't' });
      await sandbox._start();
      const handle = await sandbox.processes.spawn('node server.js');
      const result = await handle.wait();

      expect(result.exitCode).toBe(0);
      expect(handle.pid).toMatch(/^railway-proc-/);
    });

    it('lists tracked processes', async () => {
      const sandbox = new RailwaySandbox({ token: 't' });
      await sandbox._start();
      const handle = await sandbox.processes.spawn('node server.js');
      await handle.wait();

      const list = await sandbox.processes.list();
      expect(list.some(p => p.pid === handle.pid)).toBe(true);
    });

    it('kills a running process via signal', async () => {
      let killable: ReturnType<typeof makeExecHandle>;
      mockSandbox.exec.mockImplementationOnce(() => {
        // A handle that never resolves on its own, only via kill.
        type ExecResultShape = {
          exitCode: number | null;
          stdout: string;
          stderr: string;
          truncated: boolean;
          timedOut: boolean;
        };
        const promise = new Promise<ExecResultShape>(() => {}) as Promise<ExecResultShape> & {
          kill: ReturnType<typeof vi.fn>;
        };
        promise.kill = vi.fn().mockResolvedValue(true);
        killable = promise;
        return promise;
      });

      const sandbox = new RailwaySandbox({ token: 't' });
      await sandbox._start();
      const handle = await sandbox.processes.spawn('sleep 1000');
      const killed = await handle.kill();

      expect(killed).toBe(true);
      expect(killable!.kill).toHaveBeenCalledWith('TERM');
    });
  });

  describe('getInfo / getInstructions', () => {
    it('returns sandbox info with railway metadata after start', async () => {
      const sandbox = new RailwaySandbox({ token: 't' });
      await sandbox._start();
      const info = await sandbox.getInfo();

      expect(info.provider).toBe('railway');
      expect(info.metadata).toMatchObject({
        railwaySandboxId: 'rw-sandbox-123',
        environmentId: 'env-1',
        region: 'us-west',
        networkIsolation: 'ISOLATED',
      });
    });

    it('builds default instructions and honors overrides', () => {
      const sandbox = new RailwaySandbox({ token: 't', networkIsolation: 'PRIVATE' });
      expect(sandbox.getInstructions()).toContain('private network');

      const overridden = new RailwaySandbox({ token: 't', instructions: 'custom' });
      expect(overridden.getInstructions()).toBe('custom');

      const fn = new RailwaySandbox({
        token: 't',
        instructions: ({ defaultInstructions }) => `${defaultInstructions} extra`,
      });
      expect(fn.getInstructions()).toContain('extra');
    });
  });
});

describe('exec cwd/env passthrough', () => {
  beforeEach(() => {
    mockCreate.mockReset().mockResolvedValue(mockSandbox);
    mockSandbox.exec.mockReset();
    mockSandbox.exec.mockImplementation((_command: string, options?: { onStdout?: (c: string) => void }) =>
      makeExecHandle({ exitCode: 0, stdout: 'ok' }, options),
    );
  });

  it('passes cwd to exec options', async () => {
    const sandbox = new RailwaySandbox({ token: 't' });
    await sandbox._start();
    await sandbox.processes.spawn('ls', { cwd: '/app' });

    const sentOptions = mockSandbox.exec.mock.calls[0]![1] as { cwd?: string };
    expect(sentOptions.cwd).toBe('/app');
  });

  it('passes env to exec options', async () => {
    const sandbox = new RailwaySandbox({ token: 't', env: { FOO: 'bar' } });
    await sandbox._start();
    await sandbox.processes.spawn('printenv FOO');

    const sentOptions = mockSandbox.exec.mock.calls[0]![1] as { env?: Record<string, string> };
    expect(sentOptions.env).toEqual({ FOO: 'bar' });
  });

  it('merges default env with per-spawn env', async () => {
    const sandbox = new RailwaySandbox({ token: 't', env: { A: '1' } });
    await sandbox._start();
    await sandbox.processes.spawn('env', { env: { B: '2' } });

    const sentOptions = mockSandbox.exec.mock.calls[0]![1] as { env?: Record<string, string> };
    expect(sentOptions.env).toEqual({ A: '1', B: '2' });
  });

  it('filters undefined per-spawn env values', async () => {
    const sandbox = new RailwaySandbox({ token: 't', env: { A: '1' } });
    await sandbox._start();
    await sandbox.processes.spawn('env', { env: { B: undefined } });

    const sentOptions = mockSandbox.exec.mock.calls[0]![1] as { env?: Record<string, string> };
    expect(sentOptions.env).toEqual({ A: '1' });
  });

  it('does not include cwd or env when not provided', async () => {
    const sandbox = new RailwaySandbox({ token: 't' });
    await sandbox._start();
    await sandbox.processes.spawn('echo hi');

    const sentOptions = mockSandbox.exec.mock.calls[0]![1] as Record<string, unknown>;
    expect(sentOptions).not.toHaveProperty('cwd');
    expect(sentOptions).not.toHaveProperty('env');
    expect(sandbox.workingDirectory).toBeUndefined();
  });

  it('spawn defaults cwd to the configured workingDirectory', async () => {
    const sandbox = new RailwaySandbox({ token: 't', workingDirectory: '/srv/app' });
    await sandbox._start();
    await sandbox.processes.spawn('ls');

    const sentOptions = mockSandbox.exec.mock.calls[0]![1] as { cwd?: string };
    expect(sentOptions.cwd).toBe('/srv/app');
    expect(sandbox.workingDirectory).toBe('/srv/app');
  });

  it('per-spawn cwd wins over the configured workingDirectory', async () => {
    const sandbox = new RailwaySandbox({ token: 't', workingDirectory: '/srv/app' });
    await sandbox._start();
    await sandbox.processes.spawn('ls', { cwd: '/app' });

    const sentOptions = mockSandbox.exec.mock.calls[0]![1] as { cwd?: string };
    expect(sentOptions.cwd).toBe('/app');
  });

  it('executeCommand defaults cwd to the configured workingDirectory', async () => {
    const sandbox = new RailwaySandbox({ token: 't', workingDirectory: '/srv/app' });
    await sandbox._start();
    await sandbox.executeCommand('pwd');

    const sentOptions = mockSandbox.exec.mock.calls[0]![1] as { cwd?: string };
    expect(sentOptions.cwd).toBe('/srv/app');
  });
});
