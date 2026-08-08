import { defineConfig } from '@internal/lint/vitest';

export default defineConfig({
  test: {
    globals: true,
    include: ['src/**/*.test.ts'],
    passWithNoTests: true,
  },
});
