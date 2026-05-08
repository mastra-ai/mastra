import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'unit:packages/_external-types',
    isolate: false,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
