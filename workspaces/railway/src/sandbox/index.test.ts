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
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { RailwaySandbox } from './index';

// =============================================================================
// Mock the Railway SDK
// =============================================================================

const {
  mockSandbox,
  mockForkedSandbox,
  mockTemplate,
  mockCreate,
  mockConnect,
  mockCheckpoints,
  mockDeleteCheckpoint,
  mockTemplateFactory,
  makeExecHandle,
  MockSandboxNotFoundError,
  MockSandboxFailedError,
  MockRailwayConnectionError,
  MockRailwayGraphQLError,
  MockSandboxTimeoutError,
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

  // Chainable template builder mock.
  const mockTemplate = {
    run: vi.fn(() => mockTemplate),
    withPackages: vi.fn(() => mockTemplate),
    withEnv: vi.fn(() => mockTemplate),
    workdir: vi.fn(() => mockTemplate),
    build: vi.fn(() => Promise.resolve(mockTemplate)),
    compile: vi.fn(() => ({ instructions: ['echo setup1', 'echo setup2'] })),
  };

  const mockCreate = vi.fn().mockResolvedValue(mockSandbox);
  const mockConnect = vi.fn().mockResolvedValue(mockSandbox);
  const mockCheckpoints = vi.fn().mockResolvedValue([]);
  const mockDeleteCheckpoint = vi.fn().mockResolvedValue(undefined);
  const mockTemplateFactory = vi.fn(() => mockTemplate);

  class MockSandboxNotFoundError extends Error {
    name = 'SandboxNotFoundError';
  }

  class MockSandboxFailedError extends Error {
    name = 'SandboxFailedError';
  }

  class MockRailwayConnectionError extends Error {
    name = 'RailwayConnectionError';
  }

  class MockRailwayGraphQLError extends Error {
    name = 'RailwayGraphQLError';
  }

  class MockSandboxTimeoutError extends Error {
    name = 'SandboxTimeoutError';
    resource = 'sandbox';
  }

  return {
    mockSandbox,
    mockForkedSandbox,
    mockTemplate,
    mockCreate,
    mockConnect,
    mockCheckpoints,
    mockDeleteCheckpoint,
    mockTemplateFactory,
    makeExecHandle,
    MockSandboxNotFoundError,
    MockSandboxFailedError,
    MockRailwayConnectionError,
    MockRailwayGraphQLError,
    MockSandboxTimeoutError,
  };
});

vi.mock('railway', () => ({
  Sandbox: {
    create: mockCreate,
    connect: mockConnect,
    checkpoints: mockCheckpoints,
    deleteCheckpoint: mockDeleteCheckpoint,
    template: mockTemplateFactory,
  },
  SandboxNotFoundError: MockSandboxNotFoundError,
  SandboxFailedError: MockSandboxFailedError,
  RailwayConnectionError: MockRailwayConnectionError,
  RailwayGraphQLError: MockRailwayGraphQLError,
  SandboxTimeoutError: MockSandboxTimeoutError,
}));

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
    mockTemplateFactory.mockReset().mockReturnValue(mockTemplate);
    mockTemplate.run.mockReset().mockReturnValue(mockTemplate);
    mockTemplate.withPackages.mockReset().mockReturnValue(mockTemplate);
    mockTemplate.withEnv.mockReset().mockReturnValue(mockTemplate);
    mockTemplate.workdir.mockReset().mockReturnValue(mockTemplate);
    mockTemplate.build.mockReset().mockResolvedValue(mockTemplate);
    mockTemplate.compile.mockReset().mockReturnValue({ instructions: ['echo setup1', 'echo setup2'] });
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

    it('reconnects to an existing sandbox when sandboxId is set', async () => {
      const sandbox = new RailwaySandbox({ token: 'tok', sandboxId: 'rw-existing' });
      await sandbox._start();

      expect(mockConnect).toHaveBeenCalledWith('rw-existing', expect.objectContaining({ token: 'tok' }));
      expect(mockCreate).not.toHaveBeenCalled();
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

  describe('template', () => {
    it('resolves a template from a builder callback and creates from it', async () => {
      const sandbox = new RailwaySandbox({
        token: 'tok',
        template: t => t.withPackages('git', 'curl').run('npm i -g pnpm'),
      });
      await sandbox._start();

      expect(mockTemplateFactory).toHaveBeenCalledTimes(1);
      expect(mockTemplate.withPackages).toHaveBeenCalledWith('git', 'curl');
      expect(mockTemplate.run).toHaveBeenCalledWith('npm i -g pnpm');
      expect(mockTemplate.build).not.toHaveBeenCalled();
      // create(template, options) — Railway builds the template during create
      expect(mockCreate).toHaveBeenCalledWith(mockTemplate, expect.objectContaining({ token: 'tok' }));
    });

    it('accepts a pre-built template instance without calling the factory', async () => {
      const sandbox = new RailwaySandbox({ token: 'tok', template: mockTemplate as never });
      await sandbox._start();

      expect(mockTemplateFactory).not.toHaveBeenCalled();
      expect(mockTemplate.build).not.toHaveBeenCalled();
      expect(mockCreate).toHaveBeenCalledWith(mockTemplate, expect.objectContaining({ token: 'tok' }));
    });

    it('ignores the template when reattaching by sandboxId', async () => {
      const sandbox = new RailwaySandbox({
        token: 'tok',
        sandboxId: 'rw-existing',
        template: t => t.run('echo hi'),
      });
      await sandbox._start();

      expect(mockConnect).toHaveBeenCalledWith('rw-existing', expect.anything());
      expect(mockTemplateFactory).not.toHaveBeenCalled();
      expect(mockTemplate.build).not.toHaveBeenCalled();
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('restores from a saved checkpoint without deleting it', async () => {
      mockCheckpoints.mockResolvedValueOnce([
        { id: 'checkpoint-id', key: 'mastracode-repo-abc123', environmentId: 'env-1' },
      ]);
      const sandbox = new RailwaySandbox({ token: 'tok', checkpointName: 'mastracode-repo-abc123' });
      await sandbox._start();

      expect(mockCreate).toHaveBeenCalledWith('mastracode-repo-abc123', expect.objectContaining({ token: 'tok' }));
      expect(mockDeleteCheckpoint).not.toHaveBeenCalled();
      expect(mockTemplateFactory).not.toHaveBeenCalled();
      expect(mockSandbox.checkpoint).not.toHaveBeenCalled();
      expect(sandbox.status).toBe('running');
    });

    it('creates from template and captures a checkpoint when the checkpoint is missing', async () => {
      mockCreate.mockRejectedValueOnce(new Error('checkpoint not found')).mockResolvedValueOnce(mockSandbox);

      const sandbox = new RailwaySandbox({
        token: 'tok',
        checkpointName: 'mastracode-repo-abc123',
        template: t => t.run('npm i -g pnpm'),
      });
      await sandbox._start();

      expect(mockCreate).toHaveBeenNthCalledWith(
        1,
        'mastracode-repo-abc123',
        expect.objectContaining({ token: 'tok' }),
      );
      expect(mockCreate).toHaveBeenNthCalledWith(2, mockTemplate, expect.objectContaining({ token: 'tok' }));
      expect(mockSandbox.checkpoint).toHaveBeenCalledWith('mastracode-repo-abc123');
      expect(sandbox.status).toBe('running');
    });

    it('refreshes the checkpoint shortly before the sandbox idle timeout', async () => {
      vi.useFakeTimers();
      mockCreate.mockRejectedValueOnce(new Error('checkpoint not found')).mockResolvedValueOnce(mockSandbox);

      const sandbox = new RailwaySandbox({
        token: 'tok',
        checkpointName: 'mastracode-repo-abc123',
        idleTimeoutMinutes: 1,
        template: t => t.run('npm i -g pnpm'),
      });
      await sandbox._start();
      expect(mockSandbox.checkpoint).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(50_000);

      expect(mockDeleteCheckpoint).not.toHaveBeenCalled();
      expect(mockSandbox.checkpoint).toHaveBeenCalledTimes(2);
      expect(mockSandbox.checkpoint).toHaveBeenLastCalledWith('mastracode-repo-abc123');
    });

    it('uses the Railway sandbox idle timeout when scheduling checkpoint refresh', async () => {
      vi.useFakeTimers();
      mockCreate.mockRejectedValueOnce(new Error('checkpoint not found')).mockResolvedValueOnce(mockSandbox);

      const sandbox = new RailwaySandbox({
        token: 'tok',
        checkpointName: 'mastracode-repo-abc123',
        template: t => t.run('npm i -g pnpm'),
      });
      await sandbox._start();
      expect(mockSandbox.checkpoint).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(30 * 60_000 - 10_000);

      expect(mockSandbox.checkpoint).toHaveBeenCalledTimes(2);
      expect(mockSandbox.checkpoint).toHaveBeenLastCalledWith('mastracode-repo-abc123');
    });
  });

  describe('fork', () => {
    it('forks a running sandbox into a new started RailwaySandbox', async () => {
      const sandbox = new RailwaySandbox({ token: 'tok', environmentId: 'env-1' });
      await sandbox._start();

      const child = await sandbox.fork({ idleTimeoutMinutes: 15 });

      expect(mockSandbox.fork).toHaveBeenCalledWith(expect.objectContaining({ idleTimeoutMinutes: 15 }));
      // The child reattaches to the forked sandbox id via connect().
      expect(mockConnect).toHaveBeenCalledWith('rw-forked-456', expect.objectContaining({ token: 'tok' }));
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

    it('reattaches to a provider sandbox when sandboxId is passed', async () => {
      const template = new RailwaySandbox({ token: 'tok', environmentId: 'env-1' });

      const child = template.clone({ sandboxId: 'rw-sandbox-123' });
      await child._start();

      expect(mockConnect).toHaveBeenCalledWith(
        'rw-sandbox-123',
        expect.objectContaining({ token: 'tok', environmentId: 'env-1' }),
      );
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('inherits template defaults when no overrides are passed', async () => {
      const template = new RailwaySandbox({
        token: 'tok',
        idleTimeoutMinutes: 45,
        env: { BASE: '1' },
      });

      const child = template.clone();
      await child._start();

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ token: 'tok', idleTimeoutMinutes: 45, env: { BASE: '1' } }),
      );
    });

    it('inherits the template checkpoint name when no override is passed', async () => {
      mockCreate.mockRejectedValueOnce(new Error('checkpoint not found')).mockResolvedValueOnce(mockSandbox);
      const template = new RailwaySandbox({ token: 'tok', checkpointName: 'root-checkpoint' });

      const child = template.clone({ id: 'mc-project-1' });
      await child._start();

      expect(mockCreate).toHaveBeenNthCalledWith(1, 'root-checkpoint', expect.objectContaining({ token: 'tok' }));
      expect(mockSandbox.checkpoint).toHaveBeenCalledWith('root-checkpoint');
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

    it('uses a derived checkpoint override when capturing a missing checkpoint', async () => {
      mockCreate.mockRejectedValueOnce(new Error('checkpoint not found')).mockResolvedValueOnce(mockSandbox);
      const template = new RailwaySandbox({
        token: 'tok',
        checkpointName: 'root-checkpoint',
        template: t => t.run('npm i -g pnpm'),
      });

      const child = template.clone({ id: 'mc-project-1', checkpointName: 'session-checkpoint' });
      await child._start();

      expect(mockCreate).toHaveBeenNthCalledWith(1, 'session-checkpoint', expect.objectContaining({ token: 'tok' }));
      expect(mockCreate).toHaveBeenNthCalledWith(2, mockTemplate, expect.objectContaining({ token: 'tok' }));
      expect(mockSandbox.checkpoint).toHaveBeenCalledWith('session-checkpoint');
      expect(mockSandbox.checkpoint).not.toHaveBeenCalledWith('root-checkpoint');
    });
  });

  describe('executeCommand', () => {
    it('runs a command and maps a successful result', async () => {
      const sandbox = new RailwaySandbox({ token: 't' });
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
      const result = await sandbox.executeCommand!('false');

      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(2);
      expect(result.stderr).toBe('boom');
    });

    it('quotes args into the command', async () => {
      const sandbox = new RailwaySandbox({ token: 't' });
      await sandbox.executeCommand!('echo', ['a b']);

      const sentCommand = mockSandbox.exec.mock.calls[0]![0] as string;
      expect(sentCommand).toContain("'a b'");
    });

    it('passes timeoutSec derived from the timeout option', async () => {
      const sandbox = new RailwaySandbox({ token: 't' });
      await sandbox.executeCommand!('sleep 1', [], { timeout: 5000 });

      const sentOptions = mockSandbox.exec.mock.calls[0]![1] as { timeoutSec?: number };
      expect(sentOptions.timeoutSec).toBe(5);
    });

    it('reconnects and retries when the sandbox is unavailable', async () => {
      const reconnectedSandbox = {
        ...mockSandbox,
        id: 'rw-sandbox-123',
        exec: vi.fn((_command: string, options?: { onStdout?: (c: string) => void }) =>
          makeExecHandle({ exitCode: 0, stdout: 'after reconnect' }, options),
        ),
      };
      mockSandbox.exec.mockRejectedValueOnce(new MockSandboxNotFoundError('sandbox destroyed'));
      mockConnect.mockResolvedValueOnce(reconnectedSandbox);

      const sandbox = new RailwaySandbox({ token: 't' });
      const result = await sandbox.executeCommand!('echo hello');

      expect(mockConnect).toHaveBeenCalledWith('rw-sandbox-123', expect.objectContaining({ token: 't' }));
      expect(mockSandbox.exec).toHaveBeenCalledTimes(1);
      expect(reconnectedSandbox.exec).toHaveBeenCalledTimes(1);
      expect(result.success).toBe(true);
      expect(result.stdout).toBe('after reconnect');
    });

    it('reconnects and retries when the SDK wraps a connection error in cause', async () => {
      const reconnectedSandbox = {
        ...mockSandbox,
        id: 'rw-sandbox-123',
        exec: vi.fn((_command: string, options?: { onStdout?: (c: string) => void }) =>
          makeExecHandle({ exitCode: 0, stdout: 'after reconnect' }, options),
        ),
      };
      const wrappedError = Object.assign(new Error('tool execution failed'), {
        cause: new MockRailwayConnectionError(
          'tcp-proxy files WebSocket closed (code 1008: Sandbox is not running (status: DESTROYED).)',
        ),
      });
      mockSandbox.exec.mockRejectedValueOnce(wrappedError);
      mockConnect.mockResolvedValueOnce(reconnectedSandbox);

      const sandbox = new RailwaySandbox({ token: 't' });
      const result = await sandbox.executeCommand!('echo hello');

      expect(mockConnect).toHaveBeenCalledWith('rw-sandbox-123', expect.objectContaining({ token: 't' }));
      expect(mockSandbox.exec).toHaveBeenCalledTimes(1);
      expect(reconnectedSandbox.exec).toHaveBeenCalledTimes(1);
      expect(result.success).toBe(true);
      expect(result.stdout).toBe('after reconnect');
    });

    it('reconnects and retries when the SDK wraps a serialized connection error in cause', async () => {
      const reconnectedSandbox = {
        ...mockSandbox,
        id: 'rw-sandbox-123',
        exec: vi.fn((_command: string, options?: { onStdout?: (c: string) => void }) =>
          makeExecHandle({ exitCode: 0, stdout: 'after reconnect' }, options),
        ),
      };
      const wrappedError = Object.assign(new Error('tool execution failed'), {
        cause: {
          name: 'RailwayConnectionError',
          message: 'tcp-proxy files WebSocket closed (code 1008: Sandbox is not running (status: DESTROYED).)',
          closeCode: 1008,
        },
      });
      mockSandbox.exec.mockRejectedValueOnce(wrappedError);
      mockConnect.mockResolvedValueOnce(reconnectedSandbox);

      const sandbox = new RailwaySandbox({ token: 't' });
      const result = await sandbox.executeCommand!('echo hello');

      expect(mockConnect).toHaveBeenCalledWith('rw-sandbox-123', expect.objectContaining({ token: 't' }));
      expect(mockSandbox.exec).toHaveBeenCalledTimes(1);
      expect(reconnectedSandbox.exec).toHaveBeenCalledTimes(1);
      expect(result.success).toBe(true);
      expect(result.stdout).toBe('after reconnect');
    });

    it('creates a new sandbox when reconnect returns a destroyed sandbox', async () => {
      const destroyedSandbox = { ...mockSandbox, status: 'DESTROYED' };
      const recreatedSandbox = {
        ...mockSandbox,
        id: 'rw-sandbox-new',
        exec: vi.fn((_command: string, options?: { onStdout?: (c: string) => void }) =>
          makeExecHandle({ exitCode: 0, stdout: 'after recreate' }, options),
        ),
      };
      mockSandbox.exec.mockRejectedValueOnce(new MockSandboxNotFoundError('sandbox destroyed'));
      mockConnect.mockResolvedValueOnce(destroyedSandbox);
      mockCreate.mockResolvedValueOnce(mockSandbox).mockResolvedValueOnce(recreatedSandbox);

      const sandbox = new RailwaySandbox({ token: 't' });
      const result = await sandbox.executeCommand!('echo hello');

      expect(mockConnect).toHaveBeenCalledWith('rw-sandbox-123', expect.objectContaining({ token: 't' }));
      expect(mockCreate).toHaveBeenCalledTimes(2);
      expect(recreatedSandbox.exec).toHaveBeenCalledTimes(1);
      expect(result.success).toBe(true);
      expect(result.stdout).toBe('after recreate');
    });

    it('creates a new sandbox when reconnect after an unavailable operation fails', async () => {
      const recreatedSandbox = {
        ...mockSandbox,
        id: 'rw-sandbox-new',
        exec: vi.fn((_command: string, options?: { onStdout?: (c: string) => void }) =>
          makeExecHandle({ exitCode: 0, stdout: 'after recreate' }, options),
        ),
      };
      mockSandbox.exec.mockRejectedValueOnce(new MockSandboxNotFoundError('sandbox destroyed'));
      mockConnect.mockRejectedValueOnce(new MockSandboxNotFoundError('sandbox gone'));
      mockCreate.mockResolvedValueOnce(mockSandbox).mockResolvedValueOnce(recreatedSandbox);

      const sandbox = new RailwaySandbox({ token: 't' });
      const result = await sandbox.executeCommand!('echo hello');

      expect(mockConnect).toHaveBeenCalledWith('rw-sandbox-123', expect.objectContaining({ token: 't' }));
      expect(mockCreate).toHaveBeenCalledTimes(2);
      expect(recreatedSandbox.exec).toHaveBeenCalledTimes(1);
      expect(result.success).toBe(true);
      expect(result.stdout).toBe('after recreate');
    });

    it('throws when the retry after restart fails again', async () => {
      const reconnectedSandbox = {
        ...mockSandbox,
        id: 'rw-sandbox-123',
        exec: vi.fn().mockRejectedValue(new MockSandboxNotFoundError('still gone')),
      };
      mockSandbox.exec.mockRejectedValueOnce(new MockSandboxNotFoundError('sandbox destroyed'));
      mockConnect.mockResolvedValueOnce(reconnectedSandbox);

      const sandbox = new RailwaySandbox({ token: 't' });
      await expect(sandbox.executeCommand!('echo hello')).rejects.toThrow('still gone');

      expect(mockSandbox.exec).toHaveBeenCalledTimes(1);
      expect(reconnectedSandbox.exec).toHaveBeenCalledTimes(1);
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
  });
});
