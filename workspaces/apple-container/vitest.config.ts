import { fileURLToPath } from 'node:url';
import { defineConfig } from '@internal/lint/vitest';

export default defineConfig({
  resolve: {
    alias: {
      '@mastra/core/di': fileURLToPath(new URL('../../packages/core/src/di/index.ts', import.meta.url)),
      '@mastra/core/editor': fileURLToPath(new URL('../../packages/core/src/editor/index.ts', import.meta.url)),
      '@mastra/core/workspace': fileURLToPath(new URL('./test/core-workspace.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.integration.test.ts'],
    setupFiles: ['dotenv/config'],
    testTimeout: 60000,
    coverage: {
      reporter: ['text', 'json', 'html'],
    },
  },
});
