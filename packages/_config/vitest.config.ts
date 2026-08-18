import { defineConfig } from '@internal/lint/vitest';

export default defineConfig({
  test: {
    name: 'unit:packages/_config',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
