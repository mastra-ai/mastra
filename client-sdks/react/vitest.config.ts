import path from 'node:path';
import { defineConfig } from 'vitest/config';
import { withSourceModeConfig } from '../../scripts/vitest-source-mode-config';

export default defineConfig(
  withSourceModeConfig({
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    test: {
      name: 'unit:client-sdks/react',
      isolate: false,
      coverage: {
        provider: 'v8', // or 'istanbul'
      },
    },
  }),
);
