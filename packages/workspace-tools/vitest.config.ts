import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit:packages/workspace-tools',
          environment: 'node',
          include: ['src/**/*.test.ts'],
          testTimeout: 30000,
        },
      },
    ],
  },
});
