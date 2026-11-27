import { defineConfig } from '@internal/lint/vitest';

export default defineConfig({
  test: {
    name: 'unit:packages/_internals/workspace',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
