import { defineConfig } from '@internal/lint/vitest';

export default defineConfig({
  test: {
    name: 'unit:packages/mcp-registry-registry',
    isolate: false,
    environment: 'node',
  },
});
