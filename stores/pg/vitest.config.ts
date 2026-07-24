import { defineConfig } from '@internal/lint/vitest';

export default defineConfig({
  test: {
    name: 'e2e:stores/pg',
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['src/**/*.performance.test.ts', 'src/**/performance-indexes/*.test.ts', 'src/**/*.pooler.test.ts'],
    // Run files sequentially to avoid exhausting connections on the shared
    // dockerized Postgres test database during package-level runs.
    fileParallelism: false,
    coverage: {
      reporter: ['text', 'json', 'html'],
    },
  },
});
