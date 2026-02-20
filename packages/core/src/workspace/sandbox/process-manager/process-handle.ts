/**
 * Process Handle (Base Class)
 *
 * Abstract base class for background process handles.
 * Manages stdout/stderr callback dispatch and provides lazy
 * reader/writer stream getters — subclasses only implement
 * the platform-specific primitives.
 */

import { Readable, Writable } from 'node:stream';

import type { CommandResult } from '../types';
import type { SpawnProcessOptions } from './types';

/**
 * Handle to a spawned background process.
 *
 * Subclasses implement the platform-specific primitives (stdout accumulation,
 * kill, sendStdin). The base class handles callback dispatch via
 * `emitStdout`/`emitStderr` and provides lazy `reader`/`writer` stream getters.
 *
 * **For consumers:**
 * - `handle.stdout` — poll accumulated output
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
  /** Accumulated stdout so far */
  abstract readonly stdout: string;
  /** Accumulated stderr so far */
  abstract readonly stderr: string;
  /** Exit code, undefined while the process is still running */
  abstract readonly exitCode: number | undefined;
  /** Wait for the command to finish and return the result */
  abstract wait(): Promise<CommandResult>;
  /** Kill the running command (SIGKILL). Returns true if killed, false if not found. */
  abstract kill(): Promise<boolean>;
  /** Send data to the command's stdin */
  abstract sendStdin(data: string): Promise<void>;

  private _onStdout?: (data: string) => void;
  private _onStderr?: (data: string) => void;
  private _reader?: Readable;
  private _writer?: Writable;

  constructor(options?: Pick<SpawnProcessOptions, 'onStdout' | 'onStderr'>) {
    this._onStdout = options?.onStdout;
    this._onStderr = options?.onStderr;
  }

  /**
   * Emit stdout data to the user callback and reader stream.
   * @internal Called by subclasses and process managers to dispatch transport data.
   */
  emitStdout(data: string): void {
    this._onStdout?.(data);
    this._reader?.push(data);
  }

  /**
   * Emit stderr data to the user callback.
   * @internal Called by subclasses and process managers to dispatch transport data.
   */
  emitStderr(data: string): void {
    this._onStderr?.(data);
  }

  /** Readable stream of stdout (for use with StreamMessageReader, pipes, etc.) */
  get reader(): Readable {
    if (!this._reader) {
      this._reader = new Readable({ read() {} });
      void this.wait().then(() => this._reader!.push(null));
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
