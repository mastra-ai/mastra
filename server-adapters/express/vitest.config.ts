import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'unit:server-adapters/express',
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      reporter: ['text', 'json', 'html'],
    },
  },
});
