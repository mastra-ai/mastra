import { generateTypes } from '@internal/types-builder';
import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  fixedExtension: false,
  nodeProtocol: 'strip',
  clean: true,
  dts: false,
  treeshake: true,
  sourcemap: true,
  deps: {
    alwaysBundle: ['@internal/observability', '@mastra/schema-compat'],
  },
  onSuccess: async () => {
    await generateTypes(process.cwd(), new Set(['@internal/observability', 'hono', 'hono-mcp-server-sse-transport']));
  },
});
