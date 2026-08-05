import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globalSetup: ['./setup.ts'],
    reporters: ['default', './reporters/scenario-reporter.ts'],
    testTimeout: 90_000,
    hookTimeout: 15 * 60_000,
  },
});
