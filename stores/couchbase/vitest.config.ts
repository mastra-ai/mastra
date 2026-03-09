import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'e2e:stores/couchbase',
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      reporter: ['text', 'json', 'html'],
    },
  },
});
