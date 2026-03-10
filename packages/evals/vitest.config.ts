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
          setupFiles: ['dotenv/config', '@internal/test-utils/setup'],
          sequence: { groupOrder: 101 },
        },
      },
    ],
  },
});
