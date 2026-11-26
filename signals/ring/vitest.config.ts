import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'unit:signals/ring',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
