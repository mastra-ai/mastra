import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'unit:create-factory',
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
