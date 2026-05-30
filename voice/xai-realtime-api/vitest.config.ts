import { defineConfig } from 'vitest/config';
import { withSourceModeConfig } from '../../scripts/vitest-source-mode-config';

export default defineConfig(
  withSourceModeConfig({
    test: {
      name: 'voice/xai-realtime-api',
      globals: true,
      include: ['src/**/*.test.ts'],
    },
  }),
);
