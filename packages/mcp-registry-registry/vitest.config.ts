import { defineConfig } from 'vitest/config';
import { withSourceModeConfig } from '../../scripts/vitest-source-mode-config';

export default defineConfig(
  withSourceModeConfig({
    test: {
      name: 'unit:packages/mcp-registry-registry',
      isolate: false,
      environment: 'node',
    },
  }),
);
