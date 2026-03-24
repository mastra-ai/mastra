/**
 * Vercel Sandbox Process Manager
 *
 * Implements SandboxProcessManager for Vercel Sandbox microVMs.
 * Wraps the @vercel/sandbox SDK's runCommand API (detached mode, kill, logs).
 */

import { ProcessHandle, SandboxProcessManager } from '@mastra/core/workspace';
import type { CommandResult, ProcessInfo, SpawnProcessOptions } from '@mastra/core/workspace';
import type { Sandbox, Command as VercelCommand } from '@vercel/sandbox';
import type { VercelSandbox } from './index';

// =============================================================================
// Vercel Process Handle
// =============================================================================

/**
 * Wraps a Vercel SDK Command to conform to Mastra's ProcessHandle.
 * Not exported — internal to this module.
 *
 * The Vercel SDK uses cmdId (string) as the process identifier, not numeric PIDs.
 * Logs are streamed via an async generator and dispatched through the base class
 * emitStdout/emitStderr mechanism.
 */
class VercelProcessHandle extends ProcessHandle {
  readonly pid: string;

  private readonly _vercelCommand: VercelCommand;
  private readonly _startTime: number;
  private _exitCode: number | undefined;

  constructor(
    vercelCommand: VercelCommand,
    startTime: number,
    options?: SpawnProcessOptions,
  ) {
    super(options);
    this.pid = vercelCommand.cmdId;
    this._vercelCommand = vercelCommand;
    this._startTime = startTime;

    // Start streaming logs immediately so emitStdout/emitStderr fire
    void this._streamLogs();
  }

  get exitCode(): number | undefined {
    if (this._exitCode !== undefined) return this._exitCode;
    const sdkCode = this._vercelCommand.exitCode;
    return sdkCode !== null ? sdkCode : undefined;
  }

  async wait(): Promise<CommandResult> {
    try {
      const finished = await this._vercelCommand.wait();
      this._exitCode = finished.exitCode;

      return {
        success: finished.exitCode === 0,
        exitCode: finished.exitCode,
        stdout: this.stdout,
        stderr: this.stderr,
        executionTimeMs: Date.now() - this._startTime,
      };
    } catch (error) {
      const sdkCode = this._vercelCommand.exitCode;
      const exitCode = sdkCode !== null ? sdkCode : (this._exitCode ?? 1);
      this._exitCode = exitCode;

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
    if (this._exitCode !== undefined) return false;
    try {
      await this._vercelCommand.kill();
      return true;
    } catch {
      return false;
    }
  }

  async sendStdin(_data: string): Promise<void> {
    throw new Error('sendStdin is not supported by Vercel Sandbox');
  }

  /**
   * Stream logs from the Vercel command and dispatch via emitStdout/emitStderr.
   * Runs in the background — errors are swallowed since log streaming is best-effort.
   */
  private async _streamLogs(): Promise<void> {
    try {
      for await (const log of this._vercelCommand.logs()) {
        if (log.stream === 'stdout') {
          this.emitStdout(log.data);
        } else {
          this.emitStderr(log.data);
        }
      }
    } catch {
      // Log streaming ended (sandbox stopped or command exited) — non-fatal
    }
  }
}

// =============================================================================
// Vercel Process Manager
// =============================================================================

/**
 * Vercel implementation of SandboxProcessManager.
 * Uses the @vercel/sandbox SDK's runCommand() with detached: true.
 */
export class VercelProcessManager extends SandboxProcessManager<VercelSandbox> {
  async spawn(command: string, options: SpawnProcessOptions = {}): Promise<ProcessHandle> {
    const vercelSandbox = this.sandbox.vercel;

    // Merge default env with per-spawn env
    const mergedEnv = { ...this.env, ...options.env };
    const env = Object.fromEntries(
      Object.entries(mergedEnv).filter((entry): entry is [string, string] => entry[1] !== undefined),
    );

    const vercelCommand = await vercelSandbox.runCommand({
      cmd: command,
      cwd: options.cwd,
      env: Object.keys(env).length > 0 ? env : undefined,
      detached: true,
    });

    const handle = new VercelProcessHandle(vercelCommand, Date.now(), options);
    this._tracked.set(handle.pid, handle);
    return handle;
  }

  async list(): Promise<ProcessInfo[]> {
    // Return tracked processes — Vercel SDK doesn't expose a list-all-processes API
    const infos: ProcessInfo[] = [];
    for (const [pid, handle] of this._tracked) {
      infos.push({
        pid,
        command: handle.command,
        running: handle.exitCode === undefined,
        exitCode: handle.exitCode,
      });
    }
    return infos;
  }

  async get(pid: string): Promise<ProcessHandle | undefined> {
    const tracked = this._tracked.get(pid);
    if (tracked) return tracked;

    // Try to reconnect to the command by cmdId
    try {
      const vercelSandbox = this.sandbox.vercel;
      const vercelCommand = await vercelSandbox.getCommand(pid);
      const handle = new VercelProcessHandle(vercelCommand, Date.now());
      this._tracked.set(handle.pid, handle);
      return handle;
    } catch {
      return undefined;
    }
  }
}
