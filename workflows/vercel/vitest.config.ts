import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['src/**/*.test.ts'],
    pool: 'threads',
    maxWorkers: 1,
    isolate: false,
  },
});
