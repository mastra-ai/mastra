import { defineConfig } from 'vitest/config';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Unified Vitest configuration for all e2e tests.
 *
 * Uses test.projects instead of deprecated vitest.workspace.ts
 *
 * Usage:
 *   pnpm test                    # Run all e2e tests
 *   pnpm test:deployers          # Run only deployer tests
 *   pnpm test:create-mastra      # Run only create-mastra tests
 */
export default defineConfig({
  test: {
    // Global setup runs once for all test suites
    globalSetup: join(__dirname, 'vitest.setup.global.ts'),

    // Node environment for all e2e tests
    environment: 'node',

    // Longer timeouts for e2e tests (they spawn processes, make HTTP requests, etc.)
    testTimeout: 5 * 60 * 1000, // 5 minutes
    hookTimeout: 10 * 60 * 1000, // 10 minutes for setup/teardown

    // Run test files sequentially to avoid port conflicts
    sequence: {
      concurrent: false,
    },

    // Better error output for e2e tests
    reporters: ['verbose'],

    // Don't watch in CI
    watch: false,

    // Projects (replaces deprecated vitest.workspace.ts)
    projects: [
      {
        test: {
          name: 'monorepo',
          root: './suites/monorepo',
          include: ['**/*.test.ts'],
        },
      },
      {
        test: {
          name: 'deployers',
          root: './suites/deployers',
          include: ['**/*.test.ts'],
        },
      },
      {
        test: {
          name: 'create-mastra',
          root: './suites/create-mastra',
          include: ['**/*.test.ts'],
        },
      },
      {
        test: {
          name: 'commonjs',
          root: './suites/commonjs',
          include: ['**/*.test.ts'],
        },
      },
      {
        test: {
          name: 'pkg-outputs',
          root: './suites/pkg-outputs',
          include: ['**/*.test.ts'],
        },
      },
    ],
  },
});
