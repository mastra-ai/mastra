import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'unit:gh-dane-command',
    environment: 'node',
    include: ['**/*.test.ts'],
  },
});
