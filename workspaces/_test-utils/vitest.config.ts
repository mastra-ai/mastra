import { defineConfig } from 'vitest/config';
import { withSourceModeConfig } from '../../scripts/vitest-source-mode-config';

export default defineConfig(
  withSourceModeConfig({
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts'],
      coverage: {
        reporter: ['text', 'json', 'html'],
      },
    },
  }),
);
