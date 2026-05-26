import { defineConfig } from 'vitest/config';
import { withSourceModeConfig } from '../../scripts/vitest-source-mode-config';

export default defineConfig(
  withSourceModeConfig({
    test: {
      name: 'e2e:stores/mssql',
      environment: 'node',
      include: ['src/**/*.test.ts'],
      exclude: ['src/**/*.performance.test.ts'],
      coverage: {
        reporter: ['text', 'json', 'html'],
      },
    },
  }),
);
