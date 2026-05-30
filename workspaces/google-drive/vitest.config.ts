import { defineConfig } from 'vitest/config';
import { withSourceModeConfig } from '../../scripts/vitest-source-mode-config';

export default defineConfig(
  withSourceModeConfig({
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts'],
      setupFiles: ['dotenv/config'],
      testTimeout: 30000,
      coverage: {
        reporter: ['text', 'json', 'html'],
      },
    },
  }),
);
