import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'unit:packages/loggers',
    isolate: false,
    globals: true,
    include: ['src/**/*.test.ts'],
  },
});
