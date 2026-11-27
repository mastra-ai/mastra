/**
 * Runtime guard for the ESM/CJS build split, plus a workerd import smoke.
 *
 * The config-shape assertions in `packaging.test.ts` cannot catch a broken
 * emitted bundle: they only inspect `tsdown.config`, and the behavioural tests
 * import `./transport` (source), never the packaged output. The first suite loads
 * the artifacts `package.json` actually ships — `dist/index.cjs` via `require()`
 * and `dist/index.js` via `import` — and runs a TypeScript-annotated program
 * through each, so a packaging regression (e.g. the `(0, ts_blank_space.default)
 * is not a function` failure from issue #24357) fails the suite. Requires a prior
 * build; the `test` script runs `pnpm build` first.
 *
 * The second suite is a hosted-runtime regression: workerd does not provide the
 * CommonJS globals (`__filename`, …) that `typescript` — reached through
 * `ts-blank-space` — reads at module initialisation. A static import of the
 * stripper therefore crashed Workers at startup. This smoke runs the *built* ESM
 * inside real workerd via `wrangler`'s `unstable_dev`, constructs the transport,
 * and asserts a successful response. It is deliberately an import/startup smoke,
 * not a claim that the test compiles WASM in workerd — execution still uses the
 * caller-supplied `module` option.
 */
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { unstable_dev } from 'wrangler';

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

describe('workerd import smoke (hosted-safe startup)', () => {
  let projectDir: string;

  beforeAll(async () => {
    projectDir = await mkdtemp(join(here, '..', '.workerd-smoke-'));
  });

  afterAll(async () => {
    await rm(projectDir, { recursive: true, force: true });
  });

  it('starts in workerd and constructs the transport from the built ESM', { timeout: 120_000 }, async () => {
    // Import only — never run a program. The regression is at module
    // initialisation: evaluating `ts-blank-space` (and its `typescript`
    // dependency) at startup throws `ReferenceError: __filename is not defined`.
    const worker = `
        import { QuickJsCodeModeTransport } from ${JSON.stringify(esmEntry)};

        export default {
          fetch() {
            const transport = new QuickJsCodeModeTransport();
            return Response.json({ requiresSandbox: transport.requiresSandbox });
          },
        };
      `;
    await writeFile(join(projectDir, 'index.mjs'), worker);
    await writeFile(
      join(projectDir, 'wrangler.jsonc'),
      `{
          "name": "quickjs-workerd-import-smoke",
          "main": "index.mjs",
          "compatibility_date": "2026-10-07",
          "compatibility_flags": ["nodejs_compat"]
        }\n`,
    );

    const cwd = process.cwd();
    process.chdir(projectDir);
    let dev: Awaited<ReturnType<typeof unstable_dev>> | undefined;
    try {
      dev = await unstable_dev(join(projectDir, 'index.mjs'), {
        config: join(projectDir, 'wrangler.jsonc'),
        ip: '127.0.0.1',
        port: 0,
        logLevel: 'error',
        experimental: { disableExperimentalWarning: true, testMode: true },
      });

      // When the Worker throws during module evaluation, workerd reports the
      // error on its own stderr and never answers a request, so `dev.fetch`
      // would hang. Race it against a bound so a startup regression fails with
      // a readable message instead of a bare test timeout.
      let readinessTimer: NodeJS.Timeout | undefined;
      const response = await Promise.race([
        dev.fetch('/'),
        new Promise<never>((_, reject) => {
          readinessTimer = setTimeout(
            () =>
              reject(
                new Error(
                  'workerd did not answer within 20s — the Worker probably failed to initialise (check for a ReferenceError from ts-blank-space/typescript)',
                ),
              ),
            20_000,
          );
        }),
      ]).finally(() => clearTimeout(readinessTimer));

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ requiresSandbox: false });
    } finally {
      await dev?.stop();
      process.chdir(cwd);
    }
  });
});
