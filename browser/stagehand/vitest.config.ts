import { defineConfig } from 'vitest/config';
import { withSourceModeConfig } from '../../scripts/vitest-source-mode-config';

export default defineConfig(
  withSourceModeConfig({
    test: {
      name: 'e2e:browser/stagehand',
      include: ['src/**/*.test.ts'],
      testTimeout: 30000,
      hookTimeout: 30000,
    },
  }),
);
