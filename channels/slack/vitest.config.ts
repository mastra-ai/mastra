import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'unit:channels/slack',
    include: ['src/**/*.test.ts'],
  },
});
