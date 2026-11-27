import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  EMBEDDER_PACKAGE_MISSING,
  FastembedWorker,
  isEmbedderPackageMissingError,
  WORKER_IDLE_TIMEOUT_MS,
} from './fastembed-subprocess.js';

const MINUTE = 60_000;

// A scoped `spawn` mock whose default is the real implementation: the Bun-shaped IPC and dispatch-failure
// regressions queue child doubles here, and every other test in this file keeps launching real processes.
const mockSpawnState = vi.hoisted(() => ({ queue: [] as unknown[] }));

vi.mock('node:child_process', async importOriginal => {
  const actual = await importOriginal<typeof import('node:child_process')>();
  return {
    ...actual,
    spawn: vi.fn((...args: Parameters<typeof actual.spawn>) => {
      const next = mockSpawnState.queue.shift() as FakeChild | { throw: Error } | undefined;
      if (!next) return actual.spawn(...args);
      if ('throw' in next) throw next.throw;
      return next as unknown as ReturnType<typeof actual.spawn>;
    }),
  };
});

// Stand-in for a worker process: it records sends and replies asynchronously, so tests can exercise the
// channel shape and dispatch failures without a real child.
class FakeChild extends EventEmitter {
  readonly pid = 900_000 + Math.floor(Math.random() * 90_000);
  readonly ref = vi.fn();
  readonly unref = vi.fn();
  readonly kill = vi.fn(() => {
    this.killed = true;
  });
  channel: { ref?: () => void; unref?: () => void } | undefined;
  killed = false;
  /** When true, `send` records the message but never replies; the test replies by hand. */
  manualReply = false;
  /** When set, `send` throws this value synchronously, like a refused IPC send. */
  failWith: Error | undefined;
  readonly sent: Array<{ id: number; entry: string; values: string[] }> = [];

  send(message: { id: number; entry: string; values: string[] }, callback?: (error: Error | null) => void): boolean {
    if (this.failWith) throw this.failWith;
    this.sent.push(message);
    callback?.(null);
    if (!this.manualReply) {
      queueMicrotask(() => {
        if (!this.killed) this.reply();
      });
    }
    return true;
  }

  /** Emits a worker reply for the most recent request, correlated by its id, in the fixture's vector shape. */
  reply(overrides: Partial<{ id: number; embeddings: number[][]; error: string }> = {}): void {
    const last = this.sent[this.sent.length - 1]!;
    const embeddings = last.values.map(v => [v.length, this.pid]);
    this.emit('message', { id: last.id, embeddings, ...overrides });
  }
}

// Stand-in for @mastra/fastembed: the worker imports whatever entry it is given. Each vector is
// [text length, worker pid, start time, end time], so tests can tell which worker ran a request and when.
// Text 'slow' takes 300 ms, 'crash' kills the worker, 'fail' throws.
function fixture(): string {
  const file = join(mkdtempSync(join(tmpdir(), 'fastembed-worker-')), 'fastembed.mjs');
  writeFileSync(
    file,
    `export const fastembed = { small: { async doEmbed({ values }) {
      const start = Date.now();
      if (values[0] === 'crash') process.kill(process.pid, 'SIGKILL');
      if (values[0] === 'fail') throw new Error('model missing');
      if (values[0] === 'slow') await new Promise(r => setTimeout(r, 300));
      return { embeddings: values.map(v => [v.length, process.pid, start, Date.now()]), warnings: [{ type: 'other', message: 'w' }] };
    } } };\n`,
  );
  return pathToFileURL(file).href;
}

function isRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

// Polls with node:timers/promises, which fake timers leave alone.
async function waitUntil(condition: () => boolean, ms = 5_000): Promise<void> {
  const deadline = Date.now() + ms;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error('timed out');
    await sleep(20);
  }
}

const pidOf = (result: { embeddings: number[][] }) => result.embeddings[0]![1]!;

describe('FastembedWorker', () => {
  let worker: FastembedWorker;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    worker = new FastembedWorker(fixture());
  });

  afterEach(() => {
    worker.close();
    vi.useRealTimers();
  });

  it('embeds in a child process and returns its vectors and warnings', async () => {
    const result = await worker.embed({ values: ['ab', 'abcd'] });
    expect(result.embeddings.map(e => e[0])).toEqual([2, 4]);
    expect(pidOf(result)).not.toBe(process.pid);
    expect(pidOf(result)).toBe(worker.pid);
    expect(result.warnings).toEqual([{ type: 'other', message: 'w' }]);
  });

  it('reuses one worker for consecutive and queued requests, one at a time', async () => {
    const first = await worker.embed({ values: ['a'] });
    const second = await worker.embed({ values: ['b'] });
    const queued = await Promise.all([
      worker.embed({ values: ['slow'] }),
      worker.embed({ values: ['slow'] }),
      worker.embed({ values: ['c'] }),
    ]);
    const pids = [first, second, ...queued].map(pidOf);
    expect(new Set(pids).size).toBe(1);
    const [a, b, c] = queued.map(r => r.embeddings[0]!);
    expect(b![2]).toBeGreaterThanOrEqual(a![3]!);
    expect(c![2]).toBeGreaterThanOrEqual(b![3]!);
  });

  it('keeps the worker after a request fails', async () => {
    const pid = pidOf(await worker.embed({ values: ['a'] }));
    await expect(worker.embed({ values: ['fail'] })).rejects.toThrow('model missing');
    expect(pidOf(await worker.embed({ values: ['b'] }))).toBe(pid);
  });

  it('stops an idle worker after five minutes, and each request restarts the countdown', async () => {
    expect(WORKER_IDLE_TIMEOUT_MS).toBe(5 * MINUTE);
    const pid = pidOf(await worker.embed({ values: ['a'] }));

    vi.advanceTimersByTime(4 * MINUTE);
    expect(pidOf(await worker.embed({ values: ['b'] }))).toBe(pid);
    vi.advanceTimersByTime(4 * MINUTE);
    expect(worker.pid).toBe(pid);
    expect(isRunning(pid)).toBe(true);

    vi.advanceTimersByTime(1 * MINUTE);
    expect(worker.pid).toBeUndefined();
    await waitUntil(() => !isRunning(pid));

    const next = pidOf(await worker.embed({ values: ['c'] }));
    expect(next).not.toBe(pid);
    expect(worker.pid).toBe(next);
  });

  it('never stops the worker for idleness while work is active or queued', async () => {
    const pid = pidOf(await worker.embed({ values: ['a'] }));
    const first = worker.embed({ values: ['slow'] });
    const second = worker.embed({ values: ['slow'] });
    // One request running, one queued.
    vi.advanceTimersByTime(30 * MINUTE);
    expect(pidOf(await first)).toBe(pid);
    // The queued one is running now.
    vi.advanceTimersByTime(30 * MINUTE);
    expect(pidOf(await second)).toBe(pid);
    expect(worker.pid).toBe(pid);

    // Once the work drains, the worker gets the full five idle minutes.
    vi.advanceTimersByTime(5 * MINUTE - 1);
    expect(worker.pid).toBe(pid);
    vi.advanceTimersByTime(1);
    expect(worker.pid).toBeUndefined();
  });

  it('fails the active request when the worker is killed, then runs the queue on a new worker', async () => {
    const pid = pidOf(await worker.embed({ values: ['a'] }));
    const crashed = worker.embed({ values: ['crash'] });
    const queued = worker.embed({ values: ['b'] });
    await expect(crashed).rejects.toThrow(/signal SIGKILL/);
    const next = pidOf(await queued);
    expect(next).not.toBe(pid);
    expect(worker.pid).toBe(next);
  });

  it('kills the worker when the active request aborts, then runs the queue on a new worker', async () => {
    const controller = new AbortController();
    const active = worker.embed({ values: ['slow'], abortSignal: controller.signal });
    const queued = worker.embed({ values: ['b'] });
    await waitUntil(() => worker.pid !== undefined);
    const pid = worker.pid!;
    controller.abort(new Error('stop'));
    await expect(active).rejects.toThrow('stop');
    const next = pidOf(await queued);
    expect(next).not.toBe(pid);
    await waitUntil(() => !isRunning(pid));
  });

  it('drops an aborted queued request without touching the active one', async () => {
    const controller = new AbortController();
    const active = worker.embed({ values: ['slow'] });
    const queued = worker.embed({ values: ['b'], abortSignal: controller.signal });
    const after = worker.embed({ values: ['c'] });
    controller.abort(new Error('stop'));
    await expect(queued).rejects.toThrow('stop');
    const pids = (await Promise.all([active, after])).map(pidOf);
    expect(pids[0]).toBe(pids[1]);
  });

  it('rejects an already aborted request without starting a worker', async () => {
    const controller = new AbortController();
    controller.abort(new Error('stop'));
    await expect(worker.embed({ values: ['a'], abortSignal: controller.signal })).rejects.toThrow('stop');
    expect(worker.pid).toBeUndefined();
  });
});

// Bun provides an IPC channel object without Node's `ref()`/`unref()`, and a refused `send` (or a spawn
// failure) throws synchronously. Neither may strand the queue behind the failed job.
describe('FastembedWorker with a Bun-shaped channel and dispatch failures', () => {
  function queueSpawn(...children: Array<FakeChild | { throw: Error }>): void {
    mockSpawnState.queue.push(...children);
  }

  function withTimeout<T>(promise: Promise<T>, ms = 2_000): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        const timer = setTimeout(() => reject(new Error('worker regression timed out')), ms);
        timer.unref();
      }),
    ]);
  }

  afterEach(() => {
    mockSpawnState.queue.length = 0;
  });

  it('runs queued work over a channel that has no ref/unref, then drains to idle', async () => {
    const child = new FakeChild();
    child.channel = {}; // Bun: a channel object that lacks Node's ref() and unref() methods.
    queueSpawn(child);
    const worker = new FastembedWorker('unused');
    try {
      const first = worker.embed({ values: ['a'] });
      const second = worker.embed({ values: ['bcd'] });
      const [r1, r2] = await withTimeout(Promise.all([first, second]));

      // Both requests settle, on the same healthy child, correlated by their request ids.
      expect(child.sent.map(m => m.id)).toEqual([0, 1]);
      expect(r1.embeddings[0]).toEqual([1, child.pid]);
      expect(r2.embeddings[0]).toEqual([3, child.pid]);
      expect(worker.pid).toBe(child.pid);

      // Draining to idle must not throw on the missing `channel.unref()`.
      expect(child.kill).not.toHaveBeenCalled();
    } finally {
      worker.close();
    }
  });

  it('references the child and channel while active, and unreferences both when idle', async () => {
    const child = new FakeChild();
    child.channel = { ref: vi.fn(), unref: vi.fn() };
    child.manualReply = true;
    queueSpawn(child);
    const worker = new FastembedWorker('unused');
    try {
      const pending = worker.embed({ values: ['a'] });
      expect(child.ref).toHaveBeenCalledTimes(1);
      expect(child.channel.ref).toHaveBeenCalledTimes(1);
      expect(child.unref).not.toHaveBeenCalled();
      expect(child.channel.unref).not.toHaveBeenCalled();

      child.reply();
      await withTimeout(pending);
      expect(child.unref).toHaveBeenCalledTimes(1);
      expect(child.channel.unref).toHaveBeenCalledTimes(1);
    } finally {
      worker.close();
    }
  });

  it('rejects a job whose send throws, then runs the queue on a fresh worker', async () => {
    const failing = new FakeChild();
    failing.channel = { ref: vi.fn(), unref: vi.fn() };
    const sendError = new Error('send failed');
    failing.failWith = sendError;
    const healthy = new FakeChild();
    healthy.channel = { ref: vi.fn(), unref: vi.fn() };
    queueSpawn(failing, healthy);
    const worker = new FastembedWorker('unused');
    try {
      const failed = worker.embed({ values: ['a'] });
      const queued = worker.embed({ values: ['bcd'] });

      await expect(failed).rejects.toBe(sendError);
      expect(failing.kill).toHaveBeenCalledWith('SIGKILL');

      // The queued job is not stranded: it runs on a replacement child.
      const result = await withTimeout(queued);
      expect(result.embeddings[0]).toEqual([3, healthy.pid]);
      expect(worker.pid).toBe(healthy.pid);

      // Late error/exit from the failed child cannot reject or replace the new active job.
      failing.emit('error', new Error('late error'));
      failing.emit('exit', 1, null);
      const after = await withTimeout(worker.embed({ values: ['de'] }));
      expect(after.embeddings[0]).toEqual([2, healthy.pid]);
      expect(worker.pid).toBe(healthy.pid);
    } finally {
      worker.close();
    }
  });

  it('rejects a job when spawning fails synchronously and keeps the queue moving', async () => {
    const spawnError = new Error('spawn failed');
    const healthy = new FakeChild();
    healthy.channel = { ref: vi.fn(), unref: vi.fn() };
    queueSpawn({ throw: spawnError }, healthy);
    const worker = new FastembedWorker('unused');
    try {
      const failed = worker.embed({ values: ['a'] });
      await expect(failed).rejects.toBe(spawnError);
      expect(worker.pid).toBeUndefined();

      const ok = await withTimeout(worker.embed({ values: ['bcd'] }));
      expect(ok.embeddings[0]).toEqual([3, healthy.pid]);
      expect(worker.pid).toBe(healthy.pid);
    } finally {
      worker.close();
    }
  });
});

// The package is in place but cannot load, as with a partial install. A missing package has to be
// told apart from other failures so a caller can offer to reinstall it rather than guess from text.
describe('FastembedWorker when @mastra/fastembed cannot load', () => {
  function entry(source: string): string {
    const file = join(mkdtempSync(join(tmpdir(), 'fastembed-worker-')), 'fastembed.mjs');
    writeFileSync(file, source);
    return pathToFileURL(file).href;
  }

  it('reports a package it imports that is not installed as a missing embedder package', async () => {
    const worker = new FastembedWorker(entry(`export * from 'mc-test-package-that-is-not-installed';\n`));
    try {
      const error = await worker.embed({ values: ['a'] }).catch(e => e);
      expect(isEmbedderPackageMissingError(error)).toBe(true);
      expect(error.code).toBe(EMBEDDER_PACKAGE_MISSING);
      expect(error.message).toMatch(/^Memory recall is off: the local embedder package @mastra\/fastembed/);
      expect(error.message).toContain("Cannot find package 'mc-test-package-that-is-not-installed'");
      expect(error.message).toContain('Reinstall Mastra Code');
    } finally {
      worker.close();
    }
  });

  it('reports a CommonJS dependency that is not installed as a missing embedder package', async () => {
    const worker = new FastembedWorker(
      entry(
        `import { createRequire } from 'node:module';\n` +
          `createRequire(import.meta.url)('mc-test-cjs-package-that-is-not-installed');\n`,
      ),
    );
    try {
      const error = await worker.embed({ values: ['a'] }).catch(e => e);
      expect(isEmbedderPackageMissingError(error)).toBe(true);
      expect(error.message).toContain("Cannot find module 'mc-test-cjs-package-that-is-not-installed'");
    } finally {
      worker.close();
    }
  });

  it('does not call other load failures or model failures a missing package', async () => {
    const broken = new FastembedWorker(entry(`throw new Error('native binding failed');\n`));
    const working = new FastembedWorker(fixture());
    try {
      const loadError = await broken.embed({ values: ['a'] }).catch(e => e);
      expect(loadError.message).toContain('native binding failed');
      expect(isEmbedderPackageMissingError(loadError)).toBe(false);

      const modelError = await working.embed({ values: ['fail'] }).catch(e => e);
      expect(modelError.message).toContain('model missing');
      expect(isEmbedderPackageMissingError(modelError)).toBe(false);
    } finally {
      broken.close();
      working.close();
    }
  });
});

// What a UI subscribes to: memory swallows the embed error, so this is the only signal a session gets.
describe('onEmbedderPackageMissing', () => {
  let unblock: (() => void) | undefined;
  afterEach(() => unblock?.());

  it('tells each listener once, replays to a late listener, and never changes the embed error', async () => {
    const hooks = registerHooks({
      resolve(specifier, context, nextResolve) {
        if (specifier !== '@mastra/fastembed') return nextResolve(specifier, context);
        throw Object.assign(new Error(`Cannot find package '@mastra/fastembed'`), { code: 'ERR_MODULE_NOT_FOUND' });
      },
    });
    unblock = () => hooks.deregister();
    vi.resetModules();
    const { embedInSubprocess, onEmbedderPackageMissing } = await import('./fastembed-subprocess.js');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const embed = () => embedInSubprocess({ values: ['a'] }).catch(e => e);
    try {
      // Nobody listening yet (memory indexes while Mastra Code boots): one console line, kept for later.
      expect(isEmbedderPackageMissingError(await embed())).toBe(true);
      expect(isEmbedderPackageMissingError(await embed())).toBe(true);
      expect(warn).toHaveBeenCalledTimes(1);

      const first = vi.fn();
      const stopFirst = onEmbedderPackageMissing(first);
      expect(first).toHaveBeenCalledTimes(1);
      await embed();
      expect(first).toHaveBeenCalledTimes(1);

      const throwing = vi.fn(() => {
        throw new Error('listener bug');
      });
      const second = vi.fn();
      onEmbedderPackageMissing(throwing);
      onEmbedderPackageMissing(second);
      expect(second).not.toHaveBeenCalled();
      const error = await embed();
      expect(isEmbedderPackageMissingError(error)).toBe(true);
      expect(throwing).toHaveBeenCalledTimes(1);
      expect(second).toHaveBeenCalledTimes(1);
      expect(second.mock.calls[0]![0].code).toBe(EMBEDDER_PACKAGE_MISSING);
      stopFirst();
    } finally {
      warn.mockRestore();
    }
  });

  it('still subscribes when a late listener throws on the replayed notice', async () => {
    const hooks = registerHooks({
      resolve(specifier, context, nextResolve) {
        if (specifier !== '@mastra/fastembed') return nextResolve(specifier, context);
        throw Object.assign(new Error(`Cannot find package '@mastra/fastembed'`), { code: 'ERR_MODULE_NOT_FOUND' });
      },
    });
    unblock = () => hooks.deregister();
    vi.resetModules();
    const { embedInSubprocess, onEmbedderPackageMissing } = await import('./fastembed-subprocess.js');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      await embedInSubprocess({ values: ['a'] }).catch(() => {});
      const throwing = vi.fn(() => {
        throw new Error('listener bug');
      });
      const stop = onEmbedderPackageMissing(throwing);
      expect(throwing).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenLastCalledWith('Embedder notice listener failed: Error: listener bug');
      stop();
    } finally {
      warn.mockRestore();
    }
  });
});

describe('FastembedWorker in a finished CLI', () => {
  const moduleUrl = new URL('./fastembed-subprocess.ts', import.meta.url).href;
  const packageDir = fileURLToPath(new URL('../..', import.meta.url));
  const parents: ChildProcess[] = [];

  afterEach(() => {
    for (const parent of parents.splice(0)) parent.kill('SIGKILL');
  });

  // Runs a parent process that embeds once, prints the worker pid, then runs `tail`.
  function runParent(tail: string) {
    const script = join(mkdtempSync(join(tmpdir(), 'fastembed-parent-')), 'parent.mjs');
    writeFileSync(
      script,
      `import { FastembedWorker } from ${JSON.stringify(moduleUrl)};
      const worker = new FastembedWorker(${JSON.stringify(fixture())});
      const { embeddings } = await worker.embed({ values: ['a'] });
      process.stdout.write(embeddings[0][1] + '\\n');
      ${tail}\n`,
    );
    const parent = spawn(process.execPath, ['--import', 'tsx', script], {
      cwd: packageDir,
      stdio: ['ignore', 'pipe', 'inherit'],
    });
    parents.push(parent);
    const exited = new Promise<number | null>(resolve => parent.once('exit', code => resolve(code)));
    const workerPid = new Promise<number>((resolve, reject) => {
      let out = '';
      parent.stdout.on('data', chunk => {
        out += chunk;
        if (out.includes('\n')) resolve(Number(out.trim()));
      });
      void exited.then(code => reject(new Error(`parent exited with code ${code} before embedding`)));
    });
    return { parent, workerPid, exited };
  }

  it('lets the CLI exit with the worker idle, and the worker exits with it', async () => {
    const { workerPid, exited } = runParent('');
    const pid = await workerPid;
    expect(pid).toBeGreaterThan(0);
    // Well before the five-minute idle timeout.
    await expect(Promise.race([exited, sleep(10_000, 'still running', { ref: false })])).resolves.toBe(0);
    await waitUntil(() => !isRunning(pid));
  }, 30_000);

  it('ends the worker when the CLI is killed', async () => {
    const { parent, workerPid, exited } = runParent('setInterval(() => {}, 1000);');
    const pid = await workerPid;
    expect(pid).toBeGreaterThan(0);
    expect(isRunning(pid)).toBe(true);
    parent.kill('SIGKILL');
    await exited;
    await waitUntil(() => !isRunning(pid));
  }, 30_000);
});
