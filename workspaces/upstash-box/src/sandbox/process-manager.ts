/**
 * Upstash Box Process Manager
 *
 * Implements SandboxProcessManager for Upstash Box cloud sandboxes.
 *
 * Box's `exec` API is request/response and blocks until a command finishes, so
 * it can't model long-running background processes directly. Instead, each
 * spawn() launches the command **detached** on the box (`nohup` + a small shell
 * harness delivered as a base64 blob over `exec.command`), capturing:
 *
 *   <dir>/out   — stdout
 *   <dir>/err   — stderr
 *   <dir>/pid   — the command's OS pid (for kill)
 *   <dir>/code  — exit code, written once the command exits
 *
 * spawn() returns immediately with the OS pid. wait() polls the box: it streams
 * new stdout/stderr bytes to the handle (base64-framed so binary/newlines never
 * collide with the poll markers) and resolves when the process is gone. kill()
 * signals the pid directly.
 *
 * Box exposes no stdin channel, so sendStdin() is unsupported.
 */

import { ProcessHandle, SandboxProcessManager } from '@mastra/core/workspace';
import type { CommandResult, ProcessInfo, SpawnProcessOptions } from '@mastra/core/workspace';
import { shellQuote } from '../utils/shell-quote';
import type { UpstashBoxSandbox } from './index';

/** Root directory on the box for per-process bookkeeping files. */
const PROC_ROOT = '/tmp/.mastra-box';
/** How often wait() polls the box for output/exit status. */
const POLL_INTERVAL_MS = 400;
/** Grace window to let the harness write the exit-code file after the process exits. */
const CODE_GRACE_MS = 2_000;
/** Poll interval while waiting for the exit-code file within the grace window. */
const CODE_POLL_MS = 150;

const SHELL_IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

/** Runs a shell command on the box, returning stdout. */
type RunFn = (command: string) => Promise<string>;

// =============================================================================
// Upstash Box Process Handle
// =============================================================================

/**
 * Wraps a detached Box process to conform to Mastra's ProcessHandle.
 * Not exported — internal to this module.
 */
class UpstashBoxProcessHandle extends ProcessHandle {
  readonly pid: string;

  private readonly _dir: string;
  private readonly _osPid: string;
  private readonly _run: RunFn;
  private readonly _startTime: number;
  private readonly _timeout?: number;

  private _exitCode: number | undefined;
  private _killed = false;
  private _waitPromise: Promise<CommandResult> | null = null;
  private readonly _pollingPromise: Promise<void>;
  /** 1-based byte offsets for `tail -c +N` incremental reads. */
  private _outOff = 1;
  private _errOff = 1;

  constructor(
    pid: string,
    dir: string,
    osPid: string,
    run: RunFn,
    startTime: number,
    options?: SpawnProcessOptions,
  ) {
    super(options);
    this.pid = pid;
    this._dir = dir;
    this._osPid = osPid;
    this._run = run;
    this._startTime = startTime;
    this._timeout = options?.timeout;

    // Poll in the background from spawn time so output accumulates and the exit
    // code resolves even if the caller only ever calls get() (never wait()).
    this._pollingPromise = this._pollLoop();
  }

  get exitCode(): number | undefined {
    return this._exitCode;
  }

  /**
   * One poll round-trip: emit any new stdout/stderr to the handle and report
   * whether the process is still running plus its exit code (if written).
   */
  private async _poll(): Promise<{ running: boolean; code: string | null }> {
    const stdout = await this._run(pollCommand(this._osPid, this._dir, this._outOff, this._errOff));

    let running = true;
    let code: string | null = null;

    for (const line of stdout.split('\n')) {
      if (line.startsWith('R:')) {
        running = line.slice(2).trim() === '1';
      } else if (line.startsWith('C:')) {
        const c = line.slice(2).trim();
        code = c === '' ? null : c;
      } else if (line.startsWith('O:')) {
        const b = line.slice(2).trim();
        if (b) {
          const data = Buffer.from(b, 'base64').toString('utf8');
          this.emitStdout(data);
          this._outOff += Buffer.byteLength(data);
        }
      } else if (line.startsWith('E:')) {
        const b = line.slice(2).trim();
        if (b) {
          const data = Buffer.from(b, 'base64').toString('utf8');
          this.emitStderr(data);
          this._errOff += Buffer.byteLength(data);
        }
      }
    }

    return { running, code };
  }

  async wait(): Promise<CommandResult> {
    // Idempotent — cache the promise so repeated calls return the same result.
    if (!this._waitPromise) {
      this._waitPromise = this._doWait();
    }
    return this._waitPromise;
  }

  /**
   * Background poll loop: drains output and resolves the exit code. Runs until
   * the process exits or is killed; never rejects (errors resolve to a code).
   */
  private async _pollLoop(): Promise<void> {
    while (true) {
      let res: { running: boolean; code: string | null };
      try {
        res = await this._poll();
      } catch {
        // Box gone or transient error — treat as terminal.
        this._exitCode ??= this._killed ? 137 : 1;
        return;
      }

      if (!res.running) {
        // The harness writes the exit-code file just *after* the process exits
        // (`wait "$cpid"; echo "$?" > code`), so there's a brief window where the
        // process is gone but the code isn't visible yet. Poll a little longer
        // for it rather than defaulting a real non-zero exit to success.
        let code = res.code;
        const graceDeadline = Date.now() + CODE_GRACE_MS;
        while (code === null && Date.now() < graceDeadline) {
          await sleep(CODE_POLL_MS);
          try {
            code = (await this._poll()).code;
          } catch {
            // Box gone / transient — stop grace-polling and fall through to the
            // fallback below. _pollLoop must never reject.
            break;
          }
        }

        if (this._exitCode === undefined) {
          if (code !== null && code !== '') {
            const parsed = Number.parseInt(code, 10);
            this._exitCode = Number.isNaN(parsed) ? 1 : parsed;
          } else if (this._killed) {
            this._exitCode = 137;
          } else {
            // Process is gone but no exit code was ever recorded (e.g. the harness
            // itself died). Treat as a failure rather than a phantom success.
            this._exitCode = 1;
          }
        }
        return;
      }

      if (this._killed) {
        this._exitCode ??= 137;
        return;
      }

      await sleep(POLL_INTERVAL_MS);
    }
  }

  private async _doWait(): Promise<CommandResult> {
    if (this._timeout !== undefined) {
      const remaining = this._startTime + this._timeout - Date.now();
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timedOut = new Promise<'timeout'>(resolve => {
        timer = setTimeout(() => resolve('timeout'), Math.max(0, remaining));
      });
      const outcome = await Promise.race([this._pollingPromise.then(() => 'done' as const), timedOut]);
      clearTimeout(timer);

      if (outcome === 'timeout') {
        await this.kill();
        this._exitCode = 124; // conventional timeout exit code
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
      await this._pollingPromise;
    }

    return {
      success: this._exitCode === 0,
      exitCode: this._exitCode ?? 1,
      stdout: this.stdout,
      stderr: this.stderr,
      executionTimeMs: Date.now() - this._startTime,
      ...(this._killed && { killed: true, timedOut: false }),
    };
  }

  async kill(): Promise<boolean> {
    if (this._exitCode !== undefined) return false;
    this._killed = true;
    // Signal the command directly. The harness records the resulting exit code
    // (143 for SIGTERM) to the code file, which wait() reads.
    try {
      await this._run(`kill -TERM ${this._osPid} 2>/dev/null; kill -KILL ${this._osPid} 2>/dev/null; true`);
    } catch {
      // Box may be gone; wait() falls back to exit 137.
    }
    return true;
  }

  async sendStdin(_data: string): Promise<void> {
    throw new Error('Upstash Box does not expose stdin on exec — sendStdin() is not supported');
  }
}

// =============================================================================
// Upstash Box Process Manager
// =============================================================================

export interface UpstashBoxProcessManagerOptions {
  env?: Record<string, string | undefined>;
  /** Default working directory baked into spawned commands when none is given. */
  workdir?: string;
  /** Default command timeout (ms) for spawns that don't specify their own. */
  defaultTimeout?: number;
}

/**
 * Upstash Box implementation of SandboxProcessManager.
 * Launches each process detached on the box and tracks it by OS pid.
 */
export class UpstashBoxProcessManager extends SandboxProcessManager<UpstashBoxSandbox> {
  private _spawnCounter = 0;
  private readonly _workdir?: string;
  private readonly _defaultTimeout?: number;

  constructor(opts: UpstashBoxProcessManagerOptions = {}) {
    super({ env: opts.env });
    this._workdir = opts.workdir;
    this._defaultTimeout = opts.defaultTimeout;
  }

  /** Run a shell command on the box and return its stdout. */
  private run: RunFn = async command => {
    const result = await this.sandbox.box.exec.command(command);
    return result.result;
  };

  async spawn(command: string, options: SpawnProcessOptions = {}): Promise<ProcessHandle> {
    // Apply the manager-level default timeout when the caller didn't specify one.
    const effectiveOptions: SpawnProcessOptions = {
      ...options,
      timeout: options.timeout ?? this._defaultTimeout,
    };

    const mergedEnv = { ...this.env, ...effectiveOptions.env };
    const envs = Object.fromEntries(
      Object.entries(mergedEnv).filter((entry): entry is [string, string] => entry[1] !== undefined),
    );

    // Build before retryOnDead so user-controlled validation errors cannot be
    // mistaken for Box dead-box errors.
    const token = `box-proc-${Date.now().toString(36)}-${++this._spawnCounter}`;
    const dir = `${PROC_ROOT}/${token}`;
    const script = buildChildScript(dir, command, envs, effectiveOptions.cwd ?? this._workdir);
    const launch = buildLaunchCommand(dir, script);

    return this.sandbox.retryOnDead(async () => {
      const osPid = (await this.run(launch)).trim().split('\n').pop()?.trim() ?? '';
      if (!osPid) {
        throw new Error(`Failed to launch process for command: ${command}`);
      }

      const handle = new UpstashBoxProcessHandle(token, dir, osPid, this.run, Date.now(), effectiveOptions);
      this._tracked.set(token, handle);
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

// =============================================================================
// Shell Building
// =============================================================================

/**
 * Build the detached harness script. The user command is wrapped in a subshell
 * so compound commands, `exit N`, and heredocs behave; its pid is captured for
 * kill, and the exit code is recorded once it finishes.
 */
function buildChildScript(
  dir: string,
  command: string,
  envs: Record<string, string>,
  cwd: string | undefined,
): string {
  const lines = ['#!/bin/sh', `DIR='${dir}'`, 'mkdir -p "$DIR"'];

  for (const [k, v] of Object.entries(envs)) {
    if (!SHELL_IDENTIFIER_PATTERN.test(k)) {
      throw new Error(`Invalid environment variable name: ${JSON.stringify(k)}`);
    }
    lines.push(`export ${k}=${shellQuote(v)}`);
  }

  // cd runs inside the redirected subshell so a bad cwd fails the command
  // (non-zero exit + the cd error on stderr) rather than silently running in
  // the box's default directory.
  const cdPrefix = cwd ? `cd ${shellQuote(cwd)} || exit 1; ` : '';

  lines.push(
    `( ${cdPrefix}${command} ) > "$DIR/out" 2> "$DIR/err" &`,
    'cpid=$!',
    'echo "$cpid" > "$DIR/pid"',
    'wait "$cpid"',
    'echo "$?" > "$DIR/code"',
  );

  return lines.join('\n') + '\n';
}

/**
 * Build the launch command run via `exec.command`. Delivers the harness script
 * as a base64 blob (no shell-quoting of user content), starts it detached, then
 * blocks only until the pid file appears and echoes the pid.
 */
function buildLaunchCommand(dir: string, script: string): string {
  const b64 = Buffer.from(script, 'utf8').toString('base64');
  const childPath = `${dir}.sh`;
  // Joined with newlines, not '; ' — a backgrounding '&' followed by ';' is a
  // shell syntax error ("';' unexpected"), but '&' followed by a newline is fine.
  return [
    `mkdir -p '${PROC_ROOT}'`,
    `echo '${b64}' | base64 -d > '${childPath}'`,
    `nohup sh '${childPath}' >/dev/null 2>&1 &`,
    `i=0; while [ ! -s '${dir}/pid' ] && [ $i -lt 250 ]; do sleep 0.02; i=$((i+1)); done`,
    `cat '${dir}/pid' 2>/dev/null`,
  ].join('\n');
}

/**
 * Build a single poll round-trip: running flag, exit code, and base64-framed
 * new stdout/stderr from the given byte offsets.
 */
function pollCommand(osPid: string, dir: string, outOff: number, errOff: number): string {
  return [
    `if kill -0 ${osPid} 2>/dev/null; then echo R:1; else echo R:0; fi`,
    `echo "C:$(cat '${dir}/code' 2>/dev/null)"`,
    `echo "O:$(tail -c +${outOff} '${dir}/out' 2>/dev/null | base64 | tr -d '\\n')"`,
    `echo "E:$(tail -c +${errOff} '${dir}/err' 2>/dev/null | base64 | tr -d '\\n')"`,
  ].join('; ');
}
