import { defineConfig } from '@internal/lint/vitest';

export default defineConfig({
  test: {
    name: 'unit:create-factory',
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
