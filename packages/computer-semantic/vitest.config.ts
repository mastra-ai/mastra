import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@mastra/platform-workspace': fileURLToPath(
        new URL('../../workspaces/platform-workspace/src/index.ts', import.meta.url),
      ),
    },
  },
  test: {
    name: 'unit:packages/computer-semantic',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
