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
import type { ProviderStatus, SandboxStartResult } from '../lifecycle';

import { MastraSandbox } from './mastra-sandbox';
import type { MastraSandboxOptions } from './mastra-sandbox';
import type { MountManager } from './mount-manager';
import { ProcessHandle, SandboxProcessManager } from './process-manager';
import type { SpawnProcessOptions } from './process-manager';
import type { WorkspaceSandbox } from './sandbox';
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

  // Nothing to provision: these tests exercise the process manager and the env
  // overlay, so the sandbox declares an explicit no-op start.
  async start(): Promise<void> {}
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

    it('onStart error is fatal: _start() rejects and the sandbox is marked errored', async () => {
      const sandbox = new MountableSandbox({
        onStart: () => {
          throw new Error('onStart boom');
        },
      });

      // onStart is the setup seam — a caller must never observe a running
      // sandbox whose setup hook failed.
      await expect(sandbox._start()).rejects.toThrow(/onStart hook failed: onStart boom/);
      expect(sandbox.status).toBe('error');
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

  describe('setOnStart', () => {
    it('attaches a hook after construction, so hosts need not thread one through the constructor', async () => {
      const calls: string[] = [];
      const sandbox = new MountableSandbox();

      sandbox.setOnStart(() => () => {
        calls.push('attached');
      });
      await sandbox._start();

      expect(calls).toEqual(['attached']);
    });

    it('hands the updater the constructor hook so an attach composes instead of clobbering', async () => {
      const calls: string[] = [];
      const sandbox = new MountableSandbox({
        onStart: () => {
          calls.push('constructor');
        },
      });

      // Caller controls the order: ours first, so the hook that was already
      // there observes whatever setup we performed.
      sandbox.setOnStart(previous => async args => {
        calls.push('attached');
        await previous?.(args);
      });
      await sandbox._start();

      expect(calls).toEqual(['attached', 'constructor']);
    });

    it('chains across repeated calls without a hook registry', async () => {
      const calls: string[] = [];
      const sandbox = new MountableSandbox({
        onStart: () => {
          calls.push('constructor');
        },
      });

      sandbox.setOnStart(previous => async args => {
        await previous?.(args);
        calls.push('first');
      });
      sandbox.setOnStart(previous => async args => {
        await previous?.(args);
        calls.push('second');
      });
      await sandbox._start();

      expect(calls).toEqual(['constructor', 'first', 'second']);
    });

    it('replaces the existing hook when the updater ignores it', async () => {
      const calls: string[] = [];
      const sandbox = new MountableSandbox({
        onStart: () => {
          calls.push('constructor');
        },
      });

      sandbox.setOnStart(() => () => {
        calls.push('replacement');
      });
      await sandbox._start();

      expect(calls).toEqual(['replacement']);
    });

    it('passes the hook args through the composed chain', async () => {
      let receivedArg: unknown;
      const sandbox = new MountableSandbox({
        onStart: arg => {
          receivedArg = arg;
        },
      });

      sandbox.setOnStart(previous => async args => {
        await previous?.(args);
      });
      await sandbox._start();

      expect(receivedArg).toEqual({ sandbox });
    });

    it('keeps hook failures fatal when the hook arrived through setOnStart', async () => {
      const sandbox = new MountableSandbox();

      sandbox.setOnStart(() => () => {
        throw new Error('attached boom');
      });

      await expect(sandbox._start()).rejects.toThrow(/onStart hook failed: attached boom/);
      expect(sandbox.status).toBe('error');
    });

    it('applies to the next start, not the one already running', async () => {
      const calls: string[] = [];
      const sandbox = new MountableSandbox();

      await sandbox._start();
      sandbox.setOnStart(() => () => {
        calls.push('attached');
      });
      expect(calls).toEqual([]);

      await sandbox._stop();
      await sandbox._start();

      expect(calls).toEqual(['attached']);
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

// =============================================================================
// Start lifecycle wrap: coalescing, SandboxStartResult, fatal onStart
// =============================================================================

/**
 * Sandbox with a controllable start() impl. Records every executeCommand
 * invocation.
 */
class LifecycleSandbox extends MastraSandbox {
  readonly id = 'lifecycle-sandbox';
  readonly name = 'LifecycleSandbox';
  readonly provider = 'test';
  status: ProviderStatus = 'pending';

  implCalls = 0;
  /** Sequence of executeCommand command strings. */
  commands: Array<{ command: string; env?: Record<string, string> }> = [];

  startResult: { outcome: 'created' | 'connected' } | undefined;
  startError: Error | undefined;
  startGate: Promise<void> | undefined;
  statusDuringImpl: ProviderStatus | undefined;

  constructor(options?: MastraSandboxOptions) {
    super({ ...options, name: 'LifecycleSandbox' });
  }

  async start(): Promise<{ outcome: 'created' | 'connected' } | void> {
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
    return { exitCode: 0, stdout: '', stderr: '' };
  }
}

describe('MastraSandbox start lifecycle wrap', () => {
  it('routes direct start() through the wrapper (status transitions applied, result returned)', async () => {
    const sandbox = new LifecycleSandbox();
    sandbox.startResult = { outcome: 'created' };

    const result = await sandbox.start();

    expect(result).toEqual({ outcome: 'created' });
    expect(sandbox.implCalls).toBe(1);
    expect(sandbox.statusDuringImpl).toBe('starting');
    expect(sandbox.status).toBe('running');
  });

  it('coalesces concurrent direct start() and _start() calls onto one attempt', async () => {
    const sandbox = new LifecycleSandbox();
    sandbox.startResult = { outcome: 'created' };
    let release!: () => void;
    sandbox.startGate = new Promise<void>(resolve => (release = resolve));

    const p1 = sandbox.start();
    const p2 = sandbox.start();
    const p3 = sandbox._start();
    release();
    const [r1, r2, r3] = await Promise.all([p1, p2, p3]);

    expect(sandbox.implCalls).toBe(1);
    // Joined callers share the attempt's result.
    expect(r1).toEqual({ outcome: 'created' });
    expect(r2).toEqual({ outcome: 'created' });
    expect(r3).toEqual({ outcome: 'created' });
  });

  it("reports outcome 'connected' from the already-running early return without re-invoking the impl", async () => {
    const sandbox = new LifecycleSandbox();
    sandbox.startResult = { outcome: 'created' };

    await sandbox.start();
    const second = await sandbox.start();

    expect(second).toEqual({ outcome: 'connected' });
    expect(sandbox.implCalls).toBe(1);
  });

  it('does not latch failures: a failed start can be retried', async () => {
    const sandbox = new LifecycleSandbox();
    sandbox.startError = new Error('provider down');

    await expect(sandbox.start()).rejects.toThrow('provider down');
    expect(sandbox.status).toBe('error');

    sandbox.startError = undefined;
    sandbox.startResult = { outcome: 'connected' };
    await sandbox.start();

    expect(sandbox.implCalls).toBe(2);
    expect(sandbox.status).toBe('running');
  });

  describe('fatal onStart', () => {
    it('a thrown onStart rejects start(), marks the sandbox errored, and the next start retries the hook', async () => {
      const onStart = vi
        .fn()
        .mockRejectedValueOnce(new Error('git clone failed: Killed (exit 137)'))
        .mockResolvedValue(undefined);
      const sandbox = new LifecycleSandbox({ onStart });
      sandbox.startResult = { outcome: 'created' };

      await expect(sandbox.start()).rejects.toThrow(/onStart hook failed: git clone failed: Killed \(exit 137\)/);
      expect(sandbox.status).toBe('error');

      // Nothing latched: the next start re-runs the full attempt incl. the hook.
      await expect(sandbox.start()).resolves.toEqual({ outcome: 'created' });
      expect(sandbox.status).toBe('running');
      expect(onStart).toHaveBeenCalledTimes(2);
    });

    it('a caller awaiting start() never observes running before the hook finished', async () => {
      let resolveHook!: () => void;
      const hookGate = new Promise<void>(resolve => (resolveHook = resolve));
      const onStart = vi.fn(() => hookGate);
      const sandbox = new LifecycleSandbox({ onStart });
      sandbox.startResult = { outcome: 'created' };

      let settled = false;
      const startPromise = sandbox.start().then(r => {
        settled = true;
        return r;
      });
      await new Promise(r => setTimeout(r, 10));
      expect(settled).toBe(false);
      resolveHook();
      await expect(startPromise).resolves.toEqual({ outcome: 'created' });
    });

    it('an onStart hook can execute commands through the sandbox (status is running before the hook fires)', async () => {
      // Setup hooks run their work through the sandbox's own command path; the
      // pm.spawn wrapper calls ensureRunning(), which must not deadlock
      // joining the in-flight start.
      class PmHookSandbox extends MastraSandbox {
        readonly id = 'pm-hook-sandbox';
        readonly name = 'PmHookSandbox';
        readonly provider = 'test';
        status: ProviderStatus = 'pending';
        constructor(onStart: MastraSandboxOptions['onStart']) {
          super({ name: 'PmHookSandbox', processes: new ExecuteCommandProcessManager('ok'), onStart });
        }
        protected override async create(): Promise<void> {}
      }

      const ran: string[] = [];
      const sandbox: PmHookSandbox = new PmHookSandbox(async ({ sandbox: sb }) => {
        const result = await sb.executeCommand!('echo setup');
        ran.push(`exit:${result.exitCode}`);
      });

      await expect(
        Promise.race([
          sandbox.start(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('deadlock: start() never resolved')), 2000)),
        ]),
      ).resolves.toEqual({ outcome: 'created' });
      expect(ran).toEqual(['exit:0']);
      expect(sandbox.status).toBe('running');
    });
  });

  it('forwards the start outcome to the onStart hook', async () => {
    const onStart = vi.fn();
    const sandbox = new LifecycleSandbox({ onStart });
    sandbox.startResult = { outcome: 'connected' };

    await sandbox.start();

    expect(onStart).toHaveBeenCalledWith(expect.objectContaining({ outcome: 'connected' }));
  });

  it('onStart receives outcome: undefined when the provider does not report', async () => {
    const onStart = vi.fn();
    const sandbox = new LifecycleSandbox({ onStart });

    await sandbox.start();

    expect(onStart).toHaveBeenCalledWith(expect.objectContaining({ outcome: undefined }));
  });
});

// =============================================================================
// Acquisition primitives ladder (find / connect / create)
// =============================================================================

/**
 * Rung-1 sandbox: no start() override, acquisition via primitives. The fake
 * "remote" is `vmExists`.
 */
class PrimitiveSandbox extends MastraSandbox<string> {
  readonly id = 'primitive-sandbox';
  readonly name = 'PrimitiveSandbox';
  readonly provider = 'test';
  status: ProviderStatus = 'pending';

  vmExists = false;
  findCalls = 0;
  connectCalls = 0;
  createCalls = 0;
  lastConnectedHandle: string | undefined;
  connectError: Error | undefined;
  createError: Error | undefined;

  commands: Array<{ command: string; env?: Record<string, string> }> = [];

  constructor(options?: MastraSandboxOptions) {
    super({ ...options, name: 'PrimitiveSandbox' });
  }

  protected override async find(): Promise<string | undefined> {
    this.findCalls += 1;
    return this.vmExists ? 'vm-handle' : undefined;
  }

  protected override async connect(handle: string): Promise<void> {
    this.connectCalls += 1;
    this.lastConnectedHandle = handle;
    if (this.connectError) throw this.connectError;
  }

  protected override async create(): Promise<void> {
    this.createCalls += 1;
    if (this.createError) throw this.createError;
    this.vmExists = true;
  }

  async executeCommand(
    command: string,
    _args?: string[],
    options?: { env?: NodeJS.ProcessEnv },
  ): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    this.commands.push({ command, env: options?.env as Record<string, string> | undefined });
    return { exitCode: 0, stdout: '', stderr: '' };
  }
}

describe('MastraSandbox acquisition primitives', () => {
  it("find hit → connect with the found handle, outcome 'connected', create never called", async () => {
    const sandbox = new PrimitiveSandbox();
    sandbox.vmExists = true;

    const result = await sandbox.start();

    expect(result).toEqual({ outcome: 'connected' });
    expect(sandbox.connectCalls).toBe(1);
    expect(sandbox.lastConnectedHandle).toBe('vm-handle');
    expect(sandbox.createCalls).toBe(0);
    expect(sandbox.status).toBe('running');
  });

  it("find miss → create, outcome 'created'", async () => {
    const sandbox = new PrimitiveSandbox();

    const result = await sandbox.start();

    expect(result).toEqual({ outcome: 'created' });
    expect(sandbox.findCalls).toBe(1);
    expect(sandbox.createCalls).toBe(1);
    expect(sandbox.connectCalls).toBe(0);
  });

  it('a create-only provider (no find) always creates', async () => {
    class CreateOnlySandbox extends MastraSandbox {
      readonly id = 'create-only';
      readonly name = 'CreateOnlySandbox';
      readonly provider = 'test';
      status: ProviderStatus = 'pending';
      createCalls = 0;
      constructor() {
        super({ name: 'CreateOnlySandbox' });
      }
      protected override async create(): Promise<void> {
        this.createCalls += 1;
      }
    }

    const sandbox = new CreateOnlySandbox();
    await expect(sandbox.start()).resolves.toEqual({ outcome: 'created' });
    expect(sandbox.createCalls).toBe(1);
  });

  it('connect failure fails start() and is retryable', async () => {
    const sandbox = new PrimitiveSandbox();
    sandbox.vmExists = true;
    sandbox.connectError = new Error('wake failed');

    await expect(sandbox.start()).rejects.toThrow('wake failed');
    expect(sandbox.status).toBe('error');

    sandbox.connectError = undefined;
    await expect(sandbox.start()).resolves.toEqual({ outcome: 'connected' });
    expect(sandbox.status).toBe('running');
  });

  it('a start() override wins over implemented primitives', async () => {
    class BothSandbox extends PrimitiveSandbox {
      implCalls = 0;
      override async start(): Promise<SandboxStartResult> {
        this.implCalls += 1;
        return { outcome: 'connected' };
      }
    }

    const sandbox = new BothSandbox();
    await expect(sandbox.start()).resolves.toEqual({ outcome: 'connected' });
    expect(sandbox.implCalls).toBe(1);
    expect(sandbox.findCalls).toBe(0);
    expect(sandbox.createCalls).toBe(0);
  });

  it('forwards the structural outcome to onStart, so a setup hook can branch on create vs connect', async () => {
    const observed: Array<'created' | 'connected' | undefined> = [];
    // The recommended once-per-VM setup shape: run on create, probe on connect.
    const onStart = vi.fn(
      async ({ sandbox: sb, outcome }: { sandbox: WorkspaceSandbox; outcome?: 'created' | 'connected' }) => {
        observed.push(outcome);
        if (outcome === 'created') await sb.executeCommand!('run full setup');
        else await sb.executeCommand!('probe setup');
      },
    );

    const first = new PrimitiveSandbox({ onStart });
    await first.start();
    expect(first.commands.map(c => c.command)).toEqual(['run full setup']);

    // Second instance, same "remote": connect branch → hook sees outcome: 'connected'.
    const second = new PrimitiveSandbox({ onStart });
    second.vmExists = true;
    await second.start();
    expect(second.commands.map(c => c.command)).toEqual(['probe setup']);
    expect(observed).toEqual(['created', 'connected']);
  });

  it('a fatal onStart on the create branch leaves the found-again VM to a retrying hook (crash/fail window)', async () => {
    // First attempt: create succeeds, setup hook fails → start rejects.
    const onStart = vi.fn().mockRejectedValueOnce(new Error('setup failed')).mockResolvedValue(undefined);
    const sandbox = new PrimitiveSandbox({ onStart });

    await expect(sandbox.start()).rejects.toThrow(/onStart hook failed: setup failed/);
    expect(sandbox.status).toBe('error');

    // Retry: the VM exists now, so acquisition connects — and the hook runs
    // again (it owns deciding whether setup completed, e.g. via a probe).
    await expect(sandbox.start()).resolves.toEqual({ outcome: 'connected' });
    expect(onStart).toHaveBeenLastCalledWith(expect.objectContaining({ outcome: 'connected' }));
    expect(sandbox.status).toBe('running');
  });

  it('rejects a provider that finds handles it never adopts', () => {
    // Without connect(), a found handle would report outcome 'connected' while
    // the sandbox runs against nothing. Fail at construction instead.
    class UnadoptedHandleSandbox extends MastraSandbox<string> {
      readonly id = 'unadopted';
      readonly name = 'UnadoptedHandleSandbox';
      readonly provider = 'test';
      status: ProviderStatus = 'pending';

      constructor() {
        super({ name: 'UnadoptedHandleSandbox' });
      }

      protected override async find(): Promise<string | undefined> {
        return 'vm-handle';
      }

      protected override async create(): Promise<void> {}
    }

    expect(() => new UnadoptedHandleSandbox()).toThrow(/find\(\) requires connect\(\)/);
  });

  it('refuses to start a provider that implements neither start() nor create()', async () => {
    class EmptySandbox extends MastraSandbox {
      readonly id = 'empty';
      readonly name = 'EmptySandbox';
      readonly provider = 'test';
      status: ProviderStatus = 'pending';

      constructor() {
        super({ name: 'EmptySandbox' });
      }
    }

    const sandbox = new EmptySandbox();

    await expect(sandbox._start()).rejects.toThrow(/implements neither start\(\) nor the create\(\)/);
    // Never claims to be running with nothing behind it.
    expect(sandbox.status).toBe('error');
  });

  it('refuses to start a provider whose start and create are class fields', async () => {
    // Field initializers run after the base constructor, so the wrapper and
    // rung selection never see them and the base start() runs instead.
    let fieldCalls = 0;

    class FieldStartSandbox extends MastraSandbox {
      readonly id = 'field-start';
      readonly name = 'FieldStartSandbox';
      readonly provider = 'test';
      status: ProviderStatus = 'pending';

      start = async () => {
        fieldCalls++;
      };

      constructor() {
        super({ name: 'FieldStartSandbox' });
      }
    }

    class FieldCreateSandbox extends MastraSandbox {
      readonly id = 'field-create';
      readonly name = 'FieldCreateSandbox';
      readonly provider = 'test';
      status: ProviderStatus = 'pending';

      create = async () => {
        fieldCalls++;
      };

      constructor() {
        super({ name: 'FieldCreateSandbox' });
      }
    }

    await expect(new FieldStartSandbox()._start()).rejects.toThrow(/implements neither start\(\)/);
    await expect(new FieldCreateSandbox()._start()).rejects.toThrow(/implements neither start\(\)/);
    expect(fieldCalls).toBe(0);
  });

  it('rejects a find() that returns a handle with no connect() to adopt it', async () => {
    // The constructor pairing check misses a class-field connect, so acquisition
    // enforces it at the point of use rather than reporting a false 'connected'.
    class LateConnectSandbox extends MastraSandbox<string> {
      readonly id = 'late-connect';
      readonly name = 'LateConnectSandbox';
      readonly provider = 'test';
      status: ProviderStatus = 'pending';

      constructor() {
        super({ name: 'LateConnectSandbox' });
      }

      protected override async find(): Promise<string | undefined> {
        return 'vm-handle';
      }

      protected override async connect(_handle: string): Promise<void> {}

      protected override async create(): Promise<void> {}
    }

    const sandbox = new LateConnectSandbox();
    // Hide connect after construction, the way a class-field initializer does
    // by not existing when the constructor's pairing check runs.
    Object.defineProperty(sandbox, 'connect', { value: undefined, configurable: true });

    await expect(sandbox._start()).rejects.toThrow(/find\(\) requires connect\(\)/);
  });
});
