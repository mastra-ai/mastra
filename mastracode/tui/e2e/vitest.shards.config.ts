import { defineConfig } from 'vitest/config';

const maxWorkers = Number(process.env.MC_E2E_VITEST_MAX_WORKERS ?? 4);

export default defineConfig({
  test: {
    name: 'mc-e2e-terminal-shards',
    environment: 'node',
    include: ['e2e/terminal-backend-shard-*.vitest.test.ts'],
    pool: 'forks',
    maxWorkers,
    fileParallelism: true,
    isolate: false,
    // Each scenario builds its own isolated home, app data, and temp dir in
    // `prepare`, so a retry re-runs from a clean state. Scenario screens poll
    // for UI text with tight per-wait budgets, which flakes under the four
    // parallel shard workers on CI.
    retry: 2,
    testTimeout: 90_000,
    hookTimeout: 30_000,
    env: {
      FORCE_COLOR: '1',
      TERM: 'xterm-256color',
    },
  },
});
