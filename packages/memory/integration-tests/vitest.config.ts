import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Cast to any to avoid vite version mismatch type errors between workspace packages
  test: {
    execArgv: ['--no-enable-source-maps'],
    // 2 workers (#13937) kept peak memory under the 16 GB runner with the performance benchmarks;
    // PRs skip those, so 4 fit (peak 7.6 GB measured). Runs that include them pass --maxWorkers=2.
    maxWorkers: 4,
    globals: true,
    environment: 'node',
    testTimeout: 60000,
    hookTimeout: 30000,
    globalSetup: './setup.ts',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
});
