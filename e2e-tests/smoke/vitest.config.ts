import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    root: '.',
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/.git/**', '.mastra/**'],
    globalSetup: ['./tests/setup.ts'],
    testTimeout: 30_000,
    hookTimeout: 120_000,
    sequence: {
      concurrent: false,
    },
    reporters: ['verbose', 'json'],
    outputFile: {
      json: 'test-results/api-results.json',
    },
  },
});
