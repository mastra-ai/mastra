/**
 * Daytona PTY Process Manager (Approach A)
 *
 * Each spawn() creates a PTY session, then uses `exec` to replace the
 * interactive shell with a wrapped command. This avoids shell prompts
 * appearing in output.
 *
 * Core challenge: PTYs merge stdout and stderr into a single stream.
 * This implementation redirects stderr to a temp file and reads it back
 * after the process exits. As a result, onStderr callbacks fire once as
 * a batch after exit, not as streaming chunks.
 *
 * Command wrapping strategy:
 * ```
 * exec bash -c 'TERM=dumb; export K=V; cd /cwd;
 *   (user_command) 2>/tmp/mastra-stderr-{id};
 *   EXIT_CODE=$?;
 *   echo "";
 *   echo "MASTRA_EXIT_a7f3:${EXIT_CODE}";
 *   exit ${EXIT_CODE}'
 * ```
 *
 * - `exec` replaces the PTY shell — no prompt noise, clean exit
 * - `TERM=dumb` suppresses ANSI escape sequences
 * - `(command)` subshell isolates `exit N`
 * - stderr redirected to a temp file (read back after exit)
 * - `MASTRA_EXIT_a7f3:N` sentinel parsed from tail of output stream
 * - Blank `echo ""` ensures sentinel starts on a new line
 *
 * @internal Prototype — not exported from package index
 */

import type { PtyHandle } from '@daytonaio/sdk';
import { ProcessHandle, SandboxProcessManager } from '@mastra/core/workspace';
import type { CommandResult, ProcessInfo, SpawnProcessOptions } from '@mastra/core/workspace';

import { shellQuote } from '../utils/shell-quote';
import type { DaytonaSandbox } from './index';

/** Unique sentinel prefix — unlikely to appear in user output. */
const EXIT_SENTINEL_PREFIX = 'MASTRA_EXIT_a7f3:';

/** Regex to extract exit code from sentinel line. */
const EXIT_SENTINEL_RE = /MASTRA_EXIT_a7f3:(\d+)/;

// =============================================================================
// PTY Process Handle
// =============================================================================

/**
 * Wraps a Daytona PTY session to conform to Mastra's ProcessHandle.
 *
 * All PTY output flows through onData → _rawBuffer → emitStdout().
 * After exit, stderr is read from a temp file and emitted via emitStderr().
 */
class DaytonaPtyProcessHandle extends ProcessHandle {
  readonly pid: number;

  private readonly _ptyHandle: PtyHandle;
  private readonly _ptySessionId: string;
  private readonly _stderrFile: string;
  private readonly _sandbox: DaytonaSandbox;
  private readonly _startTime: number;
  private readonly _timeout?: number;

  /** Accumulates all raw PTY output for sentinel parsing. */
  private _rawBuffer = '';
  private _exitCode: number | undefined;
  private _waitPromise: Promise<CommandResult> | null = null;
  private _killed = false;

  /** Resolves when the PTY connection closes (exit or disconnect). */
  private _ptyDonePromise: Promise<void>;
  private _resolvePtyDone!: () => void;

  constructor(
    pid: number,
    ptyHandle: PtyHandle,
    ptySessionId: string,
    stderrFile: string,
    sandbox: DaytonaSandbox,
    startTime: number,
    options?: SpawnProcessOptions,
  ) {
    super(options);
    this.pid = pid;
    this._ptyHandle = ptyHandle;
    this._ptySessionId = ptySessionId;
    this._stderrFile = stderrFile;
    this._sandbox = sandbox;
    this._startTime = startTime;
    this._timeout = options?.timeout;

    this._ptyDonePromise = new Promise<void>(resolve => {
      this._resolvePtyDone = resolve;
    });

    // Start listening for PTY exit in the background
    this._watchPtyExit();
  }

  get exitCode(): number | undefined {
    return this._exitCode;
  }

  /**
   * Called by the process manager's onData callback.
   * Accumulates raw output and emits stdout (sentinel is stripped in wait()).
   */
  appendOutput(data: string): void {
    this._rawBuffer += data;
    // Emit everything as stdout — sentinel will be stripped during wait()
    this.emitStdout(data);
  }

  async wait(): Promise<CommandResult> {
    if (!this._waitPromise) {
      this._waitPromise = this._doWait();
    }
    return this._waitPromise;
  }

  private async _doWait(): Promise<CommandResult> {
    if (this._timeout) {
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(`Command timed out after ${this._timeout}ms`)), this._timeout);
      });

      try {
        await Promise.race([this._ptyDonePromise, timeoutPromise]);
      } catch (error) {
        if (error instanceof Error && error.message.includes('timed out')) {
          await this.kill();
          this._exitCode = 124;
          return {
            success: false,
            exitCode: 124,
            stdout: this._getCleanStdout(),
            stderr: this.stderr || error.message,
            executionTimeMs: Date.now() - this._startTime,
          };
        }
        throw error;
      } finally {
        clearTimeout(timeoutId);
      }
    } else {
      await this._ptyDonePromise;
    }

    if (this._killed) {
      return {
        success: false,
        exitCode: this._exitCode ?? 137,
        stdout: this._getCleanStdout(),
        stderr: this.stderr,
        executionTimeMs: Date.now() - this._startTime,
      };
    }

    // Parse exit code from sentinel if not already set
    this._parseExitSentinel();

    // Read stderr from temp file
    await this._readStderrFile();

    // Clean up stderr temp file (best-effort)
    this._cleanupStderrFile();

    return {
      success: this._exitCode === 0,
      exitCode: this._exitCode ?? 1,
      stdout: this._getCleanStdout(),
      stderr: this.stderr,
      executionTimeMs: Date.now() - this._startTime,
    };
  }

  async kill(): Promise<boolean> {
    if (this._exitCode !== undefined) return false;
    this._killed = true;
    this._exitCode = 137;
    try {
      await this._ptyHandle.kill();
    } catch {
      // PTY may already be gone
    }
    this._resolvePtyDone();
    return true;
  }

  async sendStdin(data: string): Promise<void> {
    if (this._exitCode !== undefined) {
      throw new Error(`Process ${this.pid} has already exited with code ${this._exitCode}`);
    }
    await this._ptyHandle.sendInput(data);
  }

  /** Watch for PTY exit and resolve the done promise. */
  private _watchPtyExit(): void {
    this._ptyHandle
      .wait()
      .then(result => {
        if (this._exitCode === undefined) {
          // Try sentinel first, fall back to PTY result
          this._parseExitSentinel();
          if (this._exitCode === undefined) {
            this._exitCode = result.exitCode ?? 0;
          }
        }
        this._resolvePtyDone();
      })
      .catch(() => {
        if (this._exitCode === undefined) {
          this._parseExitSentinel();
          if (this._exitCode === undefined) {
            this._exitCode = 1;
          }
        }
        this._resolvePtyDone();
      });
  }

  /** Parse the exit sentinel from the raw buffer. */
  private _parseExitSentinel(): void {
    if (this._exitCode !== undefined) return;
    const match = EXIT_SENTINEL_RE.exec(this._rawBuffer);
    if (match) {
      this._exitCode = parseInt(match[1]!, 10);
    }
  }

  /**
   * Get stdout with the sentinel line stripped.
   * Also strips the blank line before the sentinel and any trailing newline.
   */
  private _getCleanStdout(): string {
    const idx = this._rawBuffer.indexOf(EXIT_SENTINEL_PREFIX);
    if (idx === -1) return this.stdout;

    // Find the start of the sentinel line (look for newline before it)
    let lineStart = idx;
    while (lineStart > 0 && this._rawBuffer[lineStart - 1] !== '\n') {
      lineStart--;
    }

    // Also strip the blank echo line before the sentinel (if present)
    let cleanEnd = lineStart;
    if (cleanEnd > 0 && this._rawBuffer[cleanEnd - 1] === '\n') {
      cleanEnd--; // strip the newline
      // If there's another newline (from the blank echo), strip it too
      if (cleanEnd > 0 && this._rawBuffer[cleanEnd - 1] === '\n') {
        cleanEnd--;
      }
    }

    return this._rawBuffer.slice(0, cleanEnd) + '\n';
  }

  /** Read stderr from the temp file and emit it. */
  private async _readStderrFile(): Promise<void> {
    try {
      const sandbox = this._sandbox.instance;
      const content = await sandbox.fs.downloadFile(this._stderrFile);
      const stderrText = typeof content === 'string' ? content : new TextDecoder().decode(content);
      if (stderrText.length > 0) {
        this.emitStderr(stderrText);
      }
    } catch {
      // File may not exist if no stderr was produced — that's fine
    }
  }

  /** Clean up the stderr temp file (best-effort, fire-and-forget). */
  private _cleanupStderrFile(): void {
    try {
      const sandbox = this._sandbox.instance;
      sandbox.process
        .executeCommand(`rm -f ${shellQuote(this._stderrFile)}`)
        .catch(() => {});
    } catch {
      // Best-effort
    }
  }
}

// =============================================================================
// PTY Process Manager
// =============================================================================

export interface DaytonaPtyProcessManagerOptions {
  env?: Record<string, string | undefined>;
  /** Default timeout in milliseconds for commands that don't specify one. */
  defaultTimeout?: number;
}

/**
 * Full PTY process manager: every spawn() creates a PTY session.
 *
 * Advantages over Session API:
 * - Native wait() for exit codes (no polling)
 * - WebSocket streaming (lower latency)
 * - sendInput() for stdin
 * - kill() at process level
 *
 * Limitation: stderr is deferred (read from temp file after exit).
 */
export class DaytonaPtyProcessManager extends SandboxProcessManager<DaytonaSandbox> {
  private _nextPid = 1;
  private readonly _defaultTimeout?: number;

  constructor(opts: DaytonaPtyProcessManagerOptions = {}) {
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

      // Generate unique IDs
      const sessionId = `mastra-pty-${Date.now().toString(36)}-${pid}`;
      const stderrFile = `/tmp/mastra-stderr-${sessionId}`;

      // Build the wrapped command
      const wrappedCommand = buildPtyCommand(command, effectiveOptions.cwd, envs, stderrFile);

      // Create a handle first (needed for onData callback reference)
      let handle: DaytonaPtyProcessHandle;

      // Create PTY session
      const ptyHandle = await sandbox.process.createPty({
        id: sessionId,
        cwd: '/',
        envs: { TERM: 'dumb' },
        onData: (data: Uint8Array) => {
          const text = new TextDecoder().decode(data);
          handle.appendOutput(text);
        },
      });

      handle = new DaytonaPtyProcessHandle(
        pid,
        ptyHandle,
        sessionId,
        stderrFile,
        this.sandbox,
        Date.now(),
        effectiveOptions,
      );

      // Wait for WebSocket connection
      await ptyHandle.waitForConnection();

      // Send the wrapped command to start execution
      await ptyHandle.sendInput(wrappedCommand + '\n');

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

// =============================================================================
// Command Building
// =============================================================================

/**
 * Build the exec-wrapped command for PTY execution.
 *
 * Uses `exec bash -c '...'` to replace the PTY shell process with our
 * command, avoiding shell prompt noise in the output.
 *
 * @example Output:
 * exec bash -c 'TERM=dumb; export KEY='"'"'val'"'"'; cd '"'"'/app'"'"'; (echo hello) 2>/tmp/mastra-stderr-xyz; EXIT_CODE=$?; echo ""; echo "MASTRA_EXIT_a7f3:${EXIT_CODE}"; exit ${EXIT_CODE}'
 */
function buildPtyCommand(
  command: string,
  cwd: string | undefined,
  envs: Record<string, string>,
  stderrFile: string,
): string {
  const innerParts: string[] = ['TERM=dumb'];

  for (const [k, v] of Object.entries(envs)) {
    innerParts.push(`export ${k}=${shellQuote(v)}`);
  }

  if (cwd) {
    innerParts.push(`cd ${shellQuote(cwd)}`);
  }

  // Run user command in subshell with stderr redirected to temp file
  innerParts.push(`(${command}) 2>${shellQuote(stderrFile)}`);
  innerParts.push('EXIT_CODE=$?');
  innerParts.push('echo ""');
  innerParts.push(`echo "${EXIT_SENTINEL_PREFIX}\${EXIT_CODE}"`);
  innerParts.push('exit ${EXIT_CODE}');

  const innerScript = innerParts.join('; ');

  // Use exec to replace the shell — escape single quotes for bash -c '...'
  const escapedScript = innerScript.replace(/'/g, "'\"'\"'");
  return `exec bash -c '${escapedScript}'`;
}
