/**
 * Local Process Manager
 *
 * Local implementation of SandboxProcessManager using child_process.spawn.
 * Tracks processes in-memory since there's no server to query.
 */

import * as childProcess from 'node:child_process';
import type { ChildProcess } from 'node:child_process';

import type { LocalSandbox } from './local-sandbox';
import { ProcessHandle, SandboxProcessManager } from './process-manager';
import type { ProcessInfo, SpawnProcessOptions } from './process-manager';
import type { CommandResult } from './types';

// =============================================================================
// Local Process Handle
// =============================================================================

/**
 * Local implementation of ProcessHandle wrapping a node ChildProcess.
 * Not exported — internal to this module.
 */
class LocalProcessHandle extends ProcessHandle {
  readonly pid: number;
  exitCode: number | undefined;

  private proc: ChildProcess;
  private readonly waitPromise: Promise<CommandResult>;
  private readonly startTime: number;

  constructor(proc: ChildProcess, startTime: number, options?: SpawnProcessOptions) {
    super(options);
    if (!proc.pid) {
      throw new Error('Process has no PID - it may have failed to spawn');
    }
    this.pid = proc.pid;
    this.proc = proc;
    this.startTime = startTime;

    let timedOut = false;
    const timeoutId = options?.timeout
      ? setTimeout(() => {
          timedOut = true;
          // Kill the process group so child processes are also terminated
          try {
            process.kill(-this.pid, 'SIGTERM');
          } catch {
            proc.kill('SIGTERM');
          }
        }, options.timeout)
      : undefined;

    this.waitPromise = new Promise<CommandResult>(resolve => {
      proc.on('close', (code, signal) => {
        if (timeoutId) clearTimeout(timeoutId);
        if (timedOut) {
          const timeoutMsg = `\nProcess timed out after ${options!.timeout}ms`;
          this.emitStderr(timeoutMsg);
          this.exitCode = 124;
        } else {
          this.exitCode = signal && code === null ? 128 : (code ?? 0);
        }
        resolve({
          success: this.exitCode === 0,
          exitCode: this.exitCode,
          stdout: this.stdout,
          stderr: this.stderr,
          executionTimeMs: Date.now() - this.startTime,
          killed: signal !== null,
          timedOut,
        });
      });

      proc.on('error', err => {
        if (timeoutId) clearTimeout(timeoutId);
        this.emitStderr(err.message);
        this.exitCode = 1;
        resolve({
          success: false,
          exitCode: 1,
          stdout: this.stdout,
          stderr: this.stderr,
          executionTimeMs: Date.now() - this.startTime,
        });
      });
    });

    proc.stdout?.on('data', (data: Buffer) => {
      this.emitStdout(data.toString());
    });

    proc.stderr?.on('data', (data: Buffer) => {
      this.emitStderr(data.toString());
    });
  }

  async wait(): Promise<CommandResult> {
    return this.waitPromise;
  }

  async kill(): Promise<boolean> {
    if (this.exitCode !== undefined) return false;
    // Kill the entire process group (negative PID) to ensure child processes
    // spawned by the shell are also terminated. Without this, commands like
    // "echo foo; sleep 60" would leave orphaned children holding stdio open.
    try {
      process.kill(-this.pid, 'SIGKILL');
      return true;
    } catch {
      // Fallback to direct kill if process group kill fails
      return this.proc.kill('SIGKILL');
    }
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
 * Spawns processes via child_process.spawn and tracks them in-memory.
 */
export class LocalProcessManager extends SandboxProcessManager<LocalSandbox> {
  async spawn(command: string, options: SpawnProcessOptions = {}): Promise<ProcessHandle> {
    const cwd = options.cwd ?? this.sandbox.workingDirectory;
    const env = this.sandbox.buildEnv(options.env);
    const wrapped = this.sandbox.wrapCommandForIsolation(command);

    // detached: true creates a new process group so we can kill the entire tree.
    // Non-isolated: use shell mode so the host shell interprets the command string.
    // Isolated (seatbelt/bwrap): the wrapper already includes `sh -c` inside the
    // sandbox, so we spawn the wrapper binary directly.
    const proc = childProcess.spawn(wrapped.command, wrapped.args, {
      cwd,
      env,
      shell: this.sandbox.isolation === 'none',
      detached: true,
    });
    const handle = new LocalProcessHandle(proc, Date.now(), options);
    this._tracked.set(handle.pid, handle);
    return handle;
  }

  async list(): Promise<ProcessInfo[]> {
    return Array.from(this._tracked.values()).map(handle => ({
      pid: handle.pid,
      running: handle.exitCode === undefined,
      exitCode: handle.exitCode,
    }));
  }
}
