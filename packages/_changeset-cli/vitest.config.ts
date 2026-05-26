import { defineConfig } from 'vitest/config';
import { withSourceModeConfig } from '../../scripts/vitest-source-mode-config';

export default defineConfig(
  withSourceModeConfig({
    test: {
      name: 'unit:packages/_changeset-cli',
      isolate: false,
      environment: 'node',
      include: ['src/**/*.test.ts'],
    },
  }),
);
