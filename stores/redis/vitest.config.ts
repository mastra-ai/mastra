import { defineConfig } from 'vitest/config';
import { SOURCE_MODE, withSourceModeConfig } from '../../scripts/vitest-source-mode-config';

export default defineConfig(
  withSourceModeConfig({
    test: {
      globals: true,
      environment: 'node',
      include: ['src/**/*.test.ts'],
      exclude: SOURCE_MODE ? ['src/**/*.test.ts'] : undefined,
      testTimeout: 200_000,
    },
  }),
);
