import { defineConfig } from '@internal/lint/vitest';

export default defineConfig({
  test: {
    name: 'unit:packages/codemod',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
