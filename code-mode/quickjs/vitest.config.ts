import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'unit:code-mode/quickjs',
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Deliberately no `execArgv`: this transport must work under a plain Node
    // process. The isolated-vm suite needs `--no-node-snapshot`; this one does
    // not, and the tests would stop proving that if the flag were added here.
    testTimeout: 60000,
    coverage: {
      reporter: ['text', 'json', 'html'],
    },
  },
});
