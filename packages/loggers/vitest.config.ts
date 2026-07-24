import { defineConfig } from '@internal/lint/vitest';

export default defineConfig({
  test: {
    name: 'unit:packages/loggers',
    isolate: false,
    globals: true,
    include: ['src/**/*.test.ts'],
  },
});
