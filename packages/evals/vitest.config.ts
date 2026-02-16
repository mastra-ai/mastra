import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit:packages/evals',
          environment: 'node',
          include: ['src/**/*.test.ts'],
          exclude: ['**/node_modules/**', '**/dist/**', 'src/scorers/llm/**/*.test.ts'],
          maxConcurrency: 1,
          fileParallelism: false,
          isolate: false,
          sequence: { groupOrder: 100 },
        },
      },
      {
        test: {
          name: 'e2e:packages/evals',
          environment: 'node',
          include: ['src/scorers/llm/**/*.test.ts'],
          exclude: ['**/node_modules/**', '**/dist/**'],
          maxConcurrency: 1,
          fileParallelism: false,
          setupFiles: ['dotenv/config'],
          sequence: { groupOrder: 101 },
        },
      },
    ],
  },
});
