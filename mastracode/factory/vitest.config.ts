import { defineConfig } from '@internal/lint/vitest';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit:mastra-factory',
          environment: 'node',
          include: ['src/**/*.test.ts'],
          exclude: ['**/node_modules/**', '**/dist/**'],
        },
      },
    ],
  },
});
