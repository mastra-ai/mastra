import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    // Integration tests need the Workflow SDK compiler and live in their own config
    // (`vitest.integration.config.ts`), which is run separately.
    include: ['src/**/*.test.ts'],
    testTimeout: 30_000,
  },
});
