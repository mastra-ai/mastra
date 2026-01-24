import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    pool: 'forks', // Process isolation for test safety
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/*.unit.test.ts'],
    testTimeout: 120000, // 2 minutes for slow operations
    hookTimeout: 60000, // 1 minute for setup/teardown
    reporters: ['default'],
    bail: 1, // Stop on first failure for CI
    setupFiles: ['./src/setup/global-setup.ts'],
    globalSetup: './src/setup/docker-setup.ts',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['**/fixtures/**', '**/setup/**'],
    },
  },
});
