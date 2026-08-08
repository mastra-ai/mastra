import { defineConfig } from '@internal/lint/vitest';

export default defineConfig({
  test: {
    name: 'unit:packages/_external-types',
    isolate: false,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
