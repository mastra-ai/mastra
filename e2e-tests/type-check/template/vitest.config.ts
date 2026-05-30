import { defineConfig } from 'vitest/config';
import { withSourceModeConfig } from '../../../scripts/vitest-source-mode-config';

export default defineConfig(
  withSourceModeConfig({
    test: {
      environment: 'node',
      typecheck: {
        enabled: true,
        include: ['./**/*.test-d.ts'],
        exclude: ['**/node_modules/**'],
      },
    },
  }),
);
