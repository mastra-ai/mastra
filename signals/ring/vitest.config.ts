import { defineConfig } from '@internal/lint/vitest';

export default defineConfig({
  test: {
    name: 'unit:signals/ring',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
