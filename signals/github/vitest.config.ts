import { defineConfig } from '@internal/lint/vitest';

export default defineConfig({
  test: {
    name: 'unit:signals/github',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
