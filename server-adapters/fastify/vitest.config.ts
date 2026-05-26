import { defineConfig } from 'vitest/config';
import { withSourceModeConfig } from '../../scripts/vitest-source-mode-config';

export default defineConfig(
  withSourceModeConfig({
    test: {
      name: 'unit:server-adapters/fastify',
      isolate: false,
      environment: 'node',
      include: ['src/**/*.test.ts'],
      coverage: {
        reporter: ['text', 'json', 'html'],
      },
    },
  }),
);
