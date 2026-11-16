import { spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// The dev watch layers over the last full build without emptying `dist`, so it keeps that build's declarations.
// Drop everything else first: a turbo cache restore leaves orphaned content-hashed chunks and deleted components behind.
const distDir = fileURLToPath(new URL('../dist', import.meta.url));
let declarations = 0;

// `dist` has no JS until the first watch build. The playground dev server waits while this file exists, because
// Vite caches imports it fails to resolve. The watch build deletes it.
const watchPendingFile = fileURLToPath(new URL('../node_modules/.cache/dev-watch-pending', import.meta.url));
mkdirSync(dirname(watchPendingFile), { recursive: true });
writeFileSync(watchPendingFile, '');

const prune = directory => {
  for (const dirent of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, dirent.name);
    if (dirent.isDirectory()) {
      prune(path);
      if (readdirSync(path).length === 0) rmSync(path, { recursive: true });
    } else if (dirent.name.endsWith('.d.ts')) {
      declarations += 1;
    } else {
      rmSync(path);
    }
  }
};

try {
  prune(distDir);
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

// Without turbo's `build` first (e.g. `pnpm dev` on a fresh clone) there is nothing to layer over, so build it fully.
if (declarations === 0) {
  const { status } = spawnSync('vite', ['build'], { stdio: 'inherit', shell: process.platform === 'win32' });
  process.exit(status ?? 1);
}
