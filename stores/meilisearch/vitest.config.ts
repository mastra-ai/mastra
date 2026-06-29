import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'e2e:stores/meilisearch',
    environment: 'node',
    include: ['src/**/*.test.ts'],
    testTimeout: 60000,
    hookTimeout: 120000,
    coverage: {
      reporter: ['text', 'json', 'html'],
    },
  },
});
