import { defineConfig } from 'vitest/config';
import { withSourceModeConfig } from '../../scripts/vitest-source-mode-config';

export default defineConfig(
  withSourceModeConfig({
    test: {
      name: 'unit:observability/arthur',
      isolate: false,
      globals: true,
      environment: 'node',
    },
  }),
);
