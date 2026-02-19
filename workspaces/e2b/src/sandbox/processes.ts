/**
 * E2B Process Manager
 *
 * Implements SandboxProcessManager for E2B cloud sandboxes.
 * Wraps the E2B SDK's commands API (background mode, sendStdin, kill, list).
 */

import type {
  CommandHandle as MastraCommandHandle,
  CommandResult,
  ProcessInfo,
  SandboxProcessManager,
  SpawnProcessOptions,
} from '@mastra/core/workspace';
import type { CommandHandle as E2BCommandHandle, Sandbox } from 'e2b';

import { shellQuote } from '../utils/shell-quote';

// =============================================================================
// E2B Command Handle
// =============================================================================

/**
 * Wraps an E2B CommandHandle to conform to Mastra's CommandHandle interface.
 * Not exported — internal to this module.
 */
class E2BHandle implements MastraCommandHandle {
  readonly pid: number;
  readonly command: string;
  readonly args: string[];

  private readonly _e2bHandle: E2BCommandHandle;
  private readonly _sandbox: Sandbox;
  private readonly _startTime: number;

  constructor(e2bHandle: E2BCommandHandle, sandbox: Sandbox, command: string, args: string[], startTime: number) {
    this.pid = e2bHandle.pid;
    this.command = command;
    this.args = args;
    this._e2bHandle = e2bHandle;
    this._sandbox = sandbox;
    this._startTime = startTime;
  }

  get stdout(): string {
    return this._e2bHandle.stdout;
  }

  get stderr(): string {
    return this._e2bHandle.stderr;
  }

  get exitCode(): number | undefined {
    return this._e2bHandle.exitCode;
  }

  get running(): boolean {
    return this.exitCode === undefined;
  }

  async wait(): Promise<CommandResult> {
    try {
      const result = await this._e2bHandle.wait();
      return {
        success: result.exitCode === 0,
        exitCode: result.exitCode,
        stdout: result.stdout,
        stderr: result.stderr,
        executionTimeMs: Date.now() - this._startTime,
        command: this.command,
        args: this.args,
      };
    } catch (error) {
      // E2B throws CommandExitError for non-zero exit codes
      const errorObj = error as { exitCode?: number; stdout?: string; stderr?: string };
      return {
        success: false,
        exitCode: errorObj.exitCode ?? 1,
        stdout: errorObj.stdout ?? this._e2bHandle.stdout,
        stderr: errorObj.stderr ?? this._e2bHandle.stderr,
        executionTimeMs: Date.now() - this._startTime,
        command: this.command,
        args: this.args,
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
// E2B Process Manager
// =============================================================================

/**
 * E2B implementation of SandboxProcessManager.
 * Uses the E2B SDK's commands.run() with background: true.
 * Auto-starts the sandbox when spawn is called.
 */
export class E2BProcessManager implements SandboxProcessManager {
  private readonly _sandbox: { ensureRunning(): Promise<void>; readonly instance: Sandbox };
  private readonly _handles = new Map<number, E2BHandle>();
  private readonly _env: Record<string, string>;

  constructor(
    sandbox: { ensureRunning(): Promise<void>; readonly instance: Sandbox },
    env: Record<string, string> = {},
  ) {
    this._sandbox = sandbox;
    this._env = env;
  }

  async spawn(command: string, args: string[] = [], options: SpawnProcessOptions = {}): Promise<MastraCommandHandle> {
    await this._sandbox.ensureRunning();
    const e2b = this._sandbox.instance;
    const startTime = Date.now();

    const fullCommand = args.length > 0 ? `${command} ${args.map(shellQuote).join(' ')}` : command;

    // Merge default env with per-spawn env
    const mergedEnv = { ...this._env, ...options.env };
    const envs = Object.fromEntries(
      Object.entries(mergedEnv).filter((entry): entry is [string, string] => entry[1] !== undefined),
    );

    const e2bHandle = await e2b.commands.run(fullCommand, {
      background: true,
      stdin: true,
      cwd: options.cwd,
      envs,
    });

    const handle = new E2BHandle(e2bHandle, e2b, command, args, startTime);
    this._handles.set(handle.pid, handle);

    return handle;
  }

  async list(): Promise<ProcessInfo[]> {
    return Array.from(this._handles.values()).map(handle => handle.toProcessInfo());
  }

  get(pid: number): MastraCommandHandle | undefined {
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
