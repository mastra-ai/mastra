import { defineConfig } from 'vitest/config';
import { withSourceModeConfig } from '../../scripts/vitest-source-mode-config';

export default defineConfig(
  withSourceModeConfig({
    test: {
      projects: [
        {
          test: {
            name: 'unit:packages/fastembed',
            environment: 'node',
            include: ['src/**/*.test.ts'],
            exclude: ['src/fastembed_*.test.ts'],
          },
        },
        {
          test: {
            name: 'models:packages/fastembed',
            environment: 'node',
            include: ['src/fastembed_*.test.ts'],
            testTimeout: 120_000,
          },
        },
      ],
    },
  }),
);
