import { defineConfig } from '@internal/lint/vitest';

export default defineConfig({
  test: {
    name: 'unit:workflows/_test-utils',
    globals: true,
    include: ['src/**/*.test.ts'],
  },
});
