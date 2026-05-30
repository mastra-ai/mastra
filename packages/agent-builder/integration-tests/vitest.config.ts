import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';
import { withSourceModeConfig } from '../../../scripts/vitest-source-mode-config';

export default defineConfig(
  withSourceModeConfig({
    root: dirname(fileURLToPath(import.meta.url)),
    test: {
      pool: 'forks',
      globals: true,
      environment: 'node',
      include: ['src/**/*.test.ts'],
      testTimeout: 120000,
      hookTimeout: 60000,
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json'],
      },
      reporters: 'dot',
      bail: 1,
    },
  }),
);
