import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { $ } from 'execa';

export default async function setup() {
  await $(
    {},
  )`pnpm tsc ./src/worker/generic-memory-worker.ts ./src/worker/mock-embedder.ts --esModuleInterop --resolveJsonModule --module commonjs --target es2020 --outDir ./ --rootDir ./ --skipLibCheck`;

  // Pre-download fastembed model to avoid race conditions when multiple
  // test files call FlagEmbedding.init() concurrently.
  // Clean up any leftover/corrupted tar.gz files first — if a previous run
  // was interrupted during download, a partial tar.gz causes Z_BUF_ERROR.
  const cachePath = path.join(os.homedir(), '.cache', 'mastra', 'fastembed-models');
  await fsp.mkdir(cachePath, { recursive: true });

  try {
    const files = await fsp.readdir(cachePath);
    for (const file of files) {
      if (file.endsWith('.tar.gz')) {
        await fsp.unlink(path.join(cachePath, file));
      }
    }
  } catch {
    // Ignore errors during cleanup
  }

  // Run the warmup in a subprocess so the ONNX runtime handle
  // dies with the subprocess and doesn't keep vitest alive.
  await $`node -e ${`
    async function warmup() {
      const { fastembed } = await import('@mastra/fastembed');
      await fastembed.small.doEmbed({ values: ['warmup'] });
    }
    warmup().catch(() => process.exit(1));
  `}`;
}
