/**
 * Local Process Manager
 *
 * Implements SandboxProcessManager for local sandbox execution.
 * Spawns processes via child_process.spawn and tracks them by PID.
 */

import * as childProcess from 'node:child_process';
import type { ChildProcess } from 'node:child_process';

import type { ProcessHandle, CommandResult, ProcessInfo, SandboxProcessManager, SpawnProcessOptions } from './types';

// =============================================================================
// Local Command Handle
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

  toProcessInfo(): ProcessInfo {
    return {
      pid: this.pid,
      command: this.command,
      args: this.args,
      running: this.running,
      exitCode: this.exitCode,
      stdout: this.stdout,
      stderr: this.stderr,
    };
  }
}

// =============================================================================
// Local Process Manager
// =============================================================================

/**
 * Local implementation of SandboxProcessManager.
 * Spawns processes via child_process.spawn and tracks them by PID.
 * Auto-starts the sandbox when spawn is called.
 */
export class LocalProcessManager implements SandboxProcessManager {
  private readonly _sandbox: { ensureRunning(): Promise<void>; readonly workingDirectory: string };
  private readonly _handles = new Map<number, LocalProcessHandle>();

  constructor(sandbox: { ensureRunning(): Promise<void>; readonly workingDirectory: string }) {
    this._sandbox = sandbox;
  }

  async spawn(command: string, args: string[] = [], options: SpawnProcessOptions = {}): Promise<ProcessHandle> {
    await this._sandbox.ensureRunning();

    const startTime = Date.now();
    const cwd = options.cwd ?? this._sandbox.workingDirectory;
    const env = {
      PATH: process.env.PATH,
      ...options.env,
    };

    const proc = childProcess.spawn(command, args, { cwd, env });
    const handle = new LocalProcessHandle(proc, command, args, startTime);

    this._handles.set(handle.pid, handle);

    return handle;
  }

  async list(): Promise<ProcessInfo[]> {
    return Array.from(this._handles.values()).map(handle => handle.toProcessInfo());
  }

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
