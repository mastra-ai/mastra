import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'unit',
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // smaller output to save token space when LLMs run tests
    reporters: 'dot',
    bail: 1,
  },
});
