import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['workspace-compat.test.ts'],
    globalSetup: ['./setup.ts'],
    testTimeout: 120_000,
  },
});
