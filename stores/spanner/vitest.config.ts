import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'e2e:stores/spanner',
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['src/**/*.performance.test.ts'],
    coverage: {
      reporter: ['text', 'json', 'html'],
    },
  },
});
