import { defineConfig } from '@internal/lint/vitest';

export default defineConfig({
  test: {
    name: 'unit:packages/agent-builder',
    isolate: false,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // smaller output to save token space when LLMs run tests
    reporters: 'dot',
    bail: 1,
  },
});
