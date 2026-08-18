import { defineConfig } from '@internal/lint/vitest';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit:packages/fastembed',
          environment: 'node',
          include: ['src/**/*.test.ts'],
          exclude: ['src/fastembed_*.test.ts'],
        },
      },
      {
        test: {
          name: 'models:packages/fastembed',
          environment: 'node',
          include: ['src/fastembed_*.test.ts'],
          testTimeout: 120_000,
        },
      },
    ],
  },
});
