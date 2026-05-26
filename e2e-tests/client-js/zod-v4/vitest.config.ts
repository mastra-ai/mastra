import { defineConfig } from 'vitest/config';
import { withSourceModeConfig } from '../../../scripts/vitest-source-mode-config';

export default defineConfig(
  withSourceModeConfig({
    test: {
      environment: 'node',
      include: ['**/*.test.ts'],
      testTimeout: 60000,
      hookTimeout: 60000,
      globalSetup: './setup.ts',
    },
  }),
);
