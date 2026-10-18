import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    testTimeout: 200_000,
    // Test files share one Redis instance and clear tables between tests.
    fileParallelism: false,
  },
});
