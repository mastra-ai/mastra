import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@internal/workflow-test-utils': path.resolve(__dirname, '../../workflows/_test-utils/src'),
    },
  },
  test: {
    projects: [
      {
        resolve: {
          alias: {
            '@internal/workflow-test-utils': path.resolve(__dirname, '../../workflows/_test-utils/src'),
          },
        },
        test: {
          name: 'unit:packages/core',
          environment: 'node',
          include: ['src/**/*.test.ts'],
          exclude: ['src/**/*.e2e.test.ts'],
          testTimeout: 120000,
          env: {
            OPENROUTER_API_KEY: '',
            GOOGLE_GENERATIVE_AI_API_KEY: '',
            ANTHROPIC_API_KEY: '',
            OPENAI_API_KEY: '',
          },
        },
      },
      {
        test: {
          name: 'e2e:packages/core',
          environment: 'node',
          include: ['src/**/*.e2e.test.ts'],
          testTimeout: 120000,
        },
      },
      {
        test: {
          name: 'typecheck:packages/core',
          environment: 'node',
          include: [],
          typecheck: {
            enabled: true,
            include: ['src/**/*.test-d.ts'],
          },
        },
      },
    ],
  },
});
