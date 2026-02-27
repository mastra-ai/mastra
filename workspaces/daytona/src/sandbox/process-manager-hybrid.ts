/**
 * Daytona Hybrid Process Manager (Approach B)
 *
 * Combines Session API for spawn() (same as the existing DaytonaProcessManager)
 * with PTY-based fallback in get() for reconnecting to externally-spawned processes.
 *
 * - spawn() → Session API (full stdout/stderr separation)
 * - get(pid) → tracked lookup first, then PTY fallback for unknown PIDs
 * - list() → tracked + external PTY sessions
 *
 * This is a lower-risk approach: spawn behavior is identical to the current
 * implementation, and the PTY fallback only activates for unknown PIDs.
 *
 * @internal Prototype — not exported from package index
 */

import type { Sandbox, PtyHandle } from '@daytonaio/sdk';
import { ProcessHandle, SandboxProcessManager } from '@mastra/core/workspace';
import type { CommandResult, ProcessInfo, SpawnProcessOptions } from '@mastra/core/workspace';

import { shellQuote } from '../utils/shell-quote';
import type { DaytonaSandbox } from './index';

// =============================================================================
// Session-Based Process Handle (copied from process-manager.ts)
// =============================================================================

/**
 * Wraps a Daytona session + command pair. Identical to the existing
 * DaytonaProcessHandle — duplicated here to keep the prototype self-contained.
 */
class DaytonaHybridProcessHandle extends ProcessHandle {
  readonly pid: number;

  private readonly _sessionId: string;
  private readonly _cmdId: string;
  private readonly _sandbox: Sandbox;
  private readonly _startTime: number;
  private readonly _timeout?: number;

  private _exitCode: number | undefined;
  private _waitPromise: Promise<CommandResult> | null = null;
  private _streamingPromise: Promise<void> | null = null;
  private _killed = false;

  constructor(
    pid: number,
    sessionId: string,
    cmdId: string,
    sandbox: Sandbox,
    startTime: number,
    options?: SpawnProcessOptions,
  ) {
    super(options);
    this.pid = pid;
    this._sessionId = sessionId;
    this._cmdId = cmdId;
    this._sandbox = sandbox;
    this._startTime = startTime;
    this._timeout = options?.timeout;
  }

  get exitCode(): number | undefined {
    return this._exitCode;
  }

  /** @internal Set by the process manager after streaming starts. */
  set streamingPromise(p: Promise<void>) {
    this._streamingPromise = p;
    p.then(() => this._resolveExitCode()).catch(() => this._resolveExitCode());
  }

  private async _resolveExitCode(): Promise<void> {
    if (this._exitCode !== undefined) return;
    try {
      const cmd = await this._sandbox.process.getSessionCommand(this._sessionId, this._cmdId);
      this._exitCode = cmd.exitCode ?? 0;
    } catch {
      if (this._exitCode === undefined) {
        this._exitCode = 1;
      }
    }
  }

  async wait(): Promise<CommandResult> {
    if (!this._waitPromise) {
      this._waitPromise = this._doWait();
    }
    return this._waitPromise;
  }

  private async _doWait(): Promise<CommandResult> {
    const streamDone = this._streamingPromise ?? Promise.resolve();

    if (this._timeout) {
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(`Command timed out after ${this._timeout}ms`)), this._timeout);
      });

      try {
        await Promise.race([streamDone, timeoutPromise]);
      } catch (error) {
        if (error instanceof Error && error.message.includes('timed out')) {
          await this.kill();
          this._exitCode = 124;
          return {
            success: false,
            exitCode: 124,
            stdout: this.stdout,
            stderr: this.stderr || error.message,
            executionTimeMs: Date.now() - this._startTime,
          };
        }
        throw error;
      } finally {
        clearTimeout(timeoutId);
      }
    } else {
      await streamDone.catch(() => {});
    }

    if (this._killed) {
      return {
        success: false,
        exitCode: this._exitCode ?? 137,
        stdout: this.stdout,
        stderr: this.stderr,
        executionTimeMs: Date.now() - this._startTime,
      };
    }

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
    this._exitCode = 137;
    try {
      await this._sandbox.process.deleteSession(this._sessionId);
    } catch {
      // Session may already be gone
    }
    return true;
  }

  async sendStdin(data: string): Promise<void> {
    if (this._exitCode !== undefined) {
      throw new Error(`Process ${this.pid} has already exited with code ${this._exitCode}`);
    }
    await this._sandbox.process.sendSessionCommandInput(this._sessionId, this._cmdId, data);
  }
}

// =============================================================================
// PTY Reconnect Handle (for externally-spawned processes)
// =============================================================================

/**
 * Handle for processes discovered via PTY reconnection.
 * All PTY output is routed to stdout (no stderr separation for reconnected processes).
 */
class DaytonaPtyReconnectHandle extends ProcessHandle {
  readonly pid: number;

  private readonly _ptyHandle: PtyHandle;
  private readonly _ptySessionId: string;
  private readonly _sandbox: Sandbox;
  private readonly _startTime: number;

  private _exitCode: number | undefined;
  private _waitPromise: Promise<CommandResult> | null = null;
  private _killed = false;

  constructor(pid: number, ptyHandle: PtyHandle, ptySessionId: string, sandbox: Sandbox) {
    super();
    this.pid = pid;
    this._ptyHandle = ptyHandle;
    this._ptySessionId = ptySessionId;
    this._sandbox = sandbox;
    this._startTime = Date.now();
  }

  get exitCode(): number | undefined {
    return this._exitCode;
  }

  async wait(): Promise<CommandResult> {
    if (!this._waitPromise) {
      this._waitPromise = this._doWait();
    }
    return this._waitPromise;
  }

  private async _doWait(): Promise<CommandResult> {
    if (this._killed) {
      return {
        success: false,
        exitCode: this._exitCode ?? 137,
        stdout: this.stdout,
        stderr: this.stderr,
        executionTimeMs: Date.now() - this._startTime,
      };
    }

    try {
      const result = await this._ptyHandle.wait();
      this._exitCode = result.exitCode ?? 0;
    } catch {
      if (this._exitCode === undefined) {
        this._exitCode = 1;
      }
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
    if (this._exitCode !== undefined) return false;
    this._killed = true;
    this._exitCode = 137;
    try {
      await this._sandbox.process.killPtySession(this._ptySessionId);
    } catch {
      // Session may already be gone
    }
    try {
      await this._ptyHandle.disconnect();
    } catch {
      // Best-effort cleanup
    }
    return true;
  }

  async sendStdin(data: string): Promise<void> {
    if (this._exitCode !== undefined) {
      throw new Error(`Process ${this.pid} has already exited with code ${this._exitCode}`);
    }
    await this._ptyHandle.sendInput(data);
  }
}

// =============================================================================
// Hybrid Process Manager
// =============================================================================

export interface DaytonaHybridProcessManagerOptions {
  env?: Record<string, string | undefined>;
  /** Default timeout in milliseconds for commands that don't specify one. */
  defaultTimeout?: number;
}

/**
 * Hybrid process manager: Session API for spawn, PTY fallback for get().
 *
 * spawn() is identical to the existing DaytonaProcessManager.
 * get() adds a PTY-based fallback that discovers externally-spawned PTY sessions
 * and wraps them in a reconnect handle.
 */
export class DaytonaHybridProcessManager extends SandboxProcessManager<DaytonaSandbox> {
  private _nextPid = 1;
  private readonly _defaultTimeout?: number;

  /** Map from PTY session IDs to synthetic PIDs for reconnected sessions. */
  private readonly _ptySessionToPid = new Map<string, number>();

  constructor(opts: DaytonaHybridProcessManagerOptions = {}) {
    super({ env: opts.env });
    this._defaultTimeout = opts.defaultTimeout;
  }

  async spawn(command: string, options: SpawnProcessOptions = {}): Promise<ProcessHandle> {
    const effectiveOptions = {
      ...options,
      timeout: options.timeout ?? this._defaultTimeout,
    };

    return this.sandbox.retryOnDead(async () => {
      const sandbox = this.sandbox.instance;
      const pid = this._nextPid++;

      // Merge default env with per-spawn env
      const mergedEnv = { ...this.env, ...effectiveOptions.env };
      const envs = Object.fromEntries(
        Object.entries(mergedEnv).filter((entry): entry is [string, string] => entry[1] !== undefined),
      );

      const sessionCommand = buildSpawnCommand(command, effectiveOptions.cwd, envs);

      const sessionId = `mastra-proc-${Date.now().toString(36)}-${pid}`;

      await sandbox.process.createSession(sessionId);

      const { cmdId } = await sandbox.process.executeSessionCommand(sessionId, {
        command: sessionCommand,
        runAsync: true,
      });

      const handle = new DaytonaHybridProcessHandle(pid, sessionId, cmdId, sandbox, Date.now(), effectiveOptions);

      const streamingPromise = sandbox.process
        .getSessionCommandLogs(
          sessionId,
          cmdId,
          (chunk: string) => handle.emitStdout(chunk),
          (chunk: string) => handle.emitStderr(chunk),
        )
        .catch(() => {
          // Stream ends when session is deleted (e.g., after kill)
        });

      handle.streamingPromise = streamingPromise;

      this._tracked.set(pid, handle);
      return handle;
    });
  }

  async list(): Promise<ProcessInfo[]> {
    const result: ProcessInfo[] = [];

    // Include all tracked processes
    for (const [pid, handle] of this._tracked) {
      result.push({
        pid,
        command: handle.command,
        running: handle.exitCode === undefined,
        exitCode: handle.exitCode,
      });
    }

    // Discover external PTY sessions not managed by us
    try {
      const sandbox = this.sandbox.instance;
      const ptySessions = await sandbox.process.listPtySessions();

      for (const session of ptySessions) {
        // Skip sessions we created (prefixed with 'mastra-proc-')
        if (session.id.startsWith('mastra-proc-')) continue;
        // Skip sessions already tracked via reconnection
        if (this._ptySessionToPid.has(session.id)) continue;

        // Assign a synthetic PID for display purposes
        const syntheticPid = this._nextPid++;
        result.push({
          pid: syntheticPid,
          command: `[pty:${session.id}]`,
          running: session.active,
        });
      }
    } catch {
      // PTY listing is best-effort — don't fail the entire list
    }

    return result;
  }

  async get(pid: number): Promise<ProcessHandle | undefined> {
    // Check tracked processes first
    const tracked = this._tracked.get(pid);
    if (tracked) return tracked;

    // Check dismissed (already pruned)
    if (this._dismissed.has(pid)) return undefined;

    // PTY fallback: try to discover external PTY sessions
    try {
      const sandbox = this.sandbox.instance;
      const ptySessions = await sandbox.process.listPtySessions();

      for (const session of ptySessions) {
        // Skip our own sessions
        if (session.id.startsWith('mastra-proc-')) continue;
        // Skip already-tracked PTY sessions
        if (this._ptySessionToPid.has(session.id)) continue;

        // Connect to the first untracked external session
        const ptyHandle = await sandbox.process.connectPty(session.id, {
          onData: (data: Uint8Array) => {
            const text = new TextDecoder().decode(data);
            reconnectHandle.emitStdout(text);
          },
        });

        const syntheticPid = this._nextPid++;
        const reconnectHandle = new DaytonaPtyReconnectHandle(syntheticPid, ptyHandle, session.id, sandbox);

        this._ptySessionToPid.set(session.id, syntheticPid);
        this._tracked.set(syntheticPid, reconnectHandle);

        return reconnectHandle;
      }
    } catch {
      // PTY fallback is best-effort
    }

    return undefined;
  }
}

// =============================================================================
// Command Building (duplicated from process-manager.ts for self-containment)
// =============================================================================

function buildSpawnCommand(command: string, cwd: string | undefined, envs: Record<string, string>): string {
  const parts: string[] = [];

  for (const [k, v] of Object.entries(envs)) {
    parts.push(`export ${k}=${shellQuote(v)}`);
  }

  if (cwd) {
    parts.push(`cd ${shellQuote(cwd)}`);
  }

  parts.push(`(${command})`);

  return parts.join(' && ');
}
