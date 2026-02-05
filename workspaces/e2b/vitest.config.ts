import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    setupFiles: ['dotenv/config'],
    coverage: {
      reporter: ['text', 'json', 'html'],
    },
  },
});
