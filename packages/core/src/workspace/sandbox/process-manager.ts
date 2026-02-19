/**
 * Process Managers
 *
 * Abstract base class and local implementation for sandbox process management.
 * The base class handles lifecycle (ensureRunning), handle tracking, and
 * common operations (list, get, killAll). Subclasses override spawn().
 */

import * as childProcess from 'node:child_process';
import type { ChildProcess } from 'node:child_process';

import type { LocalSandbox } from './local-sandbox';
import type { MastraSandbox } from './mastra-sandbox';
import type { ProcessHandle, CommandResult, ProcessInfo, SpawnProcessOptions } from './types';

// =============================================================================
// Sandbox Process Manager (Base Class)
// =============================================================================

/**
 * Abstract base class for background process management in sandboxes.
 *
 * Handles:
 * - Calling `sandbox.ensureRunning()` before every spawn
 * - Tracking spawned processes by PID
 * - Common operations: list, get, killAll
 *
 * Subclasses override `spawn()` with their platform-specific logic.
 * The base class constructor wraps it with ensureRunning + handle tracking.
 *
 * @typeParam TSandbox - The sandbox type. Subclasses narrow this to access
 *   sandbox-specific properties (e.g. `workingDirectory`, `instance`).
 *
 * @example
 * ```typescript
 * const handle = await sandbox.processes.spawn('node', ['server.js']);
 * console.log(handle.pid, handle.stdout);
 *
 * const all = await sandbox.processes.list();
 * const proc = sandbox.processes.get(handle.pid);
 * await proc?.kill();
 * ```
 */
export abstract class SandboxProcessManager<TSandbox extends MastraSandbox = MastraSandbox> {
  protected readonly sandbox: TSandbox;
  private readonly _handles = new Map<number, ProcessHandle>();

  constructor(sandbox: TSandbox) {
    this.sandbox = sandbox;

    // Wrap the subclass's spawn() with ensureRunning + handle tracking.
    // `this.spawn` resolves to the subclass override via prototype chain.
    const implSpawn = this.spawn.bind(this);
    this.spawn = async (
      command: string,
      args: string[] = [],
      options: SpawnProcessOptions = {},
    ): Promise<ProcessHandle> => {
      await this.sandbox.ensureRunning();
      const handle = await implSpawn(command, args, options);
      this._handles.set(handle.pid, handle);
      return handle;
    };
  }

  /**
   * Spawn a background process.
   * Subclasses override this with platform-specific logic.
   * The base class wraps it with ensureRunning + handle tracking automatically.
   */
  async spawn(_command: string, _args: string[] = [], _options: SpawnProcessOptions = {}): Promise<ProcessHandle> {
    throw new Error(`${this.constructor.name} must implement spawn()`);
  }

  /** List all tracked background processes. */
  async list(): Promise<ProcessInfo[]> {
    return Array.from(this._handles.values()).map(handle => ({
      pid: handle.pid,
      command: handle.command,
      args: handle.args,
      running: handle.running,
      exitCode: handle.exitCode,
      stdout: handle.stdout,
      stderr: handle.stderr,
    }));
  }

  /** Get a handle to a background process by PID. */
  get(pid: number): ProcessHandle | undefined {
    return this._handles.get(pid);
  }

  /** Kill all tracked processes. Used during sandbox destroy. */
  async killAll(): Promise<void> {
    for (const handle of this._handles.values()) {
      if (handle.running) {
        await handle.kill();
      }
    }
    this._handles.clear();
  }
}

// =============================================================================
// Local Process Handle
// =============================================================================

/**
 * Local implementation of ProcessHandle wrapping a node ChildProcess.
 * Not exported — internal to this module.
 */
class LocalProcessHandle implements ProcessHandle {
  readonly pid: number;
  readonly command: string;
  readonly args: string[];
  stdout = '';
  stderr = '';
  exitCode: number | undefined;

  private proc: ChildProcess;
  private readonly waitPromise: Promise<CommandResult>;
  private readonly startTime: number;

  get running(): boolean {
    return this.exitCode === undefined;
  }

  constructor(proc: ChildProcess, command: string, args: string[], startTime: number) {
    if (!proc.pid) {
      throw new Error('Process has no PID - it may have failed to spawn');
    }
    this.pid = proc.pid;
    this.proc = proc;
    this.command = command;
    this.args = args;
    this.startTime = startTime;

    this.waitPromise = new Promise<CommandResult>(resolve => {
      proc.on('close', (code, signal) => {
        this.exitCode = signal && code === null ? 128 : (code ?? 0);
        resolve({
          success: this.exitCode === 0,
          exitCode: this.exitCode,
          stdout: this.stdout,
          stderr: this.stderr,
          executionTimeMs: Date.now() - this.startTime,
          killed: signal !== null,
          command: this.command,
          args: this.args,
        });
      });

      proc.on('error', err => {
        this.stderr += err.message;
        this.exitCode = 1;
        resolve({
          success: false,
          exitCode: 1,
          stdout: this.stdout,
          stderr: this.stderr,
          executionTimeMs: Date.now() - this.startTime,
          command: this.command,
          args: this.args,
        });
      });
    });

    proc.stdout?.on('data', (data: Buffer) => {
      this.stdout += data.toString();
    });

    proc.stderr?.on('data', (data: Buffer) => {
      this.stderr += data.toString();
    });
  }

  async wait(): Promise<CommandResult> {
    return this.waitPromise;
  }

  async kill(): Promise<boolean> {
    if (this.exitCode !== undefined) return false;
    return this.proc.kill('SIGKILL');
  }

  async sendStdin(data: string): Promise<void> {
    if (this.exitCode !== undefined) {
      throw new Error(`Process ${this.pid} has already exited with code ${this.exitCode}`);
    }
    if (!this.proc.stdin) {
      throw new Error(`Process ${this.pid} does not have stdin available`);
    }
    return new Promise<void>((resolve, reject) => {
      this.proc.stdin!.write(data, err => (err ? reject(err) : resolve()));
    });
  }
}

// =============================================================================
// Local Process Manager
// =============================================================================

/**
 * Local implementation of SandboxProcessManager.
 * Spawns processes via child_process.spawn.
 */
export class LocalProcessManager extends SandboxProcessManager<LocalSandbox> {
  async spawn(command: string, args: string[] = [], options: SpawnProcessOptions = {}): Promise<ProcessHandle> {
    const cwd = options.cwd ?? this.sandbox.workingDirectory;
    const env = {
      PATH: process.env.PATH,
      ...options.env,
    };

    const proc = childProcess.spawn(command, args, { cwd, env });
    return new LocalProcessHandle(proc, command, args, Date.now());
  }
}
