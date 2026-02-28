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
 * ## PTY output structure (observed from @daytonaio/sdk@0.143.0)
 *
 * The raw PTY stream for a command like `echo hello` looks like:
 * ```
 * <echo of sendInput text>\r\n          ← PTY echoes back what we typed
 * <shell prompt / ANSI noise>           ← zsh prompt, bracketed paste start
 * <line-wrapped echo of command>        ← shell re-renders the long command
 * \u001b[?2004l\r\r\n                   ← END of bracketed paste (output boundary)
 * hello\r\n                             ← ACTUAL command output starts here
 * \r\n                                  ← blank echo line
 * MASTRA_EXIT_a7f3:0\r\n               ← exit sentinel
 * ```
 *
 * We extract clean output by finding the bracketed paste end marker
 * (`\u001b[?2004l\r\r\n`) and the exit sentinel, then taking everything
 * between them. PTY line endings (\r\n) are normalized to \n.
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

/**
 * Marker that signals the end of shell echo/prompt noise and the start
 * of real command output. This is the "bracketed paste mode off" sequence
 * that zsh emits after accepting the input line.
 */
const OUTPUT_BOUNDARY_MARKER = '\u001b[?2004l\r\r\n';

// =============================================================================
// PTY Process Handle
// =============================================================================

/**
 * Wraps a Daytona PTY session to conform to Mastra's ProcessHandle.
 *
 * Raw PTY data accumulates in _rawBuffer. We do NOT call emitStdout()
 * with raw PTY data because it contains shell noise. Instead, clean
 * output is extracted after the process exits and emitted then.
 *
 * For streaming onStdout callbacks: we detect the output boundary marker
 * and start streaming real output as it arrives.
 */
class DaytonaPtyProcessHandle extends ProcessHandle {
  readonly pid: number;

  private readonly _ptyHandle: PtyHandle;
  private readonly _ptySessionId: string;
  private readonly _stderrFile: string;
  private readonly _sandbox: DaytonaSandbox;
  private readonly _startTime: number;
  private readonly _timeout?: number;

  /** Accumulates ALL raw PTY output (including shell noise). */
  private _rawBuffer = '';

  /** Whether we've seen the output boundary marker and started streaming. */
  private _outputStarted = false;

  /** Leftover data that might contain a partial sentinel at the boundary. */
  private _pendingChunk = '';

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
   * Accumulates raw output. Streams clean output after the boundary marker.
   */
  appendOutput(data: string): void {
    this._rawBuffer += data;

    if (!this._outputStarted) {
      // Check if the boundary marker has appeared in the raw buffer
      const markerIdx = this._rawBuffer.indexOf(OUTPUT_BOUNDARY_MARKER);
      if (markerIdx !== -1) {
        this._outputStarted = true;
        // Everything after the marker is real output — start streaming
        const outputStart = markerIdx + OUTPUT_BOUNDARY_MARKER.length;
        const realOutput = this._rawBuffer.slice(outputStart);
        if (realOutput.length > 0) {
          this._streamCleanChunk(realOutput);
        }
      }
      return;
    }

    // Already streaming — emit new data (will be filtered for sentinel later)
    this._streamCleanChunk(data);
  }

  /**
   * Stream a chunk of real output, holding back potential sentinel lines.
   * Normalizes \r\n to \n.
   */
  private _streamCleanChunk(raw: string): void {
    // Prepend any pending data from previous chunk
    const combined = this._pendingChunk + raw;
    this._pendingChunk = '';

    // Normalize \r\n → \n
    const normalized = combined.replace(/\r\n/g, '\n');

    // Check if this chunk contains the sentinel
    const sentinelIdx = normalized.indexOf(EXIT_SENTINEL_PREFIX);
    if (sentinelIdx !== -1) {
      // Emit everything before the sentinel (minus trailing blank line)
      let output = normalized.slice(0, sentinelIdx);
      // Strip trailing blank line from the `echo ""` before sentinel
      if (output.endsWith('\n\n')) {
        output = output.slice(0, -1);
      }
      if (output.length > 0) {
        this.emitStdout(output);
      }
      // Don't emit the sentinel itself
      return;
    }

    // Hold back the last line in case it's a partial sentinel
    const lastNewline = normalized.lastIndexOf('\n');
    if (lastNewline === -1) {
      // No complete line — hold everything
      this._pendingChunk = normalized;
      return;
    }

    const toEmit = normalized.slice(0, lastNewline + 1);
    this._pendingChunk = normalized.slice(lastNewline + 1);

    if (toEmit.length > 0) {
      this.emitStdout(toEmit);
    }
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
      await this._ptyDonePromise;
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

    // Parse exit code from sentinel if not already set
    this._parseExitSentinel();

    // Flush any remaining pending chunk that wasn't a sentinel
    if (this._pendingChunk.length > 0 && !this._pendingChunk.includes(EXIT_SENTINEL_PREFIX)) {
      this.emitStdout(this._pendingChunk);
      this._pendingChunk = '';
    }

    // Read stderr from temp file
    await this._readStderrFile();

    // Clean up stderr temp file (best-effort)
    this._cleanupStderrFile();

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
      sandbox.process.executeCommand(`rm -f ${shellQuote(this._stderrFile)}`).catch(() => {});
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
        envs: { TERM: 'dumb', ...envs },
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
