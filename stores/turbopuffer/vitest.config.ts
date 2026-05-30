import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';
import { withSourceModeConfig } from '../../scripts/vitest-source-mode-config';

export default defineConfig(
  withSourceModeConfig({
    test: {
      name: 'e2e:stores/turbopuffer',
      environment: 'node',
      include: ['src/**/*.test.ts'],
      coverage: {
        reporter: ['text', 'json', 'html'],
      },
    },
    resolve: {
      alias: {
        '@mastra/core': resolve(__dirname, '../../packages/core/src'),
      },
    },
  }),
);
