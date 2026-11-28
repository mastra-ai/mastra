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
 *
 * The third suite guards the frozen-clock escape: a run that can only be ended by
 * the tick budget runs in its own process, so a regression fails the test instead
 * of hanging the suite (see the comment on the test).
 */
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
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

describe('frozen-clock execution guard', () => {
  it('ends a run whose only escape is the tick budget, with the clock stopped', { timeout: 60_000 }, () => {
    // A guest that queues a job which never returns and then spins itself cannot
    // be bounded by the clock: `Date.now()` never advances under a frozen clock,
    // so the host wall deadline is unreachable and the tick budget is the only
    // way out. A regression here blocks the whole process — no test timeout can
    // interrupt a synchronous WASM call — so the run gets its own process and a
    // hard kill, which turns the regression into a red test instead of a hung
    // suite.
    const script = `
      Date.now = () => 1_700_000_000_000;
      const { QuickJsCodeModeTransport } = await import(${JSON.stringify(pathToFileURL(esmEntry).href)});
      const result = await new QuickJsCodeModeTransport({ maxInterruptTicks: 200 }).run({
        program: 'Promise.resolve().then(() => { external_late({}); while (true) {} }); while (true) {}',
        toolIds: ['late'],
        dispatch: async () => undefined,
        // Deliberately out of reach: the event loop is blocked for the whole run.
        timeout: 60_000,
      });
      console.log(JSON.stringify(result));
    `;

    const output = execFileSync(process.execPath, ['--input-type=module', '-e', script], {
      encoding: 'utf8',
      timeout: 20_000,
    });

    expect(JSON.parse(output.trim())).toMatchObject({
      success: false,
      error: { name: 'ExecutionLimitError' },
    });
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
