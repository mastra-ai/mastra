import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'unit:packages/server',
    environment: 'node',
    include: ['src/**/*.test.ts'],
    setupFiles: ['@internal/test-utils/setup'],
    // Tests that set MASTRA_DEV must not start core's live registry refresh, which rewrites packages/core/dist.
    env: { MASTRA_AUTO_REFRESH_PROVIDERS: 'false' },
  },
});
