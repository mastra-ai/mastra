import { defineConfig } from 'vitest/config';
import { withSourceModeConfig } from '../../scripts/vitest-source-mode-config';

export default defineConfig(
  withSourceModeConfig({
    test: {
      environment: 'node',
      include: ['*.test.ts'],
      testTimeout: 5 * 60 * 1000,
      hookTimeout: 10 * 60 * 1000,
      globalSetup: './setup.ts',
    },
  }),
);
