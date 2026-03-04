import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'unit:packages/mcp-registry-registry',
    isolate: false,
    environment: 'node',
  },
});
