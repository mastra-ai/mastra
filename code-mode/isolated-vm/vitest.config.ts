import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'unit:code-mode/isolated-vm',
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // isolated-vm requires --no-node-snapshot on Node 20+ to create isolates.
    pool: 'forks',
    execArgv: ['--no-node-snapshot'],
    testTimeout: 60000,
    coverage: {
      reporter: ['text', 'json', 'html'],
    },
  },
});
