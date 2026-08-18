import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SDK_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

const createdDirs: string[] = [];

/**
 * Fixtures that import from `@mastra/core` have to live somewhere Node can
 * resolve it from, which `os.tmpdir()` is not. Installed plugins get a
 * `node_modules` link for exactly this reason (see `package-link.ts`); inside
 * the package's own `node_modules` is the cheap equivalent, and stays out of
 * both `tsc` and vitest's globs.
 *
 * Every directory created here is tracked; call {@link cleanupResolvableDirs}
 * from `afterEach` so repeated calls within one test cannot leak directories
 * into `node_modules`.
 */
export function makeResolvableDir(prefix: string): string {
  const parent = path.join(SDK_ROOT, 'node_modules', '.mc-test-plugins');
  fs.mkdirSync(parent, { recursive: true });
  const dir = fs.mkdtempSync(path.join(parent, `${prefix}-`));
  createdDirs.push(dir);
  return dir;
}

export function cleanupResolvableDirs(): void {
  while (createdDirs.length > 0) {
    const dir = createdDirs.pop()!;
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
