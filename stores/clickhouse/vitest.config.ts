import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['src/**/*.performance.test.ts'],
    // Run test files sequentially to avoid conflicts on shared database tables
    // (migration tests modify/drop spans table which affects other tests)
    fileParallelism: false,
    coverage: {
      reporter: ['text', 'json', 'html'],
    },
  },
});
