import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from '@internal/lint/vitest';

export default defineConfig({
  root: dirname(fileURLToPath(import.meta.url)),
  test: {
    // Scenarios drive a real in-process controller server + AIMock; they need
    // network + node builtins, so run in the node environment.
    environment: 'node',
    include: ['**/*.scenario.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // Run test files sequentially — each scenario starts its own AIMock +
    // AgentController + Hono server, and concurrent runs can cause port/state
    // collisions in the shared process.
    fileParallelism: false,
  },
});
