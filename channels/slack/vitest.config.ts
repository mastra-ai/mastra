import { defineConfig } from '@internal/lint/vitest';

export default defineConfig({
  test: {
    name: 'unit:channels/slack',
    include: ['src/**/*.test.ts'],
  },
});
