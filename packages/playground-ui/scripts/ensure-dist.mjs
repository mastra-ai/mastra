import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// The dev watch layers over the last full build and keeps its declarations. Without turbo's `build` first
// (e.g. `pnpm dev` on a fresh clone) there is nothing to layer over, so build it fully.
const entryDeclaration = fileURLToPath(new URL('../dist/style.d.ts', import.meta.url));

if (!existsSync(entryDeclaration)) {
  const { status } = spawnSync('vite', ['build'], { stdio: 'inherit', shell: process.platform === 'win32' });
  process.exit(status ?? 1);
}
