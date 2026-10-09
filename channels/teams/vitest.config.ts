import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'unit:channels/teams',
    include: ['src/**/*.test.ts'],
  },
});
