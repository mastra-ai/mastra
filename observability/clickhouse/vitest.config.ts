import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    passWithNoTests: true,
    coverage: {
      reporter: ['text', 'json', 'html'],
    },
    testTimeout: 30000, // ClickHouse operations may take longer
  },
});
