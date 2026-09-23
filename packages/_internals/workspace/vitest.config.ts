import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'unit:packages/_internals/workspace',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
