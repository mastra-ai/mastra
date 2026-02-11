import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'unit:server-adapters/fastify',
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      reporter: ['text', 'json', 'html'],
    },
  },
});
