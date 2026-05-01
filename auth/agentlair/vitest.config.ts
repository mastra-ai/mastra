import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@mastra/core/server': path.resolve(
        __dirname,
        'node_modules/@mastra/core/src/server/index.ts',
      ),
      '@mastra/core': path.resolve(
        __dirname,
        'node_modules/@mastra/core/src/index.ts',
      ),
    },
  },
  test: {
    name: 'unit:auth/agentlair',
    isolate: false,
    globals: true,
    include: ['src/**/*.test.ts'],
  },
});
