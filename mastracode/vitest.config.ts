import { defineConfig } from 'vitest/config';
import { withSourceModeConfig } from '../scripts/vitest-source-mode-config';

export default defineConfig(
  withSourceModeConfig({
    test: {
      projects: [
        {
          test: {
            name: 'unit:mastracode',
            environment: 'node',
            include: ['src/**/*.test.ts'],
            exclude: ['**/node_modules/**', '**/dist/**'],
            maxConcurrency: 1,
            fileParallelism: false,
            isolate: true,
          },
        },
      ],
    },
  }),
);
