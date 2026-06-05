import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'unit:signals/github',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
