import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'unit:packages/memory',
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Live-model tests; run with `E2E=1 pnpm vitest run <file>`.
    exclude: process.env.E2E ? [] : ['src/**/*.e2e.test.ts'],
    typecheck: {
      enabled: true,
      include: ['type-tests/**/*.test-d.ts'],
    },
    isolate: false,
    // smaller output to save token space when LLMs run tests
    reporters: 'dot',
    bail: 1,
  },
});
