import { defineConfig } from 'vitest/config';
import { withSourceModeConfig } from '../../scripts/vitest-source-mode-config';

export default defineConfig(
  withSourceModeConfig({
    test: {
      environment: 'node',
      include: ['workspace-compat.test.ts'],
      globalSetup: ['./setup.ts'],
      testTimeout: 120_000,
    },
  }),
);
