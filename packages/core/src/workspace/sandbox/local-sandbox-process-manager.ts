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

/**
 * Tracked process entry — the handle plus metadata from the spawn() call.
 */
interface TrackedProcess {
  handle: ProcessHandle;
  command: string;
}

// =============================================================================
// Local Process Handle
// =============================================================================

/**
 * Local implementation of ProcessHandle wrapping a node ChildProcess.
 * Not exported — internal to this module.
 */
class LocalProcessHandle extends ProcessHandle {
  readonly pid: number;
  stdout = '';
  stderr = '';
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
        });
      });
    });

    proc.stdout?.on('data', (data: Buffer) => {
      const str = data.toString();
      this.stdout += str;
      this.emitStdout(str);
    });

    proc.stderr?.on('data', (data: Buffer) => {
      const str = data.toString();
      this.stderr += str;
      this.emitStderr(str);
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
 * Spawns processes via child_process.spawn and tracks them in-memory.
 */
export class LocalProcessManager extends SandboxProcessManager<LocalSandbox> {
  private readonly _tracked = new Map<number, TrackedProcess>();

  async spawn(command: string, options: SpawnProcessOptions = {}): Promise<ProcessHandle> {
    const cwd = options.cwd ?? this.sandbox.workingDirectory;
    const env = {
      PATH: process.env.PATH,
      ...options.env,
    };

    const proc = childProcess.spawn(command, { cwd, env, shell: true });
    const handle = new LocalProcessHandle(proc, Date.now(), options);
    this._tracked.set(handle.pid, { handle, command });
    return handle;
  }

  async list(): Promise<ProcessInfo[]> {
    return Array.from(this._tracked.values()).map(({ handle, command }) => ({
      pid: handle.pid,
      command,
      running: handle.exitCode === undefined,
      exitCode: handle.exitCode,
    }));
  }

  async get(pid: number): Promise<ProcessHandle | undefined> {
    return this._tracked.get(pid)?.handle;
  }
}
