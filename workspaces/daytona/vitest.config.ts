import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.integration.test.ts'],
    setupFiles: ['dotenv/config'],
    testTimeout: 60000,
    coverage: {
      reporter: ['text', 'json', 'html'],
    },
  },
});
