import { defineConfig } from '@internal/lint/vitest';

export default defineConfig({
  test: {
    name: 'unit:packages/mcp-docs-server',
    isolate: false,
    globals: true,
    include: ['src/**/*.test.ts'],
  },
});
