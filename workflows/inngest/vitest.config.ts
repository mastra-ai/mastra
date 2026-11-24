import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vitest/config';

const coreDir = path.resolve(__dirname, '../../packages/core');
const corePkg = JSON.parse(fs.readFileSync(path.join(coreDir, 'package.json'), 'utf-8'));

// Core's aimock scenarios import core from source. Point every `@mastra/core/*` import at the same
// source so the scenario, this package, and its dependencies share one copy of core (one run
// registry, one Agent class).
function resolveCoreSource(subpath: string): string {
  // Follow core's export map (`./dist/x.js`) back to source; fall back to the subpath itself
  // for internal test helpers that are not exported.
  const entry = corePkg.exports[subpath ? `./${subpath}` : '.'];
  const distPath: string | undefined = entry?.import?.default;
  const base = distPath
    ? path.join(coreDir, distPath.replace(/^\.\/dist\//, 'src/').replace(/\.js$/, ''))
    : path.join(coreDir, 'src', subpath);
  for (const candidate of [`${base}.ts`, path.join(base, 'index.ts')]) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error(`No core source for @mastra/core/${subpath}`);
}

const scenarioGlob = process.env.AIMOCK_SCENARIOS ?? '*';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          // e2e: these tests spawn an external `inngest-cli dev` server, so they
          // must not run in the unit-test lanes.
          name: 'e2e:workflows/inngest',
          globals: true,
          include: ['src/**/*.test.ts'],
          pool: 'forks',
          testTimeout: 60000, // Some tests call execute() multiple times, each takes ~15s
          hookTimeout: 30000, // Allow more time for beforeAll to setup Inngest
          fileParallelism: false,
          retry: 2, // Retry flaky tests up to 2 times (Inngest dev server can be flaky)
          // Pre-download the inngest-cli dev-server binary before any test runs, so the
          // one-time ~100MB download isn't subject to per-test or hook timeouts.
          globalSetup: ['src/__tests__/global-setup.ts'],
          // Inngest SDK v4 defaults to "cloud" mode and requires an event key unless
          // `isDev: true`, `INNGEST_DEV` env var, or an explicit dev URL is set.
          // Tests use a local dev server; force dev mode for every Inngest client.
          env: {
            INNGEST_DEV: '1',
          },
        },
      },
      {
        define: {
          __MASTRA_VERSION__: JSON.stringify(corePkg.version),
        },
        resolve: {
          alias: [
            {
              find: /^@mastra\/core(?:\/(.*))?$/,
              replacement: '$1',
              customResolver: (subpath: string) => resolveCoreSource(subpath),
            },
          ],
        },
        test: {
          // e2e: runs core's aimock scenarios through a real Inngest dev server.
          name: 'e2e:workflows/inngest:aimock',
          root: coreDir,
          include: [`src/loop/test-utils/aimock/scenarios/${scenarioGlob}.scenario.test.ts`],
          setupFiles: [path.resolve(__dirname, 'src/__tests__/aimock/setup.ts')],
          globalSetup: [path.resolve(__dirname, 'src/__tests__/global-setup.ts')],
          pool: 'forks',
          // Each worker keeps one dev server + app server for all its files (see setup.ts), so
          // files must share the worker's module state instead of getting a fresh process each.
          isolate: false,
          maxWorkers: Number(process.env.AIMOCK_INNGEST_WORKERS ?? 4),
          // Runs take ~1-2s through Inngest; anything near these limits is stuck, not slow.
          testTimeout: 20000,
          hookTimeout: 60000,
          env: {
            INNGEST_DEV: '1',
            OPENAI_API_KEY: '',
          },
        },
      },
      {
        test: {
          name: 'typecheck:workflows/inngest',
          environment: 'node',
          include: [],
          typecheck: {
            enabled: true,
            include: ['src/**/*.test-d.ts'],
          },
        },
      },
    ],
  },
});
