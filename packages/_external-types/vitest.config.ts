import { defineConfig } from 'vitest/config';
import { withSourceModeConfig } from '../../scripts/vitest-source-mode-config';

export default defineConfig(
  withSourceModeConfig({
    test: {
      name: 'unit:packages/_external-types',
      isolate: false,
      environment: 'node',
      include: ['src/**/*.test.ts'],
    },
  }),
);
