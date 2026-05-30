import { defineConfig } from 'vitest/config';
import { withSourceModeConfig } from '../../scripts/vitest-source-mode-config';

export default defineConfig(
  withSourceModeConfig({
    test: {
      name: 'unit:auth/workos',
      isolate: false,
      globals: true,
      include: ['src/**/*.test.ts'],
    },
  }),
);
