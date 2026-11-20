import { defineConfig } from '@internal/lint/vitest';

export default defineConfig({
  test: {
    name: 'unit:channels/teams',
    include: ['src/**/*.test.ts'],
  },
});
