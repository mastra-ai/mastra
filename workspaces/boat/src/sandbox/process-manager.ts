/**
 * Boat Process Manager
 *
 * Boat has no streaming command transport: `command()` either blocks for up to
 * 600 seconds and returns the whole result, or — with `detached: true` — returns
 * a process id immediately and appends output to log files on the sandbox.
 *
 * Every spawn takes the detached path, including the ones behind
 * `executeCommand`. The synchronous path cannot be killed, cannot outlive ten
 * minutes, and delivers nothing until it finishes, so a provider built on it
 * would have no `kill()`, no abort, no timeout that fires before the command
 * ends, and no streaming callbacks. Going detached everywhere costs a few extra
 * HTTP round-trips per command and buys all of those, with one observable
 * behaviour instead of two.
 *
 * Liveness, exit code and output all come from polling `commandStatus`, whose
 * response carries the last 512 KiB of each stream. Up to that point the tail IS
 * the whole stream, and because the streams are append-only, everything past
 * what we have already emitted is exactly the new output. A stream that
 * overflows the tail switches to reading its log file, which is complete.
 */

import type { BoatApi, CommandStatusResponse } from '@boatdev/sdk';
import { ProcessHandle, SandboxProcessManager, UnsupportedStdinCloseError } from '@mastra/core/workspace';
import type { CommandResult, ProcessInfo, SpawnProcessOptions } from '@mastra/core/workspace';

import { newOutputSince, withEnv } from './command';
import { LOG_PREFIX, withBoatErrors } from './errors';
import type { BoatSandbox } from './index';

/** Poll interval floor, in ms. Applies right after spawn and after any new output. */
const MIN_POLL_INTERVAL_MS = 200;
/** Poll interval ceiling, in ms, for a process that has gone quiet. */
const MAX_POLL_INTERVAL_MS = 2_000;
/** Multiplier applied to the poll interval on each quiet poll. */
const POLL_BACKOFF_FACTOR = 1.5;
/** How long a TERM'd process gets before it is KILL'd. */
const KILL_ESCALATION_MS = 2_000;
/** Consecutive status-poll failures tolerated before the process is declared lost. */
const MAX_CONSECUTIVE_POLL_ERRORS = 3;
/** Timeout for the short synchronous commands the manager runs on its own behalf (kill). */
const CONTROL_COMMAND_TIMEOUT_SECONDS = 10;
/** Exit code reported for a process this provider timed out, matching coreutils `timeout`. */
const EXIT_CODE_TIMED_OUT = 124;
/** Exit code reported for a process killed by SIGKILL, matching shell convention. */
const EXIT_CODE_KILLED = 137;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/** Where a detached process's two output streams live on the sandbox. */
interface LogPaths {
  stdout?: string;
  stderr?: string;
}

/** Everything {@link BoatProcessHandle} needs that only the manager can supply. */
interface BoatProcessHandleOptions {
  api: BoatApi;
  sandboxId: string;
  /** Boat's process id — the key for `commandStatus`. */
  processId: number;
  /** The OS pid inside the sandbox — the key for `kill`. */
  osPid: number;
  logs: LogPaths;
  spawnOptions: SpawnProcessOptions;
  /** Effective timeout in ms, after the sandbox default has been applied. */
  timeoutMs?: number;
}

/** Per-stream bookkeeping for reconciling polled output against what was already emitted. */
class StreamTracker {
  /** Output already handed to the handle's emit method. */
  emitted = '';
  /** Last tail seen from `commandStatus`, used to skip work while nothing has changed. */
  lastTail?: string;
  /** Set once the tail overflows, after which only the log file has the whole stream. */
  overflowed = false;
}

// =============================================================================
// Boat Process Handle
// =============================================================================

/**
 * A detached Boat command, polled to completion.
 *
 * Polling starts at construction rather than inside `wait()`: consumers read
 * `handle.stdout` and `handle.exitCode` on a handle they never waited on (the
 * background-process tools do exactly that), so output has to accumulate
 * whether or not anyone is awaiting.
 */
class BoatProcessHandle extends ProcessHandle {
  readonly pid: string;

  private readonly _api: BoatApi;
  private readonly _sandboxId: string;
  private readonly _processId: number;
  private readonly _osPid: number;
  private readonly _logs: LogPaths;
  private readonly _startedAt: number;

  private readonly _out = new StreamTracker();
  private readonly _err = new StreamTracker();

  private _exitCode: number | undefined;
  private _killed = false;
  private _timedOut = false;
  private readonly _settled: Promise<CommandResult>;
  private _resolveSettled!: (result: CommandResult) => void;
  private _timeoutTimer?: ReturnType<typeof setTimeout>;
  private _killEscalationTimer?: ReturnType<typeof setTimeout>;

  constructor(options: BoatProcessHandleOptions) {
    super(options.spawnOptions);

    this._api = options.api;
    this._sandboxId = options.sandboxId;
    this._processId = options.processId;
    this._osPid = options.osPid;
    this._logs = options.logs;
    this._startedAt = Date.now();
    this.pid = String(options.processId);

    this._settled = new Promise<CommandResult>(resolve => {
      this._resolveSettled = resolve;
    });

    // Boat's `timeoutSeconds` only bounds the synchronous path, so a detached
    // command's deadline is ours to enforce.
    if (options.timeoutMs !== undefined) {
      this._timeoutTimer = setTimeout(() => {
        this._timedOut = true;
        void this.kill().catch(() => {});
      }, options.timeoutMs);
    }

    void this._poll();
  }

  get exitCode(): number | undefined {
    return this._exitCode;
  }

  async wait(): Promise<CommandResult> {
    return this._settled;
  }

  /**
   * Terminate the process.
   *
   * Boat exposes no kill endpoint, so this runs `kill` inside the sandbox.
   * `pkill -P` goes first because a command wrapped to carry per-command
   * environment runs as a child of the pid Boat reports. TERM escalates to KILL
   * after a grace period for anything that ignores it.
   */
  async kill(): Promise<boolean> {
    if (this._exitCode !== undefined) return false;
    this._killed = true;

    try {
      await this._runControlCommand('TERM');
    } catch {
      // The process may already be gone, or the sandbox may be going away with
      // it. The poll loop still settles the handle, so report the kill as issued
      // rather than surfacing a race as a failure.
      return true;
    }

    this._killEscalationTimer ??= setTimeout(() => {
      if (this._exitCode !== undefined) return;
      void this._runControlCommand('KILL').catch(() => {});
    }, KILL_ESCALATION_MS);

    return true;
  }

  async sendStdin(_data: string): Promise<void> {
    throw new Error(`${LOG_PREFIX} sending stdin is not supported by the Boat sandbox provider`);
  }

  async closeStdin(): Promise<void> {
    throw new UnsupportedStdinCloseError(`${LOG_PREFIX} closing stdin is not supported by the Boat sandbox provider`);
  }

  /**
   * Signal the process and its direct children.
   *
   * Runs synchronously and never detached, so it can't recurse back into this
   * manager. Trailing `true` keeps a non-zero `kill` exit (the process already
   * exited) from reading as a failed command.
   */
  private async _runControlCommand(signal: 'TERM' | 'KILL'): Promise<void> {
    await this._api.command({
      sandboxId: this._sandboxId,
      commandRequest: {
        command: `pkill -${signal} -P ${this._osPid} 2>/dev/null; kill -${signal} ${this._osPid} 2>/dev/null; true`,
        timeoutSeconds: CONTROL_COMMAND_TIMEOUT_SECONDS,
      },
    });
  }

  /** Poll until the process exits, publishing output as it appears. */
  private async _poll(): Promise<void> {
    let interval = MIN_POLL_INTERVAL_MS;
    let consecutiveErrors = 0;

    for (;;) {
      await sleep(interval);

      let status: CommandStatusResponse;
      try {
        status = await this._api.commandStatus({ sandboxId: this._sandboxId, processId: this._processId });
        consecutiveErrors = 0;
      } catch {
        if (++consecutiveErrors >= MAX_CONSECUTIVE_POLL_ERRORS) {
          // Boat can no longer tell us anything about this process. Settling as
          // failed beats leaving every `wait()` on it pending forever.
          this._finish(null);
          return;
        }
        interval = Math.min(interval * POLL_BACKOFF_FACTOR, MAX_POLL_INTERVAL_MS);
        continue;
      }

      const producedOutput = await this._syncOutput(status);

      if (!status.running) {
        this._finish(status.exitCode);
        return;
      }

      // Reset the backoff whenever the process is actually producing something,
      // so a chatty process streams at the floor interval while a quiet one
      // costs one request every couple of seconds.
      interval = producedOutput ? MIN_POLL_INTERVAL_MS : Math.min(interval * POLL_BACKOFF_FACTOR, MAX_POLL_INTERVAL_MS);
    }
  }

  /**
   * Publish whatever the process has written since the last poll.
   *
   * @returns whether either stream produced new output.
   */
  private async _syncOutput(status: CommandStatusResponse): Promise<boolean> {
    const stdoutNew = await this._syncStream(
      this._out,
      status.stdout,
      status.stdoutTruncated === true,
      this._logs.stdout,
    );
    if (stdoutNew) this.emitStdout(stdoutNew);

    const stderrNew = await this._syncStream(
      this._err,
      status.stderr,
      status.stderrTruncated === true,
      this._logs.stderr,
    );
    if (stderrNew) this.emitStderr(stderrNew);

    return Boolean(stdoutNew || stderrNew);
  }

  /**
   * Reconcile one stream's polled state against what has already been emitted.
   *
   * While the stream fits in the status tail, the tail is the entire stream and
   * slicing past the emitted length is exact. Once it overflows, the tail has
   * dropped its head, so the stream switches — permanently — to its log file,
   * which is still complete.
   *
   * @returns the new output to emit, or `''` when there is none.
   */
  private async _syncStream(
    tracker: StreamTracker,
    tail: string | undefined,
    truncated: boolean,
    logPath: string | undefined,
  ): Promise<string> {
    const currentTail = tail ?? '';
    if (currentTail === tracker.lastTail && !truncated) return '';
    tracker.lastTail = currentTail;
    if (truncated) tracker.overflowed = true;

    const full = tracker.overflowed ? await this._readLog(logPath, currentTail) : currentTail;
    const next = newOutputSince(tracker.emitted, full);
    if (!next) return '';

    tracker.emitted = full;
    return next;
  }

  /**
   * Read a stream's complete contents from its log file.
   *
   * Falls back to the tail when the file can't be read — Boat may not report a
   * path, and a log can be rotated away. A short read is better than dropping
   * the output entirely.
   */
  private async _readLog(path: string | undefined, tail: string): Promise<string> {
    if (!path) return tail;
    try {
      const response = await this._api.readFile({ sandboxId: this._sandboxId, path, encoding: 'utf8' });
      return response.content ?? tail;
    } catch {
      return tail;
    }
  }

  /** Settle the handle. Called exactly once, from the poll loop. */
  private _finish(exitCode: number | null | undefined): void {
    if (this._timeoutTimer) clearTimeout(this._timeoutTimer);
    if (this._killEscalationTimer) clearTimeout(this._killEscalationTimer);

    // Boat reports a null exit code both for a process it lost track of and for
    // one that died from a signal. Neither is a success, so give them codes that
    // say so rather than letting `null` read as 0.
    const resolved = exitCode ?? (this._timedOut ? EXIT_CODE_TIMED_OUT : this._killed ? EXIT_CODE_KILLED : -1);
    this._exitCode = resolved;

    this._resolveSettled({
      success: resolved === 0 && !this._killed && !this._timedOut,
      exitCode: resolved,
      stdout: this.stdout,
      stderr: this.stderr,
      executionTimeMs: Date.now() - this._startedAt,
      killed: this._killed,
      timedOut: this._timedOut,
    });
  }
}

/**
 * A handle for a process that was never started, because the caller's abort
 * signal had already fired. Spawning and then killing would cost two round-trips
 * to reach the same place, and would leave a command running in the sandbox for
 * as long as they take.
 */
class AbortedProcessHandle extends ProcessHandle {
  readonly pid: string;
  readonly exitCode = EXIT_CODE_KILLED;

  constructor(pid: string, options: SpawnProcessOptions) {
    super(options);
    this.pid = pid;
  }

  async wait(): Promise<CommandResult> {
    return {
      success: false,
      exitCode: EXIT_CODE_KILLED,
      stdout: '',
      stderr: '',
      executionTimeMs: 0,
      killed: true,
    };
  }

  async kill(): Promise<boolean> {
    return false;
  }

  async sendStdin(_data: string): Promise<void> {
    throw new Error(`${LOG_PREFIX} sending stdin is not supported by the Boat sandbox provider`);
  }

  async closeStdin(): Promise<void> {
    throw new UnsupportedStdinCloseError(`${LOG_PREFIX} closing stdin is not supported by the Boat sandbox provider`);
  }
}

// =============================================================================
// Boat Process Manager
// =============================================================================

/** Boat implementation of {@link SandboxProcessManager}: one detached command per spawn. */
export class BoatProcessManager extends SandboxProcessManager<BoatSandbox> {
  private _abortCounter = 0;

  async spawn(command: string, options: SpawnProcessOptions = {}): Promise<ProcessHandle> {
    if (options.abortSignal?.aborted) {
      return new AbortedProcessHandle(`boat-aborted-${this._abortCounter++}`, options);
    }

    const cwd = options.cwd ?? this.sandbox.workingDirectory;
    // The base manager has already merged the sandbox env overlay into
    // options.env. Boat has no per-command env, so it rides in the command.
    // Built outside retryOnDead so a quoting bug can't be mistaken for a dead sandbox.
    const wrapped = withEnv(command, options.env);

    // Boat archives a sandbox once its TTL expires, so a session that outlives
    // one hour will find its VM gone mid-run. retryOnDead re-acquires and
    // replays the spawn — which is why the id is read inside, not above.
    return this.sandbox.retryOnDead(async () => {
      const api = this.sandbox.boat;
      const sandboxId = this.sandbox.boatSandboxId;

      const started = await withBoatErrors('spawn', () =>
        api.command({
          sandboxId,
          commandRequest: { command: wrapped, ...(cwd !== undefined && { cwd }), detached: true },
        }),
      );

      if (started.type !== 'command.started') {
        throw new Error(`${LOG_PREFIX} expected a detached command response, got '${started.type}'`);
      }

      const handle = new BoatProcessHandle({
        api,
        sandboxId,
        processId: started.processId,
        osPid: started.pid ?? started.processId,
        logs: { stdout: started.logPath, stderr: started.errLogPath },
        spawnOptions: options,
        timeoutMs: options.timeout ?? this.sandbox.defaultTimeout,
      });

      this._tracked.set(handle.pid, handle);
      return handle;
    });
  }

  /**
   * List tracked processes.
   *
   * Boat has no endpoint that enumerates a sandbox's running commands, so this
   * reports what this manager spawned — the same contract as the other providers
   * whose backends don't expose one.
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
