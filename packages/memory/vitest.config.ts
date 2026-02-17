import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'unit:packages/memory',
    environment: 'node',
    include: ['src/**/*.test.ts'],
    isolate: false,
    // smaller output to save token space when LLMs run tests
    reporters: 'dot',
    bail: 1,
  },
});
