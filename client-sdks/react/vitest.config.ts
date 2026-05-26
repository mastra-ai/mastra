import { defineConfig } from 'vitest/config';
import { withSourceModeConfig } from '../../scripts/vitest-source-mode-config';

export default defineConfig(
  withSourceModeConfig({
    test: {
      name: 'unit:client-sdks/react',
      isolate: false,
      coverage: {
        provider: 'v8', // or 'istanbul'
      },
    },
  }),
);
