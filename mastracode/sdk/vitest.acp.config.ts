import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// The ACP unit tests need the signal factory, not the core package's full build.
// Use its source implementation so this suite also runs in a fresh checkout.
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
