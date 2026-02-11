import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit:packages/core',
          environment: 'node',
          include: ['src/**/*.test.ts'],
          exclude: ['src/**/*.e2e.test.ts'],
          testTimeout: 120000,
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
