/**
 * Modal process manager. Each spawn() creates a ContainerProcess via exec().
 * kill() has no SDK equivalent — it cancels stream readers locally; the remote
 * process runs until the sandbox timeout.
 */

import { ProcessHandle, SandboxProcessManager } from '@mastra/core/workspace';
import type { CommandResult, ProcessInfo, SpawnProcessOptions } from '@mastra/core/workspace';
import type { ContainerProcess } from 'modal';
import type { ModalSandbox } from './index';

// =============================================================================
// Modal Process Handle
// =============================================================================

/**
 * Wraps a Modal ContainerProcess to conform to Mastra's ProcessHandle.
 */
class ModalProcessHandle extends ProcessHandle {
  readonly pid: string;

  private readonly _proc: ContainerProcess<string>;
  private readonly _startTime: number;
  private readonly _timeout?: number;

  private _exitCode: number | undefined;
  private _waitPromise: Promise<CommandResult> | null = null;
  private _streamingPromise: Promise<void> | null = null;
  private _killed = false;
  private _stdoutReader: ReadableStreamDefaultReader<string> | null = null;
  private _stderrReader: ReadableStreamDefaultReader<string> | null = null;

  constructor(pid: string, proc: ContainerProcess<string>, startTime: number, options?: SpawnProcessOptions) {
    super(options);
    this.pid = pid;
    this._proc = proc;
    this._startTime = startTime;
    this._timeout = options?.timeout;
  }

  get exitCode(): number | undefined {
    return this._exitCode;
  }

  /** @internal Set by the process manager after streaming starts. */
  set streamingPromise(p: Promise<void>) {
    this._streamingPromise = p;

    // Resolve exit code when streaming ends so exitCode is available without calling wait()
    p.then(() => this._resolveExitCode()).catch(() => this._resolveExitCode());
  }

  /** @internal Set by the process manager so kill() can cancel the readers. */
  setReaders(
    stdoutReader: ReadableStreamDefaultReader<string>,
    stderrReader: ReadableStreamDefaultReader<string>,
  ): void {
    this._stdoutReader = stdoutReader;
    this._stderrReader = stderrReader;
  }

  /** Fetch the exit code from the Modal process. No-op if already set. */
  private async _resolveExitCode(): Promise<void> {
    if (this._exitCode !== undefined) return;
    try {
      this._exitCode = await this._proc.wait();
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
          this._exitCode = 124; // conventional timeout exit code
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
    this._exitCode = 137; // SIGKILL
    // The remote process may continue running; Modal JS SDK has no per-exec kill.
    try {
      await this._stdoutReader?.cancel();
    } catch {
      // Ignore cancellation errors
    }
    try {
      await this._stderrReader?.cancel();
    } catch {
      // Ignore cancellation errors
    }
    return true;
  }

  async sendStdin(_data: string): Promise<void> {
    throw new Error('Modal JS SDK does not expose stdin on exec() — sendStdin() is not supported');
  }
}

// =============================================================================
// Modal Process Manager
// =============================================================================

export interface ModalProcessManagerOptions {
  env?: Record<string, string | undefined>;
}

/**
 * Modal implementation of SandboxProcessManager.
 * Uses the Modal SDK's exec() API with one ContainerProcess per spawn.
 */
export class ModalProcessManager extends SandboxProcessManager<ModalSandbox> {
  private _spawnCounter = 0;

  constructor(opts: ModalProcessManagerOptions = {}) {
    super({ env: opts.env });
  }

  async spawn(command: string, options: SpawnProcessOptions = {}): Promise<ProcessHandle> {
    return this.sandbox.retryOnDead(async () => {
      const sb = this.sandbox.modal;

      const mergedEnv = { ...this.env, ...options.env };
      const env = Object.fromEntries(
        Object.entries(mergedEnv).filter((entry): entry is [string, string] => entry[1] !== undefined),
      );

      // exec() takes string[] — wrap in sh -c to support pipes, redirects, etc.
      const argv = ['sh', '-c', command];

      const proc = await sb.exec(argv, {
        env: Object.keys(env).length > 0 ? env : undefined,
        workdir: options.cwd,
        timeoutMs: options.timeout,
      });

      const pid = `modal-proc-${Date.now().toString(36)}-${++this._spawnCounter}`;
      const handle = new ModalProcessHandle(pid, proc, Date.now(), options);

      const stdoutReader = proc.stdout.getReader();
      const stderrReader = proc.stderr.getReader();
      handle.setReaders(stdoutReader, stderrReader);

      const streamingPromise = Promise.all([
        drainReader(stdoutReader, chunk => handle.emitStdout(chunk)),
        drainReader(stderrReader, chunk => handle.emitStderr(chunk)),
      ]).then(() => {});

      handle.streamingPromise = streamingPromise;

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
}

// =============================================================================
// Stream Helpers
// =============================================================================

/** Reads chunks from a stream until done or cancelled. */
async function drainReader(reader: ReadableStreamDefaultReader<string>, emit: (chunk: string) => void): Promise<void> {
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      emit(value);
    }
  } catch {
    // cancelled or network error
  }
}
