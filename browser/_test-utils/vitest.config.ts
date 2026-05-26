import { defineConfig } from 'vitest/config';
import { withSourceModeConfig } from '../../scripts/vitest-source-mode-config';

export default defineConfig(
  withSourceModeConfig({
    test: {
      name: 'e2e:browser/integration',
      globals: true,
      environment: 'node',
      testTimeout: 120_000,
    },
  }),
);
