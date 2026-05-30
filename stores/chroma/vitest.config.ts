import { defineConfig } from 'vitest/config';
import { withSourceModeConfig } from '../../scripts/vitest-source-mode-config';

export default defineConfig(
  withSourceModeConfig({
    test: {
      name: 'e2e:stores/chroma',
      environment: 'node',
      include: ['src/**/*.test.ts'],
    },
  }),
);
