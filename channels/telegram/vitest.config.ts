import { defineConfig } from '@internal/lint/vitest';

export default defineConfig({
  test: {
    name: 'unit:channels/telegram',
    include: ['src/**/*.test.ts'],
  },
});
