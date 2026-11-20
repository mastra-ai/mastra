import { defineConfig } from '@internal/lint/vitest';

export default defineConfig({
  test: {
    name: 'unit:packages/connect',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
