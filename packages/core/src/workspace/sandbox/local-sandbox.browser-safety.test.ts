/**
 * Regression test for https://github.com/mastra-ai/mastra/issues/18519
 *
 * The Studio client bundle transitively imports the Agent runtime, which pulls
 * in `local-sandbox.ts`. In the browser, `node:os` is shimmed to an (almost)
 * empty object, so `os.tmpdir` is `undefined`. If `local-sandbox.ts` evaluates
 * `os.tmpdir()` at module-load time, importing it throws
 * `TypeError: os.tmpdir is not a function`, which crashes Studio boot before
 * React can render.
 *
 * `os.tmpdir()` must only be invoked lazily (via `getMarkerDir()`), never at
 * module load — so importing the module under a browser-like `os` shim must
 * not throw.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';

describe('local-sandbox browser safety (issue #18519)', () => {
  afterEach(() => {
    vi.doUnmock('node:os');
    vi.resetModules();
  });

  it('does not call os.tmpdir() at module load (browser os shim has no tmpdir)', async () => {
    // Simulate the browser `os` shim: an object without `tmpdir`.
    vi.resetModules();
    vi.doMock('node:os', () => ({ default: {} }));

    await expect(import('./local-sandbox')).resolves.toHaveProperty('getMarkerDir');
  });
});
