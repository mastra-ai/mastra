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
    reporters: process.env.CI ? ['default', 'junit'] : ['default'],
    outputFile: process.env.CI ? './test-results/junit.xml' : undefined,
    bail: 1, // Stop on first failure for CI
    setupFiles: ['./src/setup/global-setup.ts'],
    globalSetup: './src/setup/docker-setup.ts',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      exclude: ['**/fixtures/**', '**/setup/**', '**/helpers/**', '**/*.d.ts', '**/node_modules/**'],
      thresholds: {
        // Minimum coverage thresholds aligned with plan success criteria
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 80,
      },
    },
  },
});
