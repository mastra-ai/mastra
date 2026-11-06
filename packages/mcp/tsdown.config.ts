import { chmod } from 'node:fs/promises';
import { generateTypes } from '@internal/types-builder';
import { defineConfig } from 'tsdown';

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    fixedExtension: false,
    nodeProtocol: 'strip',
    clean: true,
    dts: false,
    treeshake: true,
    sourcemap: true,
    deps: {
      neverBundle: ['@mastra/schema-compat/validation-runtime'],
      // Keep the private validation-runtime import replaceable by deployers while bundling every other schema-compat entry.
      alwaysBundle: [/^@mastra\/schema-compat(?:$|\/(?!validation-runtime$).+)/],
    },
    onSuccess: async () => {
      await generateTypes(process.cwd(), new Set(['hono', 'hono-mcp-server-sse-transport']));
    },
  },
  {
    entry: { index: 'src/cli/index.ts' },
    outDir: 'dist/cli',
    format: ['esm'],
    fixedExtension: false,
    clean: false,
    dts: false,
    sourcemap: true,
    deps: { neverBundle: ['@mastra/mcp', '@mastra/core/logger', 'tsx/esm/api', 'json-schema-to-typescript'] },
    onSuccess: async () => {
      await chmod('dist/cli/index.js', 0o755);
    },
  },
]);
