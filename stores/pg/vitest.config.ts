import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'e2e:stores/pg',
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['src/**/*.performance.test.ts', 'src/**/performance-indexes/*.test.ts'],
    coverage: {
      reporter: ['text', 'json', 'html'],
    },
  },
});
