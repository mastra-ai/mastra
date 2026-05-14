import { defineConfig } from 'vitest/config';
import { withSourceModeConfig } from '../../scripts/vitest-source-mode-config';

export default defineConfig(
  withSourceModeConfig({
    test: {
      name: 'unit:packages/agent-builder',
      isolate: false,
      environment: 'node',
      include: ['src/**/*.test.ts'],
      // smaller output to save token space when LLMs run tests
      reporters: 'dot',
      bail: 1,
    },
  }),
);
