/**
 * Local Process Manager
 *
 * Local implementation of SandboxProcessManager using execa.
 * Tracks processes in-memory since there's no server to query.
 */

import { execa } from 'execa';
import type { ResultPromise, Options as ExecaOptions } from 'execa';

import type { LocalSandbox } from './local-sandbox';
import { ProcessHandle, SandboxProcessManager } from './process-manager';
import type { ProcessInfo, SpawnProcessOptions } from './process-manager';
import type { CommandResult } from './types';

// =============================================================================
// Local Process Handle
// =============================================================================

/**
 * Local implementation of ProcessHandle wrapping an execa subprocess.
 * Not exported — internal to this module.
 */
class LocalProcessHandle extends ProcessHandle {
  readonly pid: number;
  exitCode: number | undefined;

  private subprocess: ResultPromise;
  private readonly waitPromise: Promise<CommandResult>;
  private readonly startTime: number;

  constructor(subprocess: ResultPromise, pid: number, startTime: number, options?: SpawnProcessOptions) {
    super(options);
    this.pid = pid;
    this.subprocess = subprocess;
    this.startTime = startTime;

    let timedOut = false;
    const timeoutId = options?.timeout
      ? setTimeout(() => {
          timedOut = true;
          // Kill the entire process group so child processes are also terminated.
          // We handle timeout ourselves rather than using execa's timeout option
          // because execa only kills the direct subprocess, not the process group.
          try {
            process.kill(-this.pid, 'SIGTERM');
          } catch {
            subprocess.kill('SIGTERM');
          }
        }, options.timeout)
      : undefined;

    this.waitPromise = new Promise<CommandResult>(resolve => {
      subprocess.on('close', (code: number | null, signal: NodeJS.Signals | null) => {
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
          exitCode: this.exitCode!,
          stdout: this.stdout,
          stderr: this.stderr,
          executionTimeMs: Date.now() - this.startTime,
          killed: signal !== null,
          timedOut,
        });
      });

      subprocess.on('error', (err: Error) => {
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

    subprocess.stdout?.on('data', (data: Buffer) => {
      this.emitStdout(data.toString());
    });

    subprocess.stderr?.on('data', (data: Buffer) => {
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
    // Execa doesn't handle process tree killing natively.
    try {
      process.kill(-this.pid, 'SIGKILL');
      return true;
    } catch {
      // Fallback to direct kill if process group kill fails
      this.subprocess.kill('SIGKILL');
      return true;
    }
  }

  async sendStdin(data: string): Promise<void> {
    if (this.exitCode !== undefined) {
      throw new Error(`Process ${this.pid} has already exited with code ${this.exitCode}`);
    }
    if (!this.subprocess.stdin) {
      throw new Error(`Process ${this.pid} does not have stdin available`);
    }
    return new Promise<void>((resolve, reject) => {
      this.subprocess.stdin!.write(data, (err: Error | null | undefined) => (err ? reject(err) : resolve()));
    });
  }
}

// =============================================================================
// Local Process Manager
// =============================================================================

/**
 * Local implementation of SandboxProcessManager.
 * Spawns processes via execa and tracks them in-memory.
 */
export class LocalProcessManager extends SandboxProcessManager<LocalSandbox> {
  async spawn(command: string, options: SpawnProcessOptions = {}): Promise<ProcessHandle> {
    const cwd = options.cwd ?? this.sandbox.workingDirectory;
    const env = this.sandbox.buildEnv(options.env);
    const wrapped = this.sandbox.wrapCommandForIsolation(command);

    const execaOptions: ExecaOptions = {
      cwd,
      env,
      shell: this.sandbox.isolation === 'none',
      // detached: true creates a new process group so we can kill the entire tree.
      detached: true,
      stdio: 'pipe',
      // Don't throw on non-zero exit — we handle exit codes ourselves.
      reject: false,
      // Don't buffer output — we stream it via ProcessHandle callbacks.
      buffer: false,
      // Don't strip newlines — preserve raw output for ProcessHandle accumulation.
      stripFinalNewline: false,
      // Don't extend process.env — the sandbox controls the full environment via buildEnv().
      extendEnv: false,
    };

    const subprocess = execa(wrapped.command, wrapped.args, execaOptions);

    // execa sets pid synchronously when the process spawns successfully.
    // If pid is undefined, the spawn failed (bad cwd, missing command, etc.).
    // Await the subprocess to get execa's detailed error message.
    if (!subprocess.pid) {
      const result = await subprocess;
      throw new Error(result.message || 'Process failed to spawn');
    }

    const handle = new LocalProcessHandle(subprocess, subprocess.pid, Date.now(), options);
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
