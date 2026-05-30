import { defineConfig } from 'vitest/config';
import { withSourceModeConfig } from '../../scripts/vitest-source-mode-config';

export default defineConfig(
  withSourceModeConfig({
    test: {
      name: 'unit:packages/server',
      environment: 'node',
      include: ['src/**/*.test.ts'],
      setupFiles: ['@internal/test-utils/setup'],
    },
  }),
);
