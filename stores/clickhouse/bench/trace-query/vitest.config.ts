import { defineConfig } from 'vitest/config';

// Offline unit tests for the benchmark harness only. Never touches a database.
export default defineConfig({
  test: {
    name: 'bench:trace-query',
    environment: 'node',
    root: import.meta.dirname,
    include: ['*.test.ts'],
  },
});
