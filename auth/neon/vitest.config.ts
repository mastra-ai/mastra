import { defineConfig } from '@internal/lint/vitest';

export default defineConfig({
  test: {
    name: 'unit:auth/neon',
    isolate: false,
    globals: true,
    include: ['src/**/*.test.ts'],
  },
});
