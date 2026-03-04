import { execSync } from 'node:child_process';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import https from 'node:https';
import os from 'node:os';
import path from 'node:path';
import { $ } from 'execa';

const MODEL_NAME = 'fast-bge-small-en-v1.5';

export default async function setup() {
  await $(
    {},
  )`pnpm tsc ./src/worker/generic-memory-worker.ts ./src/worker/mock-embedder.ts --esModuleInterop --resolveJsonModule --module commonjs --target es2020 --outDir ./ --rootDir ./ --skipLibCheck`;

  // Pre-download fastembed model to prevent concurrent download race conditions.
  // Multiple test files use fastembed — without pre-download, concurrent FlagEmbedding.init()
  // calls race on the .tar.gz download causing Z_BUF_ERROR corruption.
  // We replicate the download logic directly (https + tar CLI) to avoid importing
  // fastembed/ONNX which leaves native handles open and prevents vitest from exiting.
  const cachePath = path.join(os.homedir(), '.cache', 'mastra', 'fastembed-models');
  await fsp.mkdir(cachePath, { recursive: true });

  // Clean up any corrupted .tar.gz files from interrupted downloads
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

  const modelDir = path.join(cachePath, MODEL_NAME);
  if (fs.existsSync(modelDir)) {
    return; // Already downloaded
  }

  const tarGzPath = path.join(cachePath, `${MODEL_NAME}.tar.gz`);
  const url = `https://storage.googleapis.com/qdrant-fastembed/${MODEL_NAME}.tar.gz`;

  // Download model archive
  await new Promise<void>((resolve, reject) => {
    https
      .get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, response => {
        const fileStream = fs.createWriteStream(tarGzPath);
        response.pipe(fileStream);
        fileStream.on('finish', () => {
          fileStream.close();
          resolve();
        });
        fileStream.on('error', reject);
        response.on('error', reject);
      })
      .on('error', err => {
        fs.unlink(tarGzPath, () => reject(err));
      });
  });

  // Extract and clean up
  execSync(`tar xzf ${tarGzPath}`, { cwd: cachePath });
  await fsp.unlink(tarGzPath);
}
