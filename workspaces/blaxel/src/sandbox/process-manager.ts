/**
 * Blaxel Process Manager
 *
 * Implements SandboxProcessManager for Blaxel cloud sandboxes.
 * Wraps the Blaxel SDK's process API (exec, list, get, kill, streamLogs)
 * for background process management.
 *
 * Key limitation: Blaxel sandboxes do not support stdin.
 * ProcessHandle.sendStdin() throws and the writer stream will error.
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
  readonly pid: number;

  private readonly _identifier: string;
  private readonly _sandbox: SandboxInstance;
  private readonly _startTime: number;

  private _exitCode: number | undefined;
  private _waitPromise: Promise<CommandResult> | null = null;
  private _streamingDone: Promise<void> | null = null;
  private _closeStream: (() => void) | null = null;
  private _killed = false;

  constructor(
    pid: number,
    identifier: string,
    sandbox: SandboxInstance,
    startTime: number,
    options?: SpawnProcessOptions,
  ) {
    super(options);
    this.pid = pid;
    this._identifier = identifier;
    this._sandbox = sandbox;
    this._startTime = startTime;
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
      const proc = await this._sandbox.process.get(this._identifier);
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
      await this._sandbox.process.kill(this._identifier);
    } catch {
      // Process may already be gone
    }
    return true;
  }

  async sendStdin(_data: string): Promise<void> {
    throw new Error('Blaxel sandboxes do not support stdin');
  }
}

// =============================================================================
// Blaxel Process Manager
// =============================================================================

export interface BlaxelProcessManagerOptions {
  env?: Record<string, string | undefined>;
}

/**
 * Blaxel implementation of SandboxProcessManager.
 * Uses the Blaxel SDK's process API for background process management.
 */
export class BlaxelProcessManager extends SandboxProcessManager<BlaxelSandbox> {
  constructor(opts: BlaxelProcessManagerOptions = {}) {
    super({ env: opts.env });
  }

  async spawn(command: string, options: SpawnProcessOptions = {}): Promise<ProcessHandle> {
    return this.sandbox.retryOnDead(async () => {
      const blaxel = this.sandbox.instance;

      // Merge default env with per-spawn env
      const mergedEnv = { ...this.env, ...options.env };
      const envs = Object.fromEntries(
        Object.entries(mergedEnv).filter((entry): entry is [string, string] => entry[1] !== undefined),
      );

      // Spawn as background process
      const result = await blaxel.process.exec({
        command,
        waitForCompletion: false,
        workingDir: options.cwd,
        ...(Object.keys(envs).length > 0 && { env: envs }),
        ...(options.timeout && { timeout: Math.ceil(options.timeout / 1000) }),
      });

      // Blaxel PIDs are numeric strings (e.g. "412") — parse to number for ProcessHandle.
      // Keep the original string as _identifier for SDK calls (streamLogs, get, kill).
      const identifier = result.pid;
      const pid = parseInt(identifier, 10);
      const handle = new BlaxelProcessHandle(pid, identifier, blaxel, Date.now(), options);

      // Start streaming logs — route to handle's emitters
      const streamControl = blaxel.process.streamLogs(identifier, {
        onStdout: (data: string) => handle.emitStdout(data),
        onStderr: (data: string) => handle.emitStderr(data),
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

  async get(pid: number): Promise<ProcessHandle | undefined> {
    return this._tracked.get(pid);
  }
}
