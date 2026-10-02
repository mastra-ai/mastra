import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'unit:channels/telegram',
    include: ['src/**/*.test.ts'],
  },
});
