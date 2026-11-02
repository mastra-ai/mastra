import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'unit:packages/_types-builder',
    environment: 'node',
    include: ['src/**/*.test.js'],
  },
});
