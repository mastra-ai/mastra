import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'unit:packages/mcp',
    globals: true,
    include: ['src/**/*.test.ts'],
  },
});
