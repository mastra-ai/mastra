import { defineConfig } from '@internal/lint/vitest';

export default defineConfig({
  test: {
    name: 'unit:auth/workos',
    isolate: false,
    globals: true,
    include: ['src/**/*.test.ts'],
  },
});
