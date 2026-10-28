/**
 * Runtime guard for the ESM/CJS build split.
 *
 * The config-shape assertions in `packaging.test.ts` cannot catch a broken
 * emitted bundle: they only inspect `tsdown.config`, and the behavioural tests
 * import `./transport` (source), never the packaged output. This test loads the
 * artifacts `package.json` actually ships — `dist/index.cjs` via `require()` and
 * `dist/index.js` via `import` — and runs a TypeScript-annotated program through
 * each, so a packaging regression (e.g. the `(0, ts_blank_space.default) is not
 * a function` failure from issue #24357) fails the suite. Requires a prior
 * build; the `test` script runs `pnpm build` first.
 */
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const cjsEntry = resolve(here, '../dist/index.cjs');
const esmEntry = resolve(here, '../dist/index.js');

const program = `
  const double = (n: number): number => n * 2;
  return double(3);
`;

describe('emitted package runtime (issue #24357)', () => {
  it('loads dist/index.cjs via require() and runs a TypeScript program', async () => {
    const require = createRequire(import.meta.url);
    const { QuickJsCodeModeTransport } = require(cjsEntry);
    const result = await new QuickJsCodeModeTransport().run({
      program,
      toolIds: [],
      dispatch: async () => undefined,
      timeout: 5_000,
    });
    expect(result).toMatchObject({ success: true, result: 6 });
  });

  it('loads dist/index.js via import and runs a TypeScript program', async () => {
    const { QuickJsCodeModeTransport } = await import(esmEntry);
    const result = await new QuickJsCodeModeTransport().run({
      program,
      toolIds: [],
      dispatch: async () => undefined,
      timeout: 5_000,
    });
    expect(result).toMatchObject({ success: true, result: 6 });
  });
});
