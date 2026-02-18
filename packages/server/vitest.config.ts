import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'unit:packages/server',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
