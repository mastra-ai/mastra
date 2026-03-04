import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { $ } from 'execa';

export default async function setup() {
  await $(
    {},
  )`pnpm tsc ./src/worker/generic-memory-worker.ts ./src/worker/mock-embedder.ts --esModuleInterop --resolveJsonModule --module commonjs --target es2020 --outDir ./ --rootDir ./ --skipLibCheck`;

  // Clean up any leftover/corrupted tar.gz files from interrupted fastembed
  // model downloads — partial tar.gz files cause Z_BUF_ERROR on next run.
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
}
