import { defineConfig } from '@internal/lint/vitest';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['src/**/*.performance.test.ts', 'src/**/performance-indexes/*.test.ts'],
    coverage: {
      reporter: ['text', 'json', 'html'],
    },
  },
});
