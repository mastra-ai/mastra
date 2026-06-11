import { defineConfig } from 'vitest/config';

const sharedTestConfig = {
  environment: 'node' as const,
  include: ['src/**/*.test.ts'],
  setupFiles: ['src/__tests__/vitest-setup.ts'],
  maxConcurrency: 1,
  fileParallelism: false,
  isolate: true,
  testTimeout: 10_000,
  env: {
    FORCE_COLOR: '1',
    TERM: 'dumb',
  },
};

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          ...sharedTestConfig,
          name: 'unit:mastracode:harness-v0',
          exclude: ['**/node_modules/**', '**/dist/**', 'src/**/*-harness-v1.test.ts'],
        },
      },
      {
        test: {
          ...sharedTestConfig,
          name: 'unit:mastracode:harness-v1-compat',
          exclude: ['**/node_modules/**', '**/dist/**', 'src/**/*-harness-v0.test.ts'],
          env: {
            ...sharedTestConfig.env,
            MASTRACODE_TEST_HARNESS_BACKEND: 'v1-compat',
          },
        },
        resolve: {
          alias: {
            '@mastra/core/harness/v1': new URL('../packages/core/src/harness/v1/index.ts', import.meta.url).pathname,
            '@mastra/core/harness': new URL('./src/test-utils/harness-v1-compat-alias.ts', import.meta.url).pathname,
          },
        },
      },
    ],
  },
});
