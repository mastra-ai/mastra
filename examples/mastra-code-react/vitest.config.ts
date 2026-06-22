import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Scenarios drive a real in-process harness server + AIMock; they need
    // network + node builtins, so run in the node environment.
    environment: 'node',
    include: ['scenarios/**/*.scenario.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // Run test files sequentially — each scenario starts its own AIMock +
    // Harness + Hono server, and concurrent runs can cause port/state
    // collisions in the shared process.
    fileParallelism: false,
  },
});
