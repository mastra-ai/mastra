/**
 * MastraSandbox Base Class Tests
 *
 * Tests the abstract base class functionality including:
 * - MountManager creation based on mount() implementation
 * - Logger propagation to MountManager
 *
 * Based on the Workspace Filesystem & Sandbox Test Plan.
 */

import { describe, it, expect, vi } from 'vitest';

import type { IMastraLogger } from '../../logger';
import type { WorkspaceFilesystem } from '../filesystem/filesystem';
import type { MountResult } from '../filesystem/mount';
import type { ProviderStatus } from '../lifecycle';

import { MastraSandbox } from './mastra-sandbox';
import type { MastraSandboxOptions } from './mastra-sandbox';
import type { MountManager } from './mount-manager';
import { ProcessHandle, SandboxProcessManager } from './process-manager';
import type { SpawnProcessOptions } from './process-manager';
import type { CommandResult } from './types';

/**
 * Concrete implementation of MastraSandbox WITH mount() method.
 */
class MountableSandbox extends MastraSandbox {
  // Declare mounts as non-optional for this class
  declare readonly mounts: MountManager;

  readonly id = 'test-mountable-sandbox';
  readonly name = 'MountableSandbox';
  readonly provider = 'test';
  status: ProviderStatus = 'pending';

  /** Track lifecycle calls for ordering verification */
  readonly calls: string[] = [];

  constructor(options?: MastraSandboxOptions) {
    super({ ...options, name: 'MountableSandbox' });
  }

  async start(): Promise<void> {
    this.calls.push('start');
  }

  async stop(): Promise<void> {
    this.calls.push('stop');
  }

  async destroy(): Promise<void> {
    this.calls.push('destroy');
  }

  async mount(_filesystem: WorkspaceFilesystem, mountPath: string): Promise<MountResult> {
    return { success: true, mountPath };
  }

  async unmount(_mountPath: string): Promise<void> {
    // no-op
  }

  async executeCommand(
    command: string,
    args?: string[],
  ): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    return { exitCode: 0, stdout: `${command} ${args?.join(' ') || ''}`, stderr: '' };
  }
}

/**
 * Concrete implementation of MastraSandbox WITHOUT mount() method.
 */
class NonMountableSandbox extends MastraSandbox {
  readonly id = 'test-non-mountable-sandbox';
  readonly name = 'NonMountableSandbox';
  readonly provider = 'test';
  status: ProviderStatus = 'pending';

  constructor() {
    super({ name: 'NonMountableSandbox' });
  }

  async executeCommand(
    command: string,
    args?: string[],
  ): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    return { exitCode: 0, stdout: `${command} ${args?.join(' ') || ''}`, stderr: '' };
  }
}

class ExecuteCommandProcessHandle extends ProcessHandle {
  readonly pid = 'execute-command-process';
  exitCode: number | undefined;

  constructor(
    options: SpawnProcessOptions | undefined,
    private readonly output: string,
  ) {
    super(options);
  }

  async wait(): Promise<CommandResult> {
    this.emitStdout(this.output);
    this.exitCode = 0;
    return {
      success: true,
      exitCode: 0,
      stdout: this.stdout,
      stderr: this.stderr,
      executionTimeMs: 0,
    };
  }

  async kill(): Promise<boolean> {
    this.exitCode = 137;
    return true;
  }

  async sendStdin(): Promise<void> {}

  async closeStdin(): Promise<void> {}
}

class ExecuteCommandProcessManager extends SandboxProcessManager {
  lastOptions: SpawnProcessOptions | undefined;

  constructor(private readonly output: string) {
    super();
  }

  async spawn(_command: string, options?: SpawnProcessOptions): Promise<ProcessHandle> {
    this.lastOptions = options;
    return new ExecuteCommandProcessHandle(options, this.output);
  }

  async list(): Promise<[]> {
    return [];
  }
}

class ProcessBackedSandbox extends MastraSandbox {
  readonly id = 'test-process-backed-sandbox';
  readonly name = 'ProcessBackedSandbox';
  readonly provider = 'test';
  status: ProviderStatus = 'pending';

  constructor(processes: SandboxProcessManager, env?: Record<string, string | undefined>) {
    super({ name: 'ProcessBackedSandbox', processes, env });
  }
}

/**
 * Create a mock logger for testing.
 */
function createMockLogger(): IMastraLogger {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  } as unknown as IMastraLogger;
}

describe('MastraSandbox Base Class', () => {
  describe('MountManager Creation', () => {
    it('constructor creates MountManager if mount() implemented', () => {
      const sandbox = new MountableSandbox();

      expect(sandbox.mounts).toBeDefined();
      expect(sandbox.mounts.entries).toBeInstanceOf(Map);
    });

    it('constructor does not create MountManager if mount() not implemented', () => {
      const sandbox = new NonMountableSandbox();

      expect(sandbox.mounts).toBeUndefined();
    });

    it('MountManager receives mount function bound to sandbox', async () => {
      const sandbox = new MountableSandbox();

      // Create a mock filesystem with getMountConfig
      const mockFilesystem = {
        id: 'test-fs',
        name: 'TestFS',
        provider: 'test',
        status: 'ready',
        getMountConfig: () => ({ type: 's3', bucket: 'test' }),
      } as unknown as WorkspaceFilesystem;

      // Add filesystem to mounts
      sandbox.mounts.add({ '/test': mockFilesystem });

      // Start sandbox to trigger processPending
      await sandbox._start();

      // The mount should have been processed
      expect(sandbox.mounts.get('/test')?.state).toBe('mounted');
    });
  });

  describe('Logger Propagation', () => {
    it('__setLogger propagates to MountManager', () => {
      const sandbox = new MountableSandbox();
      const mockLogger = createMockLogger();

      // Spy on MountManager's __setLogger
      const setLoggerSpy = vi.spyOn(sandbox.mounts, '__setLogger');

      sandbox.__setLogger(mockLogger);

      expect(setLoggerSpy).toHaveBeenCalledWith(mockLogger);
    });

    it('__setLogger does not error when mounts is undefined', () => {
      const sandbox = new NonMountableSandbox();
      const mockLogger = createMockLogger();

      // Should not throw
      expect(() => sandbox.__setLogger(mockLogger)).not.toThrow();
    });

    it('logger is available in subclass after __setLogger', () => {
      const sandbox = new MountableSandbox();
      const mockLogger = createMockLogger();

      sandbox.__setLogger(mockLogger);

      // Access the logger via a method that uses it
      // The sandbox's internal logger should now be the mock
      expect(sandbox['logger']).toBeDefined();
    });
  });

  describe('Snapshot', () => {
    it('resolves as a no-op by default', async () => {
      const sandbox = new MountableSandbox();

      await expect(sandbox.snapshot()).resolves.toBeUndefined();
    });
  });

  describe('Lifecycle Methods', () => {
    it('_start() sets status to running', async () => {
      const sandbox = new MountableSandbox();

      expect(sandbox.status).toBe('pending');

      await sandbox._start();

      expect(sandbox.status).toBe('running');
    });

    it('_start() processes pending mounts after startup', async () => {
      const sandbox = new MountableSandbox();
      const mockFilesystem = {
        id: 'test-fs',
        name: 'TestFS',
        provider: 'test',
        status: 'ready',
        getMountConfig: () => ({ type: 's3', bucket: 'test' }),
      } as unknown as WorkspaceFilesystem;

      // Add pending mount before start
      sandbox.mounts.add({ '/data': mockFilesystem });

      expect(sandbox.mounts.get('/data')?.state).toBe('pending');

      await sandbox._start();

      // After start, mount should be processed
      expect(sandbox.mounts.get('/data')?.state).toBe('mounted');
    });

    it('_stop() sets status to stopped', async () => {
      const sandbox = new MountableSandbox();
      await sandbox._start();

      expect(sandbox.status).toBe('running');

      await sandbox._stop();

      expect(sandbox.status).toBe('stopped');
    });

    it('_destroy() sets status to destroyed', async () => {
      const sandbox = new MountableSandbox();
      await sandbox._start();

      await sandbox._destroy();

      expect(sandbox.status).toBe('destroyed');
    });

    it('_start() on destroyed sandbox throws', async () => {
      const sandbox = new MountableSandbox();
      await sandbox._start();
      await sandbox._destroy();

      await expect(sandbox._start()).rejects.toThrow(/destroyed/);
    });
  });

  describe('Lifecycle Hooks', () => {
    it('onStart fires after sandbox is running', async () => {
      let statusDuringHook: ProviderStatus | undefined;

      const sandbox = new MountableSandbox({
        onStart: ({ sandbox: s }) => {
          statusDuringHook = s.status;
        },
      });

      await sandbox._start();

      expect(statusDuringHook).toBe('running');
    });

    it('onStart fires after start() but before mount processing', async () => {
      const sandbox = new MountableSandbox({
        onStart: () => {
          sandbox.calls.push('onStart');
        },
      });

      const processPendingSpy = vi.spyOn(sandbox.mounts, 'processPending').mockImplementation(async () => {
        sandbox.calls.push('processPending');
      });

      await sandbox._start();

      expect(sandbox.calls).toEqual(['start', 'onStart', 'processPending']);

      processPendingSpy.mockRestore();
    });

    it('onStop fires before stop()', async () => {
      const sandbox = new MountableSandbox({
        onStop: () => {
          sandbox.calls.push('onStop');
        },
      });

      await sandbox._start();
      sandbox.calls.length = 0; // reset after start

      await sandbox._stop();

      expect(sandbox.calls).toEqual(['onStop', 'stop']);
    });

    it('onDestroy fires before destroy()', async () => {
      const sandbox = new MountableSandbox({
        onDestroy: () => {
          sandbox.calls.push('onDestroy');
        },
      });

      await sandbox._start();
      sandbox.calls.length = 0;

      await sandbox._destroy();

      expect(sandbox.calls).toEqual(['onDestroy', 'destroy']);
    });

    it('hooks receive { sandbox } arg referencing the sandbox instance', async () => {
      let receivedArg: unknown;

      const sandbox = new MountableSandbox({
        onStart: arg => {
          receivedArg = arg;
        },
      });

      await sandbox._start();

      expect(receivedArg).toEqual({ sandbox });
    });

    it('async hooks are awaited before continuing', async () => {
      let sideEffect = false;

      const sandbox = new MountableSandbox({
        onStart: async () => {
          await new Promise(resolve => setTimeout(resolve, 50));
          sideEffect = true;
        },
      });

      await sandbox._start();

      expect(sideEffect).toBe(true);
    });

    it('onStart error is non-fatal (logged as warning)', async () => {
      const mockLogger = createMockLogger();
      const sandbox = new MountableSandbox({
        onStart: () => {
          throw new Error('onStart boom');
        },
      });
      sandbox.__setLogger(mockLogger);

      // onStart errors are caught and logged — they don't fail _start()
      await sandbox._start();
      expect(sandbox.status).toBe('running');
      expect(mockLogger.warn).toHaveBeenCalledWith('onStart callback failed', expect.any(Object));
    });

    it('onStop error sets status to error and propagates', async () => {
      const sandbox = new MountableSandbox({
        onStop: () => {
          throw new Error('onStop boom');
        },
      });

      await sandbox._start();
      await expect(sandbox._stop()).rejects.toThrow('onStop boom');
      expect(sandbox.status).toBe('error');
    });

    it('onDestroy error sets status to error and propagates', async () => {
      const sandbox = new MountableSandbox({
        onDestroy: () => {
          throw new Error('onDestroy boom');
        },
      });

      await sandbox._start();
      await expect(sandbox._destroy()).rejects.toThrow('onDestroy boom');
      expect(sandbox.status).toBe('error');
    });

    it('lifecycle methods work without hooks', async () => {
      const sandbox = new MountableSandbox(); // no hooks

      await sandbox._start();
      expect(sandbox.status).toBe('running');

      await sandbox._stop();
      expect(sandbox.status).toBe('stopped');
    });

    it('onStart hook can call sandbox methods', async () => {
      let commandResult: { exitCode: number; stdout: string } | undefined;

      const sandbox = new MountableSandbox({
        onStart: async ({ sandbox: s }) => {
          commandResult = await s.executeCommand!('echo', ['hello']);
        },
      });

      await sandbox._start();

      expect(commandResult).toBeDefined();
      expect(commandResult!.exitCode).toBe(0);
      expect(commandResult!.stdout).toContain('hello');
    });

    it('concurrent _start() calls only fire onStart once', async () => {
      let callCount = 0;

      const sandbox = new MountableSandbox({
        onStart: async () => {
          callCount++;
          // Simulate async work so both callers overlap
          await new Promise(resolve => setTimeout(resolve, 20));
        },
      });

      // Fire two concurrent _start() calls
      await Promise.all([sandbox._start(), sandbox._start()]);

      expect(callCount).toBe(1);
      expect(sandbox.status).toBe('running');
    });
  });

  describe('Built-in executeCommand', () => {
    it('retains full command output by default', async () => {
      const output = 'x'.repeat(1024 * 1024 + 5);
      const manager = new ExecuteCommandProcessManager(output);
      const sandbox = new ProcessBackedSandbox(manager);

      const result = await sandbox.executeCommand!('node', ['script.js']);

      expect(result.stdout).toBe(output);
      expect(result.stdoutTruncated).toBe(false);
      expect(result.stdoutDroppedBytes).toBe(0);
      expect(manager.lastOptions?.maxRetainedBytes).toBe(Infinity);
    });

    it('passes explicit executeCommand retention limits through to spawn', async () => {
      const manager = new ExecuteCommandProcessManager('abcdef');
      const sandbox = new ProcessBackedSandbox(manager);

      const result = await sandbox.executeCommand!('node', ['script.js'], { maxRetainedBytes: 3 });

      expect(result.stdout).toBe('def');
      expect(result.stdoutTruncated).toBe(true);
      expect(result.stdoutDroppedBytes).toBe(3);
      expect(manager.lastOptions?.maxRetainedBytes).toBe(3);
    });
  });

  describe('Env overlay', () => {
    it('passes constructor env to spawn options', async () => {
      const manager = new ExecuteCommandProcessManager('ok');
      const sandbox = new ProcessBackedSandbox(manager, { CTOR_VAR: 'from-ctor' });

      await sandbox.processes!.spawn('echo hi');

      expect(manager.lastOptions?.env).toEqual({ CTOR_VAR: 'from-ctor' });
    });

    it('makes setEnv values after construction visible to the next spawn', async () => {
      const manager = new ExecuteCommandProcessManager('ok');
      const sandbox = new ProcessBackedSandbox(manager);

      sandbox.setEnv(env => ({ ...env, GH_TOKEN: 'ghs_installed' }));
      await sandbox.processes!.spawn('gh auth status');

      expect(manager.lastOptions?.env).toEqual({ GH_TOKEN: 'ghs_installed' });
    });

    it('rotates values: a second setEnv for the same key wins on the next spawn', async () => {
      const manager = new ExecuteCommandProcessManager('ok');
      const sandbox = new ProcessBackedSandbox(manager);

      sandbox.setEnv(env => ({ ...env, GH_TOKEN: 'ghs_first' }));
      sandbox.setEnv(env => ({ ...env, GH_TOKEN: 'ghs_rotated' }));
      await sandbox.processes!.spawn('gh auth status');

      expect(manager.lastOptions?.env).toEqual({ GH_TOKEN: 'ghs_rotated' });
    });

    it('lets per-call env win over the overlay while keeping other overlay keys', async () => {
      const manager = new ExecuteCommandProcessManager('ok');
      const sandbox = new ProcessBackedSandbox(manager, { SHARED: 'overlay', KEPT: 'kept' });

      await sandbox.processes!.spawn('echo hi', { env: { SHARED: 'per-call' } });

      expect(manager.lastOptions?.env).toEqual({ SHARED: 'per-call', KEPT: 'kept' });
    });

    it('removes keys unset by the setEnv updater from the next spawn', async () => {
      const manager = new ExecuteCommandProcessManager('ok');
      const sandbox = new ProcessBackedSandbox(manager, { DROP_ME: 'secret', KEEP_ME: 'kept' });

      sandbox.setEnv(env => {
        const { DROP_ME: _drop, ...rest } = env;
        return rest;
      });
      await sandbox.processes!.spawn('echo hi');

      expect(manager.lastOptions?.env).toEqual({ KEEP_ME: 'kept' });
      expect(manager.lastOptions?.env).not.toHaveProperty('DROP_ME');
    });

    it('leaves spawn options untouched when the overlay is empty', async () => {
      const manager = new ExecuteCommandProcessManager('ok');
      const sandbox = new ProcessBackedSandbox(manager);

      await sandbox.processes!.spawn('echo hi');
      expect(manager.lastOptions).toBeUndefined();

      await sandbox.processes!.spawn('echo hi', { cwd: '/tmp' });
      expect(manager.lastOptions).toEqual({ cwd: '/tmp' });
      expect(manager.lastOptions?.env).toBeUndefined();
    });

    it('applies the overlay to the built-in executeCommand route', async () => {
      const manager = new ExecuteCommandProcessManager('ok');
      const sandbox = new ProcessBackedSandbox(manager);

      sandbox.setEnv(env => ({ ...env, DEMO_TOKEN: 'tok_exec' }));
      await sandbox.executeCommand!('printenv', ['DEMO_TOKEN']);

      expect(manager.lastOptions?.env).toEqual({ DEMO_TOKEN: 'tok_exec' });
    });

    it('is immune to callers mutating retained updater results or overlay snapshots', async () => {
      const manager = new ExecuteCommandProcessManager('ok');
      const sandbox = new ProcessBackedSandbox(manager);

      // (a) mutating the object returned from the updater after the fact
      let retained: Record<string, string | undefined> = {};
      sandbox.setEnv(env => {
        retained = { ...env, STABLE: 'yes' };
        return retained;
      });
      retained.INJECTED = 'nope';

      // (b) mutating the snapshot returned by getEnv()
      const snapshot = sandbox.getEnv();
      snapshot.ALSO_INJECTED = 'nope';

      await sandbox.processes!.spawn('echo hi');

      expect(manager.lastOptions?.env).toEqual({ STABLE: 'yes' });
    });
  });
});
