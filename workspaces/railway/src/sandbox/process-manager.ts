/**
 * Railway Process Manager
 *
 * Implements SandboxProcessManager for Railway sandboxes.
 * Wraps the Railway SDK's `Sandbox.exec()` API.
 *
 * Railway's `exec(command, options)` accepts per-call `cwd` and `env` options
 * (since SDK v3.3.1) and returns an `ExecHandle` that runs the command
 * server-side, independently of the client. Each spawn() starts one exec.
 * The handle streams output via `onStdout`/`onStderr` callbacks wired to
 * `emitStdout`/`emitStderr`, exposes a durable `sessionName`, and can be
 * terminated with `kill(signal)`.
 */

import { ProcessHandle, SandboxProcessManager } from '@mastra/core/workspace';
import type { CommandResult, ProcessInfo, SpawnProcessOptions } from '@mastra/core/workspace';
import type { ExecHandle, ExecResult } from 'railway';
import type { RailwaySandbox } from './index';

export const LOG_PREFIX = '[RailwaySandbox]';

// =============================================================================
// Railway Process Handle
// =============================================================================

/**
 * Wraps a Railway ExecHandle to conform to Mastra's ProcessHandle.
 * Not exported — internal to this module.
 */
class RailwayProcessHandle extends ProcessHandle {
  readonly pid: string;

  private readonly _execHandle: ExecHandle;
  private readonly _startTime: number;
  private _exitCode: number | undefined;
  private _waitPromise: Promise<CommandResult> | null = null;
  private _killed = false;

  constructor(pid: string, execHandle: ExecHandle, startTime: number, options?: SpawnProcessOptions) {
    super(options);
    this.pid = pid;
    this._execHandle = execHandle;
    this._startTime = startTime;

    // Resolve exit code once the command completes so exitCode is available
    // without an explicit wait().
    void this._execHandle.then(
      (result: ExecResult) => {
        // -1 means terminated by a signal (e.g. after kill()).
        this._exitCode = result.exitCode ?? (this._killed ? 137 : -1);
      },
      () => {
        if (this._exitCode === undefined) {
          this._exitCode = 1;
        }
      },
    );
  }

  get exitCode(): number | undefined {
    return this._exitCode;
  }

  async wait(): Promise<CommandResult> {
    // Idempotent — cache the promise so repeated calls return the same result.
    if (!this._waitPromise) {
      this._waitPromise = this._doWait();
    }
    return this._waitPromise;
  }

  private async _doWait(): Promise<CommandResult> {
    try {
      const result = await this._execHandle;
      const exitCode = result.exitCode ?? (this._killed ? 137 : -1);
      this._exitCode = exitCode;

      // Railway captures output server-side; surface it through the base buffers
      // if streaming callbacks didn't already populate them.
      if (result.stdout && !this.stdout) this.emitStdout(result.stdout);
      if (result.stderr && !this.stderr) this.emitStderr(result.stderr);

      return {
        success: exitCode === 0,
        exitCode,
        stdout: this.stdout,
        stderr: this.stderr,
        executionTimeMs: Date.now() - this._startTime,
        killed: this._killed,
        timedOut: result.timedOut,
      };
    } catch (error) {
      const exitCode = this._exitCode ?? 1;
      this._exitCode = exitCode;
      return {
        success: false,
        exitCode,
        stdout: this.stdout,
        stderr: this.stderr || (error instanceof Error ? error.message : String(error)),
        executionTimeMs: Date.now() - this._startTime,
        killed: this._killed,
      };
    }
  }

  async kill(): Promise<boolean> {
    if (this._exitCode !== undefined) return false;
    this._killed = true;
    try {
      return await this._execHandle.kill('TERM');
    } catch {
      // Command may already be gone.
      return false;
    }
  }

  async sendStdin(_data: string): Promise<void> {
    // Railway's exec API does not expose stdin streaming.
    throw new Error(`${LOG_PREFIX} sending stdin is not supported by the Railway sandbox provider`);
  }
}

// =============================================================================
// Railway Process Manager
// =============================================================================

export interface RailwayProcessManagerOptions {
  env?: Record<string, string | undefined>;
}

/**
 * Railway implementation of SandboxProcessManager.
 * Uses the Railway SDK's `Sandbox.exec()` with one exec per spawned process.
 */
export class RailwayProcessManager extends SandboxProcessManager<RailwaySandbox> {
  private _spawnCounter = 0;

  constructor(opts: RailwayProcessManagerOptions = {}) {
    super({ env: opts.env });
  }

  async spawn(command: string, options: SpawnProcessOptions = {}): Promise<ProcessHandle> {
    const railway = this.sandbox.railway;

    // Merge default env with per-spawn env.
    const mergedEnv = { ...this.env, ...options.env };
    const env = Object.fromEntries(
      Object.entries(mergedEnv).filter((entry): entry is [string, string] => entry[1] !== undefined),
    );

    const pid = `railway-proc-${Date.now().toString(36)}-${(this._spawnCounter++).toString(36)}`;

    // Deferred reference — callbacks fire asynchronously after the handle is
    // assigned, so `handle` is always defined by the time they run.
    let handle: RailwayProcessHandle;

    const execHandle = railway.exec(command, {
      ...(options.timeout !== undefined && { timeoutSec: Math.ceil(options.timeout / 1000) }),
      ...(options.cwd !== undefined && { cwd: options.cwd }),
      ...(Object.keys(env).length > 0 && { env }),
      onStdout: (chunk: string) => handle.emitStdout(chunk),
      onStderr: (chunk: string) => handle.emitStderr(chunk),
    });

    handle = new RailwayProcessHandle(pid, execHandle, Date.now(), options);
    this._tracked.set(handle.pid, handle);
    return handle;
  }

  /**
   * List tracked processes.
   *
   * Railway has no API to enumerate running exec sessions by sandbox, so this
   * reports the processes this manager spawned.
   */
  async list(): Promise<ProcessInfo[]> {
    return Array.from(this._tracked.values()).map(handle => ({
      pid: handle.pid,
      command: handle.command,
      running: handle.exitCode === undefined,
      ...(handle.exitCode !== undefined && { exitCode: handle.exitCode }),
    }));
  }
}
