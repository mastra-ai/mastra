import { defineConfig } from 'vitest/config';
import { withSourceModeConfig } from '../../scripts/vitest-source-mode-config';

export default defineConfig(
  withSourceModeConfig({
    test: {
      name: 'unit:observability/_test-utils',
      isolate: false,
      environment: 'node',
      include: ['*.test.ts'],
    },
  }),
);
