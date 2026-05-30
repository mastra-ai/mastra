import { defineConfig } from 'vitest/config';
import { withSourceModeConfig } from '../../scripts/vitest-source-mode-config';

export default defineConfig(
  withSourceModeConfig({
    test: {
      name: 'e2e:voice/deepgram',
      globals: true,
      environment: 'node',
      include: ['src/**/*.test.ts'],
    },
  }),
);
