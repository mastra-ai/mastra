/**
 * Vercel Sandbox (MicroVM) Process Manager
 *
 * Implements SandboxProcessManager for the `@vercel/sandbox` SDK. Each spawn()
 * starts a detached command via `sandbox.runCommand({ detached: true })` and
 * streams its output through the command's async `logs()` iterator.
 *
 * The Vercel Sandbox SDK does not expose a stdin channel for running commands,
 * so `sendStdin()` throws a clear "not supported" error.
 */

import { ProcessHandle, SandboxProcessManager } from '@mastra/core/workspace';
import type { CommandResult, ProcessInfo, SpawnProcessOptions } from '@mastra/core/workspace';
import type { Command } from '@vercel/sandbox';
import type { VercelSandbox } from './index';

// =============================================================================
// Process Handle
// =============================================================================

/**
 * Wraps a detached Vercel Sandbox {@link Command} to conform to Mastra's
 * ProcessHandle. Not exported — internal to this module.
 */
class VercelSandboxProcessHandle extends ProcessHandle {
  readonly pid: string;

  private readonly _command: Command;
  private readonly _startTime: number;
  private readonly _timeout?: number;

  private _exitCode: number | undefined;
  private _waitPromise: Promise<CommandResult> | null = null;
  private _streamingPromise: Promise<void> | null = null;
  private _killed = false;

  constructor(command: Command, startTime: number, options?: SpawnProcessOptions) {
    super(options);
    this.pid = command.cmdId;
    this._command = command;
    this._startTime = startTime;
    this._timeout = options?.timeout;
  }

  get exitCode(): number | undefined {
    return this._exitCode;
  }

  /** @internal Set by the process manager after streaming starts. */
  set streamingPromise(p: Promise<void>) {
    this._streamingPromise = p;
  }

  async wait(): Promise<CommandResult> {
    if (!this._waitPromise) {
      this._waitPromise = this._doWait();
    }
    return this._waitPromise;
  }

  private async _doWait(): Promise<CommandResult> {
    const finishedPromise = this._command
      .wait()
      .then(finished => {
        if (this._exitCode === undefined) this._exitCode = finished.exitCode;
      })
      .catch(() => {
        if (this._exitCode === undefined) this._exitCode = 1;
      });

    if (this._timeout) {
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      const timeoutPromise = new Promise<'timeout'>(resolve => {
        timeoutId = setTimeout(() => resolve('timeout'), this._timeout);
      });

      const outcome = await Promise.race([finishedPromise.then(() => 'done' as const), timeoutPromise]);
      clearTimeout(timeoutId);

      if (outcome === 'timeout') {
        await this.kill();
        this._exitCode = 124;
        await this._streamingPromise?.catch(() => {});
        return {
          success: false,
          exitCode: 124,
          stdout: this.stdout,
          stderr: this.stderr || `Command timed out after ${this._timeout}ms`,
          executionTimeMs: Date.now() - this._startTime,
          killed: true,
          timedOut: true,
        };
      }
    } else {
      await finishedPromise;
    }

    // Drain any remaining streamed output before reporting the result.
    await this._streamingPromise?.catch(() => {});

    if (this._killed) {
      return {
        success: false,
        exitCode: this._exitCode ?? 137,
        stdout: this.stdout,
        stderr: this.stderr,
        executionTimeMs: Date.now() - this._startTime,
        killed: true,
        timedOut: false,
      };
    }

    return {
      success: this._exitCode === 0,
      exitCode: this._exitCode ?? 1,
      stdout: this.stdout,
      stderr: this.stderr,
      executionTimeMs: Date.now() - this._startTime,
    };
  }

  async kill(): Promise<boolean> {
    if (this._exitCode !== undefined && !this._killed) return false;
    this._killed = true;
    if (this._exitCode === undefined) this._exitCode = 137; // SIGKILL
    try {
      await this._command.kill();
    } catch {
      // Command may already be gone.
    }
    return true;
  }

  async sendStdin(_data: string): Promise<void> {
    throw new Error('VercelSandbox does not support sending stdin to running processes.');
  }
}

// =============================================================================
// Process Manager
// =============================================================================

export interface VercelSandboxProcessManagerOptions {
  env?: Record<string, string | undefined>;
}

/**
 * Vercel Sandbox implementation of SandboxProcessManager. Uses one detached
 * `runCommand` per spawned process.
 */
export class VercelSandboxProcessManager extends SandboxProcessManager<VercelSandbox> {
  async spawn(command: string, options: SpawnProcessOptions = {}): Promise<ProcessHandle> {
    const mergedEnv = { ...this.env, ...options.env };
    const env = Object.fromEntries(
      Object.entries(mergedEnv).filter((entry): entry is [string, string] => entry[1] !== undefined),
    );

    // The workspace passes a full command string; run it through a shell so
    // pipes, redirects, and builtins behave as expected.
    const cmd = await this.sandbox.sandbox.runCommand({
      cmd: 'sh',
      args: ['-c', command],
      ...(options.cwd ? { cwd: options.cwd } : {}),
      ...(Object.keys(env).length ? { env } : {}),
      detached: true,
    });

    const handle = new VercelSandboxProcessHandle(cmd, Date.now(), options);

    const streamingPromise = (async () => {
      for await (const log of cmd.logs()) {
        if (log.stream === 'stdout') handle.emitStdout(log.data);
        else handle.emitStderr(log.data);
      }
    })().catch(() => {
      // Stream ends when the command exits or is killed — swallow the error.
    });

    handle.streamingPromise = streamingPromise;

    this._tracked.set(handle.pid, handle);
    return handle;
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
