import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'e2e:stores/couchbase',
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // The unit tests assert on mock calls made by earlier tests in the same suite and reset
    // mocks themselves in hooks, so opt out of Vitest 5's per-test `clearMocks` default.
    clearMocks: false,
    coverage: {
      reporter: ['text', 'json', 'html'],
    },
  },
});
