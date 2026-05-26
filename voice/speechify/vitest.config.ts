import { defineConfig } from 'vitest/config';
import { withSourceModeConfig } from '../../scripts/vitest-source-mode-config';

export default defineConfig(
  withSourceModeConfig({
    test: {
      name: 'e2e:voice/speechify',
      globals: true,
      include: ['src/**/*.test.ts'],
    },
  }),
);
