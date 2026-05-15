import { defineConfig } from 'vitest/config';
import { withSourceModeConfig } from '../../scripts/vitest-source-mode-config';

export default defineConfig(
  withSourceModeConfig({
    test: {
      name: 'unit:packages/editor',
      isolate: false,
      environment: 'node',
      include: ['src/**/*.test.ts', 'src/**/*.integration.test.ts'],
    },
  }),
);
