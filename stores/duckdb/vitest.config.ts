import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'e2e:stores/duckdb',
    environment: 'node',
    // The first DuckDBVector operation runs `INSTALL vss;`, which downloads the
    // extension over the network (once per worker process) and can exceed the
    // default 10s/5s vitest timeouts in CI.
    testTimeout: 60_000,
    hookTimeout: 60_000,
    include: ['src/**/*.test.ts'],
    coverage: {
      reporter: ['text', 'json', 'html'],
    },
  },
});
