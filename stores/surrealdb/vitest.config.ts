import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'e2e:stores/surrealdb',
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Every test file shares one dockerized SurrealDB instance.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
    coverage: {
      reporter: ['text', 'json', 'html'],
    },
  },
});
