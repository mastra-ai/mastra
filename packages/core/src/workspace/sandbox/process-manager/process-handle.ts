/**
 * Process Handle (Base Class)
 *
 * Abstract base class for process handles.
 * Manages stdout/stderr callback dispatch and provides lazy
 * reader/writer stream getters — subclasses only implement
 * the platform-specific primitives.
 */

import { Readable, Writable } from 'node:stream';

import type { CommandResult } from '../types';
import type { SpawnProcessOptions } from './types';

/**
 * Handle to a spawned process.
 *
 * Subclasses implement the platform-specific primitives (kill, sendStdin,
 * wait). The base class handles stdout/stderr accumulation, callback
 * dispatch via `emitStdout`/`emitStderr`, lazy `reader`/`writer` stream
 * getters, and optional streaming callbacks on `wait()`.
 *
 * **For consumers:**
 * - `handle.stdout` — poll accumulated output
 * - `handle.wait()` — wait for exit, optionally with streaming callbacks
 * - `handle.reader` / `handle.writer` — Node.js stream interop (LSP, JSON-RPC, pipes)
 * - `onStdout`/`onStderr` callbacks in {@link SpawnProcessOptions} — stream at spawn time
 *
 * **For implementors:** Call `emitStdout(data)` / `emitStderr(data)` from
 * your transport callback (ChildProcess events, WebSocket messages, etc.)
 * to dispatch data. Pass `options` through to `super(options)` to wire
 * user callbacks automatically.
 *
 * @example
 * ```typescript
 * // Poll model
 * const handle = await sandbox.processes.spawn('node server.js');
 * console.log(handle.stdout);
 *
 * // Stream model — callbacks at spawn time
 * const handle = await sandbox.processes.spawn('npm run dev', {
 *   onStdout: (data) => console.log(data),
 * });
 *
 * // Stream model — callbacks during wait
 * const result = await handle.wait({
 *   onStdout: (data) => process.stdout.write(data),
 *   onStderr: (data) => process.stderr.write(data),
 * });
 *
 * // Stream model — pipe to LSP, JSON-RPC, etc.
 * const handle = await sandbox.processes.spawn('typescript-language-server --stdio');
 * const connection = createMessageConnection(
 *   new StreamMessageReader(handle.reader),
 *   new StreamMessageWriter(handle.writer),
 * );
 * ```
 */
export abstract class ProcessHandle {
  /** Process ID */
  abstract readonly pid: number;
  /** Exit code, undefined while the process is still running */
  abstract readonly exitCode: number | undefined;
  /** The command that was spawned (set by the process manager) */
  command?: string;
  /** Kill the running process (SIGKILL). Returns true if killed, false if not found. */
  abstract kill(): Promise<boolean>;
  /** Send data to the process's stdin */
  abstract sendStdin(data: string): Promise<void>;

  /**
   * Wait for the process to finish and return the result.
   *
   * Optionally pass `onStdout`/`onStderr` callbacks to stream output chunks
   * while waiting. The callbacks are automatically removed when `wait()`
   * resolves, so there's no cleanup needed by the caller.
   *
   * Subclasses implement `wait()` with platform-specific logic — the base
   * constructor wraps it to handle the optional streaming callbacks.
   */
  async wait(_options?: {
    onStdout?: (data: string) => void;
    onStderr?: (data: string) => void;
  }): Promise<CommandResult> {
    throw new Error(`${this.constructor.name} must implement wait()`);
  }

  private _stdout = '';
  private _stderr = '';
  private _stdoutListeners = new Set<(data: string) => void>();
  private _stderrListeners = new Set<(data: string) => void>();
  private _reader?: Readable;
  private _writer?: Writable;

  constructor(options?: Pick<SpawnProcessOptions, 'onStdout' | 'onStderr'>) {
    // Spawn-time callbacks are permanent listeners
    if (options?.onStdout) this._stdoutListeners.add(options.onStdout);
    if (options?.onStderr) this._stderrListeners.add(options.onStderr);

    // Capture subclass wait() (via prototype chain) before shadowing
    // with a wrapper that handles optional streaming callbacks.
    const implWait = this.wait.bind(this);

    this.wait = async (waitOptions?: { onStdout?: (data: string) => void; onStderr?: (data: string) => void }) => {
      if (waitOptions?.onStdout) this._stdoutListeners.add(waitOptions.onStdout);
      if (waitOptions?.onStderr) this._stderrListeners.add(waitOptions.onStderr);
      try {
        return await implWait();
      } finally {
        if (waitOptions?.onStdout) this._stdoutListeners.delete(waitOptions.onStdout);
        if (waitOptions?.onStderr) this._stderrListeners.delete(waitOptions.onStderr);
      }
    };
  }

  /** Accumulated stdout so far */
  get stdout(): string {
    return this._stdout;
  }

  /** Accumulated stderr so far */
  get stderr(): string {
    return this._stderr;
  }

  /**
   * Emit stdout data — accumulates, dispatches to user callback, and pushes to reader stream.
   * @internal Called by subclasses and process managers to dispatch transport data.
   */
  emitStdout(data: string): void {
    this._stdout += data;
    for (const listener of this._stdoutListeners) listener(data);
    this._reader?.push(data);
  }

  /**
   * Emit stderr data — accumulates and dispatches to user callback.
   * @internal Called by subclasses and process managers to dispatch transport data.
   */
  emitStderr(data: string): void {
    this._stderr += data;
    for (const listener of this._stderrListeners) listener(data);
  }

  /** Readable stream of stdout (for use with StreamMessageReader, pipes, etc.) */
  get reader(): Readable {
    if (!this._reader) {
      this._reader = new Readable({ read() {} });
      void this.wait().then(
        () => this._reader!.push(null),
        () => this._reader!.push(null),
      );
    }
    return this._reader;
  }

  /** Writable stream to stdin (for use with StreamMessageWriter, pipes, etc.) */
  get writer(): Writable {
    if (!this._writer) {
      this._writer = new Writable({
        write: (chunk, _encoding, cb) => {
          this.sendStdin(chunk.toString()).then(() => cb(), cb);
        },
      });
    }
    return this._writer;
  }
}
