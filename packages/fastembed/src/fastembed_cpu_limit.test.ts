import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import { afterEach, expect, test, vi } from 'vitest';
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

const CPU_LIMIT = 2;

afterEach(() => {
  vi.restoreAllMocks();
});

// Technical: ONNX Runtime sizes its thread pool from the machine's cores, not from the cores the process may use.
// In a container limited to 2 CPUs on an 18-core host, the extra threads exhaust the CPU quota and the kernel
// pauses the whole process: one embedding took 1.0 s instead of 0.14 s, and the host server stalled with it.
test.skipIf(process.platform === 'win32' || os.cpus().length <= CPU_LIMIT).each([
  {
    name: 'dense',
    load: () => FlagEmbedding.init({ model: EmbeddingModel.BGESmallENV15, showDownloadProgress: false }),
  },
  {
    name: 'sparse',
    load: () => SparseTextEmbedding.init({ model: SparseEmbeddingModel.SpladePPEnV1, showDownloadProgress: false }),
  },
])(
  'a $name embedder in a process limited to 2 CPUs starts no more threads than the limit',
  async ({ load }) => {
    // Node's own I/O threads start on first use; start them now so they are not counted below.
    await fs.promises.stat('.');
    // The CPU limit is the kernel's; this is how Node reports a 2-CPU container quota.
    vi.spyOn(os, 'availableParallelism').mockReturnValue(CPU_LIMIT);

    const before = processThreads();
    const embedder = await load();
    const started = processThreads() - before;

    expect(started).toBeLessThanOrEqual(CPU_LIMIT);
    const [vector] = (await embedder.embed(['This is a test']).next()).value!;
    expect(vector).toBeDefined();
  },
  180_000,
);
