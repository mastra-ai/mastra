import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'unit:packages/codemod',
    isolate: false,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
