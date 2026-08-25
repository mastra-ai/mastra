import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

const packageDirectory = fileURLToPath(new URL('../..', import.meta.url));
const esmEntry = path.join(packageDirectory, 'dist/workflows/index.js');
const cjsEntry = path.join(packageDirectory, 'dist/workflows/index.cjs');

function importWithoutFetch(args: string[]) {
  execFileSync(process.execPath, args, { cwd: packageDirectory, stdio: 'pipe' });
}

// Regression contract for https://github.com/mastra-ai/mastra/issues/22229: the
// bundled @ai-sdk/provider-utils fetch probe ran at module-eval time and threw
// when globalThis.fetch was absent (e.g. jest-environment-jsdom), so importing
// @mastra/core/workflows crashed before any test could run. The fix currently
// ships as pnpm patches to @ai-sdk/provider-utils; this test guards the
// invariant itself, so it must keep passing if those patches are retired for an
// upstream release.
describe('workflows build output', () => {
  it.skipIf(!existsSync(esmEntry))('ESM entrypoint imports when global fetch is not callable', () => {
    expect(() =>
      importWithoutFetch([
        '--input-type=module',
        '--eval',
        `globalThis.fetch = undefined; await import(${JSON.stringify(pathToFileURL(esmEntry).href)});`,
      ]),
    ).not.toThrow();
  });

  it.skipIf(!existsSync(cjsEntry))('CJS entrypoint imports when global fetch is not callable', () => {
    expect(() =>
      importWithoutFetch(['--eval', `globalThis.fetch = undefined; require(${JSON.stringify(cjsEntry)});`]),
    ).not.toThrow();
  });
});
