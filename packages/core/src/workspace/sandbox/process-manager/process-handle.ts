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

export const DEFAULT_MAX_RETAINED_PROCESS_OUTPUT_BYTES = 1024 * 1024;
const RETAINED_OUTPUT_COMPACT_CHUNK_THRESHOLD = 128;

/** @internal */
export function validateMaxRetainedProcessOutputBytes(maxRetainedBytes: number): number {
  if (maxRetainedBytes === Infinity) return maxRetainedBytes;
  if (!Number.isFinite(maxRetainedBytes) || maxRetainedBytes < 0 || !Number.isInteger(maxRetainedBytes)) {
    throw new RangeError('maxRetainedBytes must be a non-negative integer or Infinity');
  }
  return maxRetainedBytes;
}

function advanceStartByUtf8Bytes(
  value: string,
  start: number,
  minimumBytesToDrop: number,
): { start: number; droppedBytes: number } {
  let nextStart = start;
  let droppedBytes = 0;

  while (nextStart < value.length && droppedBytes < minimumBytesToDrop) {
    const codePoint = value.codePointAt(nextStart)!;

    if (codePoint < 0x80) droppedBytes += 1;
    else if (codePoint < 0x800) droppedBytes += 2;
    else if (codePoint < 0x10000) droppedBytes += 3;
    else droppedBytes += 4;

    nextStart += codePoint > 0xffff ? 2 : 1;
  }

  return { start: nextStart, droppedBytes };
}

interface RetainedOutputChunk {
  data: string;
  start: number;
  bytes: number;
  dataBytes: number;
}

class RetainedOutputBuffer {
  private chunks: RetainedOutputChunk[] = [];
  private bytes = 0;
  private droppedBytes = 0;
  private cachedValue: string | undefined;

  constructor(private readonly maxBytes: number) {}

  append(data: string): void {
    const dataBytes = Buffer.byteLength(data);
    if (dataBytes === 0) return;
    if (this.maxBytes === 0) {
      this.droppedBytes += dataBytes;
      return;
    }

    this.chunks.push({ data, start: 0, bytes: dataBytes, dataBytes });
    this.bytes += dataBytes;
    this.cachedValue = undefined;

    this.trim();
    this.compactIfNeeded();
  }

  toString(): string {
    this.cachedValue ??= this.chunks.map(chunk => chunk.data.slice(chunk.start)).join('');
    return this.cachedValue;
  }

  get truncated(): boolean {
    return this.droppedBytes > 0;
  }

  get dropped(): number {
    return this.droppedBytes;
  }

  private trim(): void {
    if (this.maxBytes === Infinity) return;

    while (this.bytes > this.maxBytes && this.chunks.length > 0) {
      const overflowBytes = this.bytes - this.maxBytes;
      const firstChunk = this.chunks[0]!;

      if (firstChunk.bytes <= overflowBytes) {
        this.chunks.shift();
        this.bytes -= firstChunk.bytes;
        this.droppedBytes += firstChunk.bytes;
        continue;
      }

      const { start, droppedBytes } = advanceStartByUtf8Bytes(firstChunk.data, firstChunk.start, overflowBytes);
      firstChunk.start = start;
      firstChunk.bytes -= droppedBytes;
      this.bytes -= droppedBytes;
      this.droppedBytes += droppedBytes;

      if (firstChunk.bytes === 0) {
        this.chunks.shift();
        continue;
      }

      if (firstChunk.dataBytes > this.maxBytes) {
        // V8 sliced strings retain their parent, so detach a bounded suffix from an oversized source chunk.
        firstChunk.data = Buffer.from(firstChunk.data.slice(firstChunk.start), 'utf8').toString('utf8');
        firstChunk.start = 0;
        firstChunk.dataBytes = firstChunk.bytes;
      }
    }
  }

  private compactIfNeeded(): void {
    if (this.chunks.length <= RETAINED_OUTPUT_COMPACT_CHUNK_THRESHOLD) return;
    const data = this.toString();
    this.bytes = Buffer.byteLength(data);
    this.chunks = this.bytes === 0 ? [] : [{ data, start: 0, bytes: this.bytes, dataBytes: this.bytes }];
    this.cachedValue = data;
  }
}

/**
 * Handle to a spawned process.
 *
 * Subclasses implement the platform-specific primitives (kill, sendStdin,
 * wait). The base class handles bounded stdout/stderr accumulation, callback
 * dispatch via `emitStdout`/`emitStderr`, lazy `reader`/`writer` stream
 * getters, and optional streaming callbacks on `wait()`.
 *
 * **For consumers:**
 * - `handle.stdout` — poll retained output
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
  abstract readonly pid: string;
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

  private _stdout: RetainedOutputBuffer;
  private _stderr: RetainedOutputBuffer;
  private _stdoutListeners = new Set<(data: string) => void>();
  private _stderrListeners = new Set<(data: string) => void>();
  private _reader?: Readable;
  private _writer?: Writable;

  constructor(options?: Pick<SpawnProcessOptions, 'maxRetainedBytes' | 'onStdout' | 'onStderr'>) {
    const maxRetainedBytes = validateMaxRetainedProcessOutputBytes(
      options?.maxRetainedBytes ?? DEFAULT_MAX_RETAINED_PROCESS_OUTPUT_BYTES,
    );
    this._stdout = new RetainedOutputBuffer(maxRetainedBytes);
    this._stderr = new RetainedOutputBuffer(maxRetainedBytes);

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
        const result = await implWait();
        return {
          ...result,
          stdoutTruncated: this.stdoutTruncated,
          stderrTruncated: this.stderrTruncated,
          stdoutDroppedBytes: this.stdoutDroppedBytes,
          stderrDroppedBytes: this.stderrDroppedBytes,
        };
      } finally {
        if (waitOptions?.onStdout) this._stdoutListeners.delete(waitOptions.onStdout);
        if (waitOptions?.onStderr) this._stderrListeners.delete(waitOptions.onStderr);
      }
    };
  }

  /** Retained stdout so far */
  get stdout(): string {
    return this._stdout.toString();
  }

  /** Retained stderr so far */
  get stderr(): string {
    return this._stderr.toString();
  }

  /** Whether stdout has dropped older output due to the retention limit */
  get stdoutTruncated(): boolean {
    return this._stdout.truncated;
  }

  /** Whether stderr has dropped older output due to the retention limit */
  get stderrTruncated(): boolean {
    return this._stderr.truncated;
  }

  /** Number of stdout bytes dropped due to the retention limit */
  get stdoutDroppedBytes(): number {
    return this._stdout.dropped;
  }

  /** Number of stderr bytes dropped due to the retention limit */
  get stderrDroppedBytes(): number {
    return this._stderr.dropped;
  }

  /**
   * Emit stdout data — accumulates, dispatches to user callback, and pushes to reader stream.
   * @internal Called by subclasses and process managers to dispatch transport data.
   */
  emitStdout(data: string): void {
    this._stdout.append(data);
    for (const listener of this._stdoutListeners) listener(data);
    this._reader?.push(data);
  }

  /**
   * Emit stderr data — accumulates and dispatches to user callback.
   * @internal Called by subclasses and process managers to dispatch transport data.
   */
  emitStderr(data: string): void {
    this._stderr.append(data);
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
