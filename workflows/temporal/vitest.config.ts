import { defineConfig } from 'vitest/config';
import { withSourceModeConfig } from '../../scripts/vitest-source-mode-config';

export default defineConfig(
  withSourceModeConfig({
    test: {
      globals: true,
      testTimeout: 60000,
      retry: 2,
    },
  }),
);
