import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'unit:packages/connect',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
