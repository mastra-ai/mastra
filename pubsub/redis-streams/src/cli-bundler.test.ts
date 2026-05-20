import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { makeStorageDir, PACKAGE_DIR } from '../test-fixtures/harness';

const FIXTURE_PROJECT = resolve(PACKAGE_DIR, 'test-fixtures/cli-project');
const FIXTURE_ENTRY = resolve(FIXTURE_PROJECT, 'src/mastra/index.ts');
const BUILD_OUTPUT_DIR = resolve(FIXTURE_PROJECT, '.mastra');

const RUN_CLI_BUNDLER_TEST = process.env.RUN_CLI_BUNDLER_TEST === '1';

/**
 * Drives the real CLI artifact path: WorkerBundler bundles the
 * fixture project's `src/mastra/index.ts` into
 * `.mastra/output/index.mjs` and asserts the produced bundle contains
 * the expected `mastra.startWorkers(...)` call from
 * `WorkerBundler.getEntry()`.
 *
 * Booting the bundle is a separate concern (it requires a real
 * deployable mastra app with PubSub etc); here we focus on the
 * artifact, not the runtime.
 *
 * Skipped by default because the bundler runs Rollup + `pnpm install`
 * inside the fixture's `.mastra/output` and is slow (~15s). Run with
 * `RUN_CLI_BUNDLER_TEST=1`.
 */
describe.skipIf(!RUN_CLI_BUNDLER_TEST)('CLI WorkerBundler artifact', () => {
  let storage: { dir: string; storageUrl: string; cleanup: () => Promise<void> };

  beforeAll(async () => {
    storage = await makeStorageDir('mastra-cli-bundler-');
  }, 10_000);

  afterAll(async () => {
    await storage?.cleanup();
  });

  it('produces a runnable .mastra/output/index.mjs for a worker', async () => {
    const cliBundlerSrc = resolve(PACKAGE_DIR, '../../packages/cli/src/commands/worker/WorkerBundler.ts');
    const mod: any = await import(cliBundlerSrc);
    const bundler: any = new mod.WorkerBundler('orchestration');
    bundler.__setLogger(console);

    await bundler.prepare(BUILD_OUTPUT_DIR);
    await bundler.bundle(FIXTURE_ENTRY, BUILD_OUTPUT_DIR, {
      toolsPaths: [],
      projectRoot: FIXTURE_PROJECT,
    });

    const outputFile = join(BUILD_OUTPUT_DIR, 'output', 'index.mjs');
    expect(existsSync(outputFile)).toBe(true);

    const bundleSrc = await readFile(outputFile, 'utf-8');
    // The entry produced by WorkerBundler.getEntry() must call
    // startWorkers with the configured worker name.
    expect(bundleSrc).toMatch(/startWorkers\(\s*["']orchestration["']\s*\)/);
    expect(bundleSrc).toMatch(/\[mastra\] Worker "orchestration" started/);
    expect(bundleSrc).toMatch(/stopWorkers\(\)/);
  }, 180_000);
});
