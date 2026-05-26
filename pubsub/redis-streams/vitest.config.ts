import { defineConfig } from 'vitest/config';
import { withSourceModeConfig } from '../../scripts/vitest-source-mode-config';

export default defineConfig(
  withSourceModeConfig({
    test: {
      name: 'e2e:pubsub/redis-streams',
      globals: true,
      include: ['src/**/*.test.ts'],
      pool: 'forks',
      fileParallelism: false,
      testTimeout: 60_000,
      hookTimeout: 30_000,
    },
  }),
);
