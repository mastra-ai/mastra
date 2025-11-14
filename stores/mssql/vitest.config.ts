import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['src/**/*.performance.test.ts'],
    coverage: {
      reporter: ['text', 'json', 'html'],
    },
  },
});
