import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'unit:signals/slack',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
