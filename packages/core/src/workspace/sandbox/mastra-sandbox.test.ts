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

  constructor(processes: SandboxProcessManager) {
    super({ name: 'ProcessBackedSandbox', processes });
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
});

// =============================================================================
// Start lifecycle wrap: coalescing, SandboxStartResult, bootstrap
// =============================================================================

/**
 * Sandbox with a controllable start() impl and a fake in-VM filesystem for
 * bootstrap sentinel probes. Records every executeCommand invocation.
 */
class LifecycleSandbox extends MastraSandbox {
  readonly id = 'lifecycle-sandbox';
  readonly name = 'LifecycleSandbox';
  readonly provider = 'test';
  status: ProviderStatus = 'pending';

  implCalls = 0;
  /** Sequence of executeCommand command strings. */
  commands: Array<{ command: string; env?: Record<string, string> }> = [];
  /** Fake VM files (sentinel storage). */
  files = new Set<string>();
  /** Exit code for the bootstrap command. */
  bootstrapExitCode = 0;

  startResult: { created: boolean } | undefined;
  startError: Error | undefined;
  startGate: Promise<void> | undefined;
  statusDuringImpl: ProviderStatus | undefined;

  constructor(options?: MastraSandboxOptions) {
    super({ ...options, name: 'LifecycleSandbox' });
  }

  async start(): Promise<{ created: boolean } | void> {
    this.implCalls += 1;
    this.statusDuringImpl = this.status;
    if (this.startGate) await this.startGate;
    if (this.startError) throw this.startError;
    return this.startResult;
  }

  async executeCommand(
    command: string,
    _args?: string[],
    options?: { env?: NodeJS.ProcessEnv },
  ): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    this.commands.push({ command, env: options?.env as Record<string, string> | undefined });
    const sentinel = '$HOME/.mastra-bootstrapped';
    if (command === `test -f "${sentinel}"`) {
      return { exitCode: this.files.has(sentinel) ? 0 : 1, stdout: '', stderr: '' };
    }
    if (command === `touch "${sentinel}"`) {
      this.files.add(sentinel);
      return { exitCode: 0, stdout: '', stderr: '' };
    }
    // Anything else is treated as the bootstrap command.
    return { exitCode: this.bootstrapExitCode, stdout: '', stderr: this.bootstrapExitCode === 0 ? '' : 'boom' };
  }
}

describe('MastraSandbox start lifecycle wrap', () => {
  it('routes direct start() through the wrapper (status transitions applied, result returned)', async () => {
    const sandbox = new LifecycleSandbox();
    sandbox.startResult = { created: true };

    const result = await sandbox.start();

    expect(result).toEqual({ created: true });
    expect(sandbox.implCalls).toBe(1);
    expect(sandbox.statusDuringImpl).toBe('starting');
    expect(sandbox.status).toBe('running');
  });

  it('coalesces concurrent direct start() and _start() calls onto one attempt', async () => {
    const sandbox = new LifecycleSandbox();
    sandbox.startResult = { created: true };
    let release!: () => void;
    sandbox.startGate = new Promise<void>(resolve => (release = resolve));

    const p1 = sandbox.start();
    const p2 = sandbox.start();
    const p3 = sandbox._start();
    release();
    const [r1, r2, r3] = await Promise.all([p1, p2, p3]);

    expect(sandbox.implCalls).toBe(1);
    // Joined callers share the attempt's result.
    expect(r1).toEqual({ created: true });
    expect(r2).toEqual({ created: true });
    expect(r3).toEqual({ created: true });
  });

  it('reports created: false from the already-running early return without re-invoking the impl', async () => {
    const sandbox = new LifecycleSandbox();
    sandbox.startResult = { created: true };

    await sandbox.start();
    const second = await sandbox.start();

    expect(second).toEqual({ created: false });
    expect(sandbox.implCalls).toBe(1);
  });

  it('does not latch failures: a failed start can be retried', async () => {
    const sandbox = new LifecycleSandbox();
    sandbox.startError = new Error('provider down');

    await expect(sandbox.start()).rejects.toThrow('provider down');
    expect(sandbox.status).toBe('error');

    sandbox.startError = undefined;
    sandbox.startResult = { created: false };
    await sandbox.start();

    expect(sandbox.implCalls).toBe(2);
    expect(sandbox.status).toBe('running');
  });

  describe('bootstrap', () => {
    const bootstrap = { command: 'echo bootstrap', env: { GIT_TOKEN: 'shhh' } };

    it('created: true → runs bootstrap without a sentinel probe, writes sentinel after success', async () => {
      const sandbox = new LifecycleSandbox({ bootstrap });
      sandbox.startResult = { created: true };

      await sandbox.start();

      const cmds = sandbox.commands.map(c => c.command);
      expect(cmds).toEqual(['echo bootstrap', 'touch "$HOME/.mastra-bootstrapped"']);
      expect(sandbox.files.has('$HOME/.mastra-bootstrapped')).toBe(true);
    });

    it('created: false with sentinel present → bootstrap skipped', async () => {
      const sandbox = new LifecycleSandbox({ bootstrap });
      sandbox.startResult = { created: false };
      sandbox.files.add('$HOME/.mastra-bootstrapped');

      await sandbox.start();

      expect(sandbox.commands.map(c => c.command)).toEqual(['test -f "$HOME/.mastra-bootstrapped"']);
    });

    it('created: false with sentinel ABSENT → bootstrap runs (failed-first-bootstrap reconnect case)', async () => {
      const sandbox = new LifecycleSandbox({ bootstrap });
      sandbox.startResult = { created: false };

      await sandbox.start();

      expect(sandbox.commands.map(c => c.command)).toEqual([
        'test -f "$HOME/.mastra-bootstrapped"',
        'echo bootstrap',
        'touch "$HOME/.mastra-bootstrapped"',
      ]);
    });

    it('void start result → sentinel probed; present → skipped', async () => {
      const sandbox = new LifecycleSandbox({ bootstrap });
      sandbox.files.add('$HOME/.mastra-bootstrapped');

      await sandbox.start();

      expect(sandbox.commands.map(c => c.command)).toEqual(['test -f "$HOME/.mastra-bootstrapped"']);
    });

    it('bootstrap failure → start() rejects, status error, sentinel not written, retry re-attempts', async () => {
      const sandbox = new LifecycleSandbox({ bootstrap });
      sandbox.startResult = { created: true };
      sandbox.bootstrapExitCode = 1;

      await expect(sandbox.start()).rejects.toThrow(/bootstrap command failed \(exit 1\)/);
      expect(sandbox.status).toBe('error');
      expect(sandbox.files.has('$HOME/.mastra-bootstrapped')).toBe(false);

      // Reconnect after the failed attempt: provider reports created: false,
      // sentinel is absent → bootstrap runs again and succeeds this time.
      sandbox.startResult = { created: false };
      sandbox.bootstrapExitCode = 0;
      await sandbox.start();

      expect(sandbox.status).toBe('running');
      expect(sandbox.files.has('$HOME/.mastra-bootstrapped')).toBe(true);
    });

    it('bootstrap env reaches the command execution options only', async () => {
      const sandbox = new LifecycleSandbox({ bootstrap });
      sandbox.startResult = { created: true };

      await sandbox.start();

      const bootstrapCall = sandbox.commands.find(c => c.command === 'echo bootstrap');
      expect(bootstrapCall?.env).toEqual({ GIT_TOKEN: 'shhh' });
      // Sentinel write does not carry the env.
      const touchCall = sandbox.commands.find(c => c.command.startsWith('touch'));
      expect(touchCall?.env).toBeUndefined();
    });

    it('does not deadlock when bootstrap runs through the auto-created executeCommand (pm.spawn → ensureRunning)', async () => {
      // No own executeCommand: the base auto-creates one from the process
      // manager, whose spawn wrapper calls sandbox.ensureRunning(). Before the
      // status-before-bootstrap ordering this would await its own start.
      class PmLifecycleSandbox extends MastraSandbox {
        readonly id = 'pm-lifecycle-sandbox';
        readonly name = 'PmLifecycleSandbox';
        readonly provider = 'test';
        status: ProviderStatus = 'pending';
        constructor() {
          super({
            name: 'PmLifecycleSandbox',
            processes: new ExecuteCommandProcessManager('ok'),
            bootstrap: { command: 'echo bootstrap' },
          });
        }
        async start(): Promise<{ created: boolean }> {
          return { created: true };
        }
      }

      const sandbox = new PmLifecycleSandbox();
      await expect(
        Promise.race([
          sandbox.start(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('deadlock: start() never resolved')), 2000)),
        ]),
      ).resolves.toEqual({ created: true });
      expect(sandbox.status).toBe('running');
    });
  });

  it('forwards created to the onStart hook', async () => {
    const onStart = vi.fn();
    const sandbox = new LifecycleSandbox({ onStart });
    sandbox.startResult = { created: false };

    await sandbox.start();

    expect(onStart).toHaveBeenCalledWith(expect.objectContaining({ created: false }));
  });

  it('onStart receives created: undefined when the provider does not report', async () => {
    const onStart = vi.fn();
    const sandbox = new LifecycleSandbox({ onStart });

    await sandbox.start();

    expect(onStart).toHaveBeenCalledWith(expect.objectContaining({ created: undefined }));
  });
});
