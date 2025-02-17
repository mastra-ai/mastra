import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    maxConcurrency: 1,
    fileParallelism: false,
    setupFiles: ['dotenv/config'],
  },
});
