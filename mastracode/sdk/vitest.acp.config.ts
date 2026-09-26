import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Keep signal fixtures aligned with core source. Other runtime imports (including
// @mastra/core/workspace) require core and its workspace dependencies to be built.
export default defineConfig({
  resolve: {
    alias: {
      '@mastra/core/signals': fileURLToPath(new URL('../../packages/core/src/agent/signals.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/acp/*.test.ts'],
    fileParallelism: false,
    maxWorkers: 1,
  },
});
