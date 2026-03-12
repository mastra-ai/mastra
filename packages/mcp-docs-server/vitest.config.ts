import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'unit:packages/mcp-docs-server',
    isolate: false,
    globals: true,
    include: ['src/**/*.test.ts'],
  },
});
