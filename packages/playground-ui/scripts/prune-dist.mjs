import { readdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// The dev watch layers over the last full build without emptying `dist`, so it keeps that build's declarations.
// Drop everything else first: a turbo cache restore leaves orphaned content-hashed chunks and deleted components behind.
const distDir = fileURLToPath(new URL('../dist', import.meta.url));

const prune = directory => {
  for (const dirent of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, dirent.name);
    if (dirent.isDirectory()) {
      prune(path);
      if (readdirSync(path).length === 0) rmSync(path, { recursive: true });
    } else if (!dirent.name.endsWith('.d.ts')) {
      rmSync(path);
    }
  }
};

try {
  prune(distDir);
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
