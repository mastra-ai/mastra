import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'unit:packages/_internals/factory-contract',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
