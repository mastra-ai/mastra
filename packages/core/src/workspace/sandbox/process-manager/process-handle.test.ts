import { once } from 'node:events';

import { describe, expect, it, vi } from 'vitest';

import type { MastraSandbox } from '../mastra-sandbox';
import type { CommandResult } from '../types';
import { ProcessHandle, UnsupportedStdinCloseError } from './process-handle';
import { SandboxProcessManager } from './process-manager';
import type { SpawnProcessOptions } from './types';

class TestProcessHandle extends ProcessHandle {
  readonly pid = 'test-pid';
  exitCode: number | undefined;

  private resolveWait!: (result: CommandResult) => void;
  private readonly waitPromise = new Promise<CommandResult>(resolve => {
    this.resolveWait = resolve;
  });

  constructor(options?: SpawnProcessOptions) {
    super(options);
  }

  async wait(_options?: {
    onStdout?: (data: string) => void;
    onStderr?: (data: string) => void;
    abortSignal?: AbortSignal;
  }): Promise<CommandResult> {
    return this.waitPromise;
  }

  async kill(): Promise<boolean> {
    this.exitCode = 137;
    return true;
  }

  async sendStdin(): Promise<void> {}

  async closeStdin(): Promise<void> {}

  finish(): void {
    this.exitCode = 0;
    this.resolveWait({
      success: true,
      exitCode: 0,
      stdout: this.stdout,
      stderr: this.stderr,
      stdoutTruncated: this.stdoutTruncated,
      stderrTruncated: this.stderrTruncated,
      stdoutDroppedBytes: this.stdoutDroppedBytes,
      stderrDroppedBytes: this.stderrDroppedBytes,
      executionTimeMs: 0,
    });
  }
}

/** Mirrors providers that never override `closeStdin()`. */
class NoStdinCloseProcessHandle extends ProcessHandle {
  readonly pid = 'no-close-pid';
  exitCode: number | undefined;

  async wait(): Promise<CommandResult> {
    throw new Error('not used');
  }

  async kill(): Promise<boolean> {
    return true;
  }

  async sendStdin(): Promise<void> {}
}

class TestProcessManager extends SandboxProcessManager {
  spawnCalls = 0;
  ensureRunningCalls = 0;
  private readonly handle = new TestProcessHandle();

  constructor() {
    super();
    this.sandbox = {
      ensureRunning: async () => {
        this.ensureRunningCalls += 1;
      },
    } as unknown as MastraSandbox;
  }

  async spawn(_command: string, options?: SpawnProcessOptions): Promise<ProcessHandle> {
    this.spawnCalls += 1;
    const handle = options ? new TestProcessHandle(options) : this.handle;
    this._tracked.set(handle.pid, handle);
    return handle;
  }

  async list(): Promise<[]> {
    return [];
  }
}

describe('ProcessHandle output retention', () => {
  it('bounds stdout and stderr to the newest retained bytes by default', () => {
    const handle = new TestProcessHandle();

    handle.emitStdout('a'.repeat(1024 * 1024));
    handle.emitStdout('tail');
    handle.emitStderr('b'.repeat(1024 * 1024));
    handle.emitStderr('tail');

    expect(Buffer.byteLength(handle.stdout)).toBe(1024 * 1024);
    expect(handle.stdout).toMatch(/tail$/);
    expect(Buffer.byteLength(handle.stderr)).toBe(1024 * 1024);
    expect(handle.stderr).toMatch(/tail$/);
    expect(handle.stdoutDroppedBytes).toBe(4);
    expect(handle.stderrDroppedBytes).toBe(4);
  });

  it('uses maxRetainedBytes for polling output without truncating callbacks', () => {
    const stdoutChunks: string[] = [];
    const stderrChunks: string[] = [];
    const handle = new TestProcessHandle({
      maxRetainedBytes: 5,
      onStdout: data => stdoutChunks.push(data),
      onStderr: data => stderrChunks.push(data),
    });

    handle.emitStdout('hello');
    handle.emitStdout(' world');
    handle.emitStderr('error');
    handle.emitStderr(' text');

    expect(handle.stdout).toBe('world');
    expect(handle.stderr).toBe(' text');
    expect(stdoutChunks).toEqual(['hello', ' world']);
    expect(stderrChunks).toEqual(['error', ' text']);
  });

  it('rejects invalid retention limits', () => {
    expect(() => new TestProcessHandle({ maxRetainedBytes: -1 })).toThrow(RangeError);
    expect(() => new TestProcessHandle({ maxRetainedBytes: Number.NaN })).toThrow(RangeError);
    expect(() => new TestProcessHandle({ maxRetainedBytes: 1.5 })).toThrow(RangeError);
  });

  it('validates retention limits before provider spawn is called', async () => {
    const manager = new TestProcessManager();

    await expect(manager.spawn('sleep 60', { maxRetainedBytes: -1 })).rejects.toThrow(RangeError);
    expect(manager.ensureRunningCalls).toBe(0);
    expect(manager.spawnCalls).toBe(0);
  });

  it('makes a reused process ID visible after its previous handle was released', async () => {
    const manager = new TestProcessManager();
    const previousHandle = await manager.spawn('first');
    manager.release(previousHandle.pid);

    const reusedHandle = await manager.spawn('second');

    await expect(manager.get(reusedHandle.pid)).resolves.toBe(reusedHandle);
  });

  it('retains everything when maxRetainedBytes is Infinity', () => {
    const handle = new TestProcessHandle({ maxRetainedBytes: Infinity });

    for (let index = 0; index < 150; index += 1) {
      handle.emitStdout(`${index},`);
    }

    expect(handle.stdout).toBe(Array.from({ length: 150 }, (_, index) => `${index},`).join(''));
    expect(handle.stdoutTruncated).toBe(false);
    expect(handle.stdoutDroppedBytes).toBe(0);
  });

  it('handles a single chunk larger than the retention limit', () => {
    const handle = new TestProcessHandle({ maxRetainedBytes: 6 });

    handle.emitStdout('before-after');

    expect(handle.stdout).toBe('-after');
    expect(handle.stdoutDroppedBytes).toBe(Buffer.byteLength('before'));

    handle.emitStdout('🙂');

    expect(handle.stdout).toBe('er🙂');
    expect(Buffer.byteLength(handle.stdout)).toBe(6);
    expect(handle.stdoutTruncated).toBe(true);
    expect(handle.stdoutDroppedBytes).toBe(Buffer.byteLength('before-aft'));
  });

  it('does not split multibyte characters when trimming to a byte limit', () => {
    const handle = new TestProcessHandle({ maxRetainedBytes: 5 });

    handle.emitStdout('a🙂b');

    expect(Buffer.byteLength(handle.stdout)).toBe(5);
    expect(handle.stdout).toBe('🙂b');
    expect(handle.stdoutTruncated).toBe(true);
  });

  it('drops a code point that is larger than the retention limit', () => {
    const handle = new TestProcessHandle({ maxRetainedBytes: 1 });

    handle.emitStdout('🙂');
    handle.emitStdout('b');

    expect(handle.stdout).toBe('b');
    expect(handle.stdoutDroppedBytes).toBe(4);
  });

  it('keeps retained output correct after compacting many chunks', () => {
    const handle = new TestProcessHandle({ maxRetainedBytes: 10 });

    for (let index = 0; index < 150; index += 1) {
      handle.emitStdout(String(index % 10));
    }

    expect(handle.stdout).toBe('0123456789');
    expect(handle.stdoutDroppedBytes).toBe(140);
  });

  it('advances through compacted multibyte output across repeated appends', () => {
    const retainedCodePoints = 256;
    const output = Array.from({ length: retainedCodePoints + 150 }, (_, index) => ['🙂', '🚀', '🧠'][index % 3]!);
    const handle = new TestProcessHandle({ maxRetainedBytes: retainedCodePoints * 4 });

    for (const chunk of output) {
      handle.emitStdout(chunk);
    }

    expect(handle.stdout).toBe(output.slice(-retainedCodePoints).join(''));
    expect(Buffer.byteLength(handle.stdout)).toBe(retainedCodePoints * 4);
    expect(handle.stdoutDroppedBytes).toBe(150 * 4);
  });

  it('does not rescan retained output for a small overflow after compaction', () => {
    const maxRetainedBytes = 1024;
    const handle = new TestProcessHandle({ maxRetainedBytes });

    for (let index = 0; index < maxRetainedBytes; index += 1) {
      handle.emitStdout('a');
    }

    const byteLengthSpy = vi.spyOn(Buffer, 'byteLength');
    try {
      handle.emitStdout('b');

      expect(byteLengthSpy.mock.calls.length).toBeLessThan(10);
      expect(handle.stdout).toBe(`${'a'.repeat(maxRetainedBytes - 1)}b`);
      expect(handle.stdoutDroppedBytes).toBe(1);
    } finally {
      byteLengthSpy.mockRestore();
    }
  });

  it('returns retained output from wait after output is truncated', async () => {
    const handle = new TestProcessHandle({ maxRetainedBytes: 6 });

    handle.emitStdout('before ');
    handle.emitStdout('after');
    handle.emitStderr('first ');
    handle.emitStderr('second');
    handle.finish();

    await expect(handle.wait()).resolves.toMatchObject({
      stdout: ' after',
      stderr: 'second',
      stdoutTruncated: true,
      stderrTruncated: true,
      stdoutDroppedBytes: Buffer.byteLength('before'),
      stderrDroppedBytes: Buffer.byteLength('first '),
    });
    expect(handle.stdoutTruncated).toBe(true);
    expect(handle.stderrTruncated).toBe(true);
  });

  it('removes wait listeners after wait resolves', async () => {
    const handle = new TestProcessHandle();
    const chunks: string[] = [];
    const waiting = handle.wait({ onStdout: data => chunks.push(data) });

    handle.emitStdout('during wait');
    handle.finish();
    await waiting;
    handle.emitStdout('after wait');

    expect(chunks).toEqual(['during wait']);
  });

  it('allows retention to be disabled while keeping reader output intact', async () => {
    const handle = new TestProcessHandle({ maxRetainedBytes: 0 });
    const chunks: string[] = [];

    handle.reader.on('data', chunk => chunks.push(chunk.toString()));

    handle.emitStdout('hello');
    handle.emitStdout(' world');
    handle.finish();

    await once(handle.reader, 'end');

    expect(handle.stdout).toBe('');
    expect(chunks.join('')).toBe('hello world');
  });

  it('closes stdin when the writer stream ends', async () => {
    const handle = new TestProcessHandle();
    const sendStdin = vi.spyOn(handle, 'sendStdin');
    const closeStdin = vi.spyOn(handle, 'closeStdin');

    await new Promise<void>((resolve, reject) => {
      handle.writer.end('final input', err => (err ? reject(err) : resolve()));
    });

    expect(sendStdin).toHaveBeenCalledWith('final input');
    expect(closeStdin).toHaveBeenCalledTimes(1);
  });

  it('rejects closeStdin by default so providers opt in to stdin closure', async () => {
    const handle = new NoStdinCloseProcessHandle();

    await expect(handle.closeStdin()).rejects.toBeInstanceOf(UnsupportedStdinCloseError);
  });

  it('finishes the writer stream when the provider cannot close stdin', async () => {
    const handle = new TestProcessHandle();
    vi.spyOn(handle, 'closeStdin').mockRejectedValue(
      new UnsupportedStdinCloseError('provider does not support closing stdin'),
    );

    await new Promise<void>((resolve, reject) => {
      handle.writer.end('final input', err => (err ? reject(err) : resolve()));
    });
  });

  it('surfaces non-unsupported closeStdin failures through the writer stream', async () => {
    const handle = new TestProcessHandle();
    vi.spyOn(handle, 'closeStdin').mockRejectedValue(new Error('stream already destroyed'));

    const writer = handle.writer;
    const errored = once(writer, 'error');
    writer.end('final input');

    const [error] = (await errored) as [Error];
    expect(error.message).toBe('stream already destroyed');
  });
});

describe('ProcessHandle wait abortSignal', () => {
  it('kills the process when the signal aborts during a blocking wait', async () => {
    const handle = new TestProcessHandle();
    const kill = vi.spyOn(handle, 'kill');
    const controller = new AbortController();

    const waiting = handle.wait({ abortSignal: controller.signal });
    expect(kill).not.toHaveBeenCalled();

    controller.abort();
    expect(kill).toHaveBeenCalledTimes(1);

    // The wait still settles through the normal exit path.
    handle.finish();
    const result = await waiting;
    expect(result.exitCode).toBe(0);
  });

  it('kills immediately when the signal is already aborted', async () => {
    const handle = new TestProcessHandle();
    const kill = vi.spyOn(handle, 'kill');
    const controller = new AbortController();
    controller.abort();

    const waiting = handle.wait({ abortSignal: controller.signal });
    expect(kill).toHaveBeenCalledTimes(1);

    handle.finish();
    await waiting;
  });

  it('removes the abort listener once the wait settles', async () => {
    const handle = new TestProcessHandle();
    const kill = vi.spyOn(handle, 'kill');
    const controller = new AbortController();

    const waiting = handle.wait({ abortSignal: controller.signal });
    handle.finish();
    await waiting;

    // Aborting after the wait resolved must not kill a process the caller
    // is no longer waiting on.
    controller.abort();
    expect(kill).not.toHaveBeenCalled();
  });

  it('a wait without a signal is unaffected', async () => {
    const handle = new TestProcessHandle();
    const waiting = handle.wait();
    handle.finish();
    const result = await waiting;
    expect(result.success).toBe(true);
  });
});
