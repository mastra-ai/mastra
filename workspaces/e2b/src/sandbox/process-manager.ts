/**
 * E2B Process Manager
 *
 * Implements SandboxProcessManager for E2B cloud sandboxes.
 * Wraps the E2B SDK's commands API (background mode, sendStdin, kill, list).
 */

import { ProcessHandle, SandboxProcessManager } from '@mastra/core/workspace';
import type { CommandResult, ProcessInfo, SpawnProcessOptions } from '@mastra/core/workspace';
import type { CommandHandle as E2BCommandHandle, Sandbox } from 'e2b';
import type { E2BSandbox } from './index';

// =============================================================================
// E2B Process Handle
// =============================================================================

/**
 * Wraps an E2B CommandHandle to conform to Mastra's ProcessHandle.
 * Not exported — internal to this module.
 *
 * Listener dispatch is handled by the base class. The manager's spawn()/get()
 * methods wire E2B's constructor-time callbacks to handle.emitStdout/emitStderr.
 */
class E2BProcessHandle extends ProcessHandle {
  readonly pid: number;

  private readonly _e2bHandle: E2BCommandHandle;
  private readonly _sandbox: Sandbox;
  private readonly _startTime: number;

  constructor(e2bHandle: E2BCommandHandle, sandbox: Sandbox, startTime: number, options?: SpawnProcessOptions) {
    super(options);
    this.pid = e2bHandle.pid;
    this._e2bHandle = e2bHandle;
    this._sandbox = sandbox;
    this._startTime = startTime;
  }

  /** Delegates to E2B's handle so exitCode reflects server-side state without needing wait(). */
  get exitCode(): number | undefined {
    return this._e2bHandle.exitCode;
  }

  async wait(): Promise<CommandResult> {
    try {
      const result = await this._e2bHandle.wait();
      return {
        success: result.exitCode === 0,
        exitCode: result.exitCode,
        stdout: this.stdout,
        stderr: this.stderr,
        executionTimeMs: Date.now() - this._startTime,
      };
    } catch (error) {
      // E2B throws CommandExitError for non-zero exit codes (has .exitCode directly)
      // Some E2B errors also carry stdout/stderr in error.result
      const errorObj = error as {
        exitCode?: number;
        result?: { exitCode: number; stdout: string; stderr: string };
      };
      const exitCode = errorObj.result?.exitCode ?? errorObj.exitCode ?? this.exitCode ?? 1;

      // Emit any output attached to the error (E2B sometimes puts it in .result)
      if (errorObj.result?.stdout) this.emitStdout(errorObj.result.stdout);
      if (errorObj.result?.stderr) this.emitStderr(errorObj.result.stderr);

      return {
        success: false,
        exitCode,
        stdout: this.stdout,
        stderr: this.stderr || (error instanceof Error ? error.message : String(error)),
        executionTimeMs: Date.now() - this._startTime,
      };
    }
  }

  async kill(): Promise<boolean> {
    if (this.exitCode !== undefined) return false;
    return this._e2bHandle.kill();
  }

  async sendStdin(data: string): Promise<void> {
    if (this.exitCode !== undefined) {
      throw new Error(`Process ${this.pid} has already exited with code ${this.exitCode}`);
    }
    await this._sandbox.commands.sendStdin(this.pid, data);
  }
}

// =============================================================================
// E2B Process Manager
// =============================================================================

/**
 * E2B implementation of SandboxProcessManager.
 * Uses the E2B SDK's commands.run() with background: true.
 */
export class E2BProcessManager extends SandboxProcessManager<E2BSandbox> {
  async spawn(command: string, options: SpawnProcessOptions = {}): Promise<ProcessHandle> {
    return this.sandbox.retryOnDead(async () => {
      const e2b = this.sandbox.e2b;

      // Merge default env with per-spawn env
      const mergedEnv = { ...this.env, ...options.env };
      const envs = Object.fromEntries(
        Object.entries(mergedEnv).filter((entry): entry is [string, string] => entry[1] !== undefined),
      );

      // Deferred reference — E2B requires callbacks at run() time, but data
      // arrives asynchronously after the promise resolves, so handle is always
      // assigned by the time the first callback fires.
      let handle: E2BProcessHandle;

      const e2bHandle = await e2b.commands.run(command, {
        background: true,
        stdin: true,
        cwd: options.cwd,
        envs,
        timeoutMs: options.timeout,
        onStdout: (data: string) => handle.emitStdout(data),
        onStderr: (data: string) => handle.emitStderr(data),
      });

      handle = new E2BProcessHandle(e2bHandle, e2b, Date.now(), options);
      this._tracked.set(handle.pid, handle);
      return handle;
    });
  }

  /**
   * List processes by querying E2B's commands API.
   * E2B manages all state server-side — no local tracking needed.
   */
  async list(): Promise<ProcessInfo[]> {
    const e2b = this.sandbox.e2b;
    const procs = await e2b.commands.list();
    return procs.map(proc => ({
      pid: proc.pid,
      command: [proc.cmd, ...proc.args].join(' '),
      running: true, // E2B only lists running processes
    }));
  }

  /**
   * Get a handle to a process by PID.
   * Checks base class tracking first, then falls back to commands.connect()
   * for processes spawned externally or before reconnection.
   */
  async get(pid: number): Promise<ProcessHandle | undefined> {
    const tracked = this._tracked.get(pid);
    if (tracked) return tracked;

    // Fall back to connect() for unknown PIDs (e.g., pre-existing processes)
    const e2b = this.sandbox.e2b;
    let handle: E2BProcessHandle;
    try {
      const e2bHandle = await e2b.commands.connect(pid, {
        onStdout: (data: string) => handle.emitStdout(data),
        onStderr: (data: string) => handle.emitStderr(data),
      });
      handle = new E2BProcessHandle(e2bHandle, e2b, Date.now());
      this._tracked.set(pid, handle);
      return handle;
    } catch {
      return undefined;
    }
  }
}
