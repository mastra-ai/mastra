import { defineConfig } from 'vitest/config';
import { withSourceModeConfig } from '../../scripts/vitest-source-mode-config';

export default defineConfig(
  withSourceModeConfig({
    test: {
      name: 'unit:observability/otel-exporter',
      isolate: false,
      globals: true,
      environment: 'node',
    },
  }),
);
