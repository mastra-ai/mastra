import { defineConfig } from 'vitest/config';

// Offline unit tests for the benchmark harness only. Never touches a database.
export default defineConfig({
  test: {
    name: 'bench:shared',
    environment: 'node',
    root: import.meta.dirname,
    include: ['*.test.ts'],
  },
});
