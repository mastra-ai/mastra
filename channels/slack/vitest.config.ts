import { defineConfig } from '@internal/lint/vitest';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
  },
});
