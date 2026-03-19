import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'unit:packages/codemod',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
