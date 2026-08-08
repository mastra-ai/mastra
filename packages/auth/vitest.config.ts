import { defineConfig } from '@internal/lint/vitest';

export default defineConfig({
  test: {
    name: 'unit:packages/auth',
    isolate: false,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
