import { defineConfig } from 'vitest/config';

import { withSourceModeConfig } from '../../scripts/vitest-source-mode-config';

export default defineConfig(
  withSourceModeConfig({
    test: {
      projects: [
        {
          test: {
            name: 'unit:packages/mcp',
            environment: 'node',
            include: ['src/**/*.test.ts'],
            exclude: ['src/**/*.e2e.test.ts'],
          },
        },
        {
          test: {
            name: 'e2e:packages/mcp',
            environment: 'node',
            include: ['src/**/*.e2e.test.ts'],
          },
        },
      ],
    },
  }),
);
