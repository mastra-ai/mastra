import { defineConfig } from '@internal/lint/vitest';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit:packages/_internals/voice',
          environment: 'node',
          include: ['src/**/*.test.ts'],
          exclude: ['src/**/*.e2e.test.ts'],
          setupFiles: ['@internal/test-utils/setup'],
          testTimeout: 120000,
          env: {
            OPENAI_API_KEY: '',
          },
        },
      },
      {
        test: {
          name: 'e2e:packages/_internals/voice',
          environment: 'node',
          include: ['src/**/*.e2e.test.ts'],
          setupFiles: ['@internal/test-utils/setup'],
          testTimeout: 120000,
        },
      },
    ],
  },
});
