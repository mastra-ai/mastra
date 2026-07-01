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

const { mockSandbox, mockForkedSandbox, mockTemplate, mockCreate, mockConnect, mockTemplateFactory, makeExecHandle } =
  vi.hoisted(() => {
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
      destroy: vi.fn().mockResolvedValue(undefined),
    };

    // Chainable template builder mock.
    const mockTemplate = {
      run: vi.fn(() => mockTemplate),
      withPackages: vi.fn(() => mockTemplate),
      withEnv: vi.fn(() => mockTemplate),
      workdir: vi.fn(() => mockTemplate),
      build: vi.fn(() => Promise.resolve(mockTemplate)),
    };

    const mockCreate = vi.fn().mockResolvedValue(mockSandbox);
    const mockConnect = vi.fn().mockResolvedValue(mockSandbox);
    const mockTemplateFactory = vi.fn(() => mockTemplate);

    return {
      mockSandbox,
      mockForkedSandbox,
      mockTemplate,
      mockCreate,
      mockConnect,
      mockTemplateFactory,
      makeExecHandle,
    };
  });

vi.mock('railway', () => ({
  Sandbox: {
    create: mockCreate,
    connect: mockConnect,
    template: mockTemplateFactory,
  },
}));

// =============================================================================
// Tests
// =============================================================================

describe('RailwaySandbox', () => {
  beforeEach(() => {
    mockCreate.mockClear().mockResolvedValue(mockSandbox);
    mockConnect.mockClear().mockResolvedValue(mockSandbox);
    mockTemplateFactory.mockClear().mockReturnValue(mockTemplate);
    mockTemplate.run.mockClear().mockReturnValue(mockTemplate);
    mockTemplate.withPackages.mockClear().mockReturnValue(mockTemplate);
    mockTemplate.withEnv.mockClear().mockReturnValue(mockTemplate);
    mockTemplate.workdir.mockClear().mockReturnValue(mockTemplate);
    mockTemplate.build.mockClear().mockResolvedValue(mockTemplate);
    mockSandbox.exec.mockClear();
    mockSandbox.fork.mockClear().mockResolvedValue(mockForkedSandbox);
    mockSandbox.destroy.mockClear().mockResolvedValue(undefined);
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
    mockCreate.mockClear().mockResolvedValue(mockSandbox);
    mockSandbox.exec.mockClear();
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
