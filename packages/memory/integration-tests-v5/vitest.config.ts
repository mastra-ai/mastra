import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    pool: 'forks',
    globals: true,
    environment: 'node',
    testTimeout: 60000,
    hookTimeout: 30000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
    // smaller output to save token space when LLMs run tests
    reporters: 'dot',
    bail: 1,
  },
});
