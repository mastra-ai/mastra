import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'unit:packages/memory',
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // e2e tests are run manually via direct vitest invocation
    exclude: ['src/**/*.e2e.test.ts', 'node_modules'],
    isolate: false,
    // smaller output to save token space when LLMs run tests
    reporters: 'dot',
    bail: 1,
  },
});
