/**
 * Blaxel Process Manager
 *
 * Implements SandboxProcessManager for Blaxel cloud sandboxes.
 * Wraps the Blaxel SDK's process API (exec, list, get, kill, streamLogs)
 * for background process management.
 */

import type { SandboxInstance } from '@blaxel/core';
import { ProcessHandle, SandboxProcessManager } from '@mastra/core/workspace';
import type { CommandResult, ProcessInfo, SpawnProcessOptions } from '@mastra/core/workspace';
import type { BlaxelSandbox } from './index';

// =============================================================================
// Blaxel Process Handle
// =============================================================================

/**
 * Wraps a Blaxel background process to conform to Mastra's ProcessHandle.
 * Not exported — internal to this module.
 *
 * Uses streamLogs() for real-time output and get() for exit code resolution.
 */
class BlaxelProcessHandle extends ProcessHandle {
  readonly pid: string;

  private readonly _sandbox: SandboxInstance;
  private readonly _startTime: number;

  private _exitCode: number | undefined;
  private _waitPromise: Promise<CommandResult> | null = null;
  private _streamingDone: Promise<void> | null = null;
  private _closeStream: (() => void) | null = null;
  private _killed = false;
  private readonly _stdinMode: SpawnProcessOptions['stdinMode'];

  constructor(pid: string, sandbox: SandboxInstance, startTime: number, options?: SpawnProcessOptions) {
    super(options);
    this.pid = pid;
    this._sandbox = sandbox;
    this._startTime = startTime;
    this._stdinMode = options?.stdinMode;
  }

  get exitCode(): number | undefined {
    return this._exitCode;
  }

  /** @internal Set by the process manager after streaming starts. */
  set streamControl(control: { close: () => void; wait: () => Promise<void> }) {
    this._closeStream = control.close;
    this._streamingDone = control.wait();

    // Auto-resolve exit code when streaming ends
    this._streamingDone.then(() => this._resolveExitCode()).catch(() => this._resolveExitCode());
  }

  /** Fetch exit code from Blaxel and set _exitCode. No-op if already set. */
  private async _resolveExitCode(): Promise<void> {
    if (this._exitCode !== undefined) return;
    try {
      const proc = await this._sandbox.process.get(this.pid);
      this._exitCode = proc.status === 'completed' ? (proc.exitCode ?? 0) : (proc.exitCode ?? 1);
    } catch {
      if (this._exitCode === undefined) {
        this._exitCode = 1;
      }
    }
  }

  async wait(): Promise<CommandResult> {
    // Idempotent — cache the promise so repeated calls return the same result
    if (!this._waitPromise) {
      this._waitPromise = this._doWait();
    }
    return this._waitPromise;
  }

  private async _doWait(): Promise<CommandResult> {
    // Wait for streaming to complete
    if (this._streamingDone) {
      await this._streamingDone.catch(() => {});
    }

    // If killed during wait, return with kill exit code
    if (this._killed) {
      return {
        success: false,
        exitCode: this._exitCode ?? 137,
        stdout: this.stdout,
        stderr: this.stderr,
        executionTimeMs: Date.now() - this._startTime,
      };
    }

    // Ensure exit code is resolved
    await this._resolveExitCode();

    return {
      success: this._exitCode === 0,
      exitCode: this._exitCode ?? 1,
      stdout: this.stdout,
      stderr: this.stderr,
      executionTimeMs: Date.now() - this._startTime,
    };
  }

  async kill(): Promise<boolean> {
    if (this._exitCode !== undefined) return false;
    this._killed = true;
    this._exitCode = 137; // SIGKILL
    this._closeStream?.();
    try {
      await this._sandbox.process.kill(this.pid);
    } catch {
      // Process may already be gone
    }
    return true;
  }

  async sendStdin(data: string): Promise<void> {
    if (this._exitCode !== undefined) {
      throw new Error(`Process ${this.pid} has already exited with code ${this._exitCode}`);
    }
    if (this._stdinMode === 'ignore') {
      throw new Error(`Process ${this.pid} was not started with stdin support`);
    }
    await this._sandbox.process.writeStdin(this.pid, data);
  }

  async closeStdin(): Promise<void> {
    if (this._stdinMode === 'ignore') {
      throw new Error(`Process ${this.pid} was not started with stdin support`);
    }
    // Stdin is already gone once the process exits; ending the writer after exit must not fail.
    if (this._exitCode !== undefined) return;
    await this._sandbox.process.closeStdin(this.pid);
  }
}

// =============================================================================
// Blaxel Process Manager
// =============================================================================

/**
 * Blaxel implementation of SandboxProcessManager.
 * Uses the Blaxel SDK's process API for background process management.
 */
export class BlaxelProcessManager extends SandboxProcessManager<BlaxelSandbox> {
  async spawn(command: string, options: SpawnProcessOptions = {}): Promise<ProcessHandle> {
    return this.sandbox.retryOnDead(async () => {
      const blaxel = this.sandbox.blaxel;

      // The base spawn wrapper already merged the sandbox env into options.env
      const mergedEnv = { ...options.env };
      const envs = Object.fromEntries(
        Object.entries(mergedEnv).filter((entry): entry is [string, string] => entry[1] !== undefined),
      );

      // Spawn as background process
      const result = await blaxel.process.exec({
        command,
        waitForCompletion: false,
        // `stdinMode: 'ignore'` keeps stdin closed so a command that reads it
        // (a bare `grep`/`cat`) sees EOF instead of hanging until timeout.
        stdin: options.stdinMode !== 'ignore',
        workingDir: options.cwd ?? this.sandbox.workingDirectory,
        ...(Object.keys(envs).length > 0 && { env: envs }),
        ...(options.timeout && { timeout: Math.ceil(options.timeout / 1000) }),
      });

      const pid = result.pid;
      const handle = new BlaxelProcessHandle(pid, blaxel, Date.now(), options);

      // Start streaming logs — route to handle's emitters.
      // streamLogs splits the log stream on newlines and delivers each line
      // without its terminator, so restore it to keep line-delimited output intact.
      const streamControl = blaxel.process.streamLogs(pid, {
        onStdout: (data: string) => handle.emitStdout(`${data}\n`),
        onStderr: (data: string) => handle.emitStderr(`${data}\n`),
        onError: (err: Error | string) => {
          const msg = err instanceof Error ? err.message : String(err);
          handle.emitStderr(msg);
        },
      });

      handle.streamControl = streamControl;
      this._tracked.set(pid, handle);
      return handle;
    });
  }

  async list(): Promise<ProcessInfo[]> {
    const result: ProcessInfo[] = [];
    for (const [pid, handle] of this._tracked) {
      result.push({
        pid,
        command: handle.command,
        running: handle.exitCode === undefined,
        exitCode: handle.exitCode,
      });
    }
    return result;
  }
}
