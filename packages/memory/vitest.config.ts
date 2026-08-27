import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // smaller output to save token space when LLMs run tests
    reporters: 'dot',
    projects: [
      {
        test: {
          name: 'unit:packages/memory',
          environment: 'node',
          include: ['src/**/*.test.ts'],
          exclude: ['src/**/*.e2e.test.ts'],
          isolate: false,
          bail: 1,
          env: {
            GOOGLE_GENERATIVE_AI_API_KEY: '',
          },
        },
      },
      {
        test: {
          name: 'e2e:packages/memory',
          environment: 'node',
          include: ['src/**/*.e2e.test.ts'],
          testTimeout: 120000,
        },
      },
    ],
  },
});
