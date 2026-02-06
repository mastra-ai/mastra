import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'unit',
    globals: true,
    include: ['src/**/*.test.ts'],
  },
});
