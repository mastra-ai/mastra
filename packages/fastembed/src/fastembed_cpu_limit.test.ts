import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import { afterEach, beforeAll, expect, test, vi } from 'vitest';
import { EmbeddingModel, FlagEmbedding, SparseEmbeddingModel, SparseTextEmbedding } from './fastembed.js';

/** Threads in this process, as the operating system counts them. */
function processThreads(): number {
  if (process.platform === 'linux') {
    return Number(/^Threads:\s+(\d+)/m.exec(fs.readFileSync('/proc/self/status', 'utf8'))![1]);
  }
  return (
    execFileSync('ps', ['-M', '-p', String(process.pid)], { encoding: 'utf8' })
      .trim()
      .split('\n').length - 1
  );
}

const loaders = [
  {
    name: 'dense',
    load: () => FlagEmbedding.init({ model: EmbeddingModel.BGESmallENV15, showDownloadProgress: false }),
  },
  {
    name: 'sparse',
    load: () => SparseTextEmbedding.init({ model: SparseEmbeddingModel.SpladePPEnV1, showDownloadProgress: false }),
  },
];

// A process limited to one CPU. ONNX Runtime runs a one-thread pool on the calling thread, so loading a model
// must start no thread at all. Without the limit applied, it starts one thread per physical core but one.
const unsupported = process.platform === 'win32' || os.cpus().length <= 2;
// Held so their threads do not exit while a later load is counted.
const warmedUp: unknown[] = [];

beforeAll(async () => {
  if (unsupported) return;
  // Start the threads a process starts once, whatever the limit: Node's I/O pool, ONNX Runtime's environment
  // and the tokenizer's pool. Only threads started by loading one more model are counted below.
  await fs.promises.stat('.');
  for (const { load } of loaders) {
    const embedder = await load();
    await embedder.embed(['warm up']).next();
    warmedUp.push(embedder);
  }
}, 180_000);

afterEach(() => {
  vi.restoreAllMocks();
});

// Technical: ONNX Runtime sizes its thread pool from the machine's cores, not from the cores the process may use.
// In a container limited to 2 CPUs on an 18-core host, the extra threads exhaust the CPU quota and the kernel
// pauses the whole process: one embedding took 1.0 s instead of 0.14 s, and the host server stalled with it.
test.skipIf(unsupported).each(loaders)(
  'a $name embedder in a process limited to 1 CPU starts no thread',
  async ({ load }) => {
    // The CPU limit is the kernel's; this is how Node reports a 1-CPU container quota.
    vi.spyOn(os, 'availableParallelism').mockReturnValue(1);

    const before = processThreads();
    const embedder = await load();
    expect(processThreads() - before).toBe(0);

    const [vector] = (await embedder.embed(['This is a test']).next()).value!;
    expect(vector).toBeDefined();
  },
  180_000,
);
