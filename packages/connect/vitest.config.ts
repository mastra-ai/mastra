import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit:packages/connect',
          environment: 'node',
          include: ['src/**/*.test.ts'],
        },
      },
      {
        test: {
          name: 'typecheck:packages/connect',
          environment: 'node',
          include: [],
          typecheck: {
            enabled: true,
            include: ['type-tests/**/*.test-d.ts'],
          },
        },
      },
    ],
  },
});
