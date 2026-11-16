import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FastembedWorker, WORKER_IDLE_TIMEOUT_MS } from './fastembed-subprocess.js';

const MINUTE = 60_000;

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
