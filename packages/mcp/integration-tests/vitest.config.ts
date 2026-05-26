import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';
import { withSourceModeConfig } from '../../../scripts/vitest-source-mode-config';

export default defineConfig(
  withSourceModeConfig({
    root: dirname(fileURLToPath(import.meta.url)),
    test: {
      globals: true,
      environment: 'node',
      testTimeout: 60000,
      hookTimeout: 30000,
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html'],
      },
    },
  }),
);
