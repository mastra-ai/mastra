import { generateTypes } from '@internal/types-builder';
import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/build/index.ts',
    'src/server/index.ts',
    'src/services/index.ts',
    'src/bundler/index.ts',
    'src/build/analyze.ts',
    'src/validator/loader.ts',
    'src/build/bundler.ts',
    'src/validator/custom-resolver.ts',
  ],
  format: ['esm', 'cjs'],
  fixedExtension: false,
  nodeProtocol: 'strip',
  clean: true,
  dts: false,
  treeshake: true,
  sourcemap: true,
  deps: {
    alwaysBundle: ['@hono/node-server', '@mastra/hono'],
  },
  onSuccess: async () => {
    await generateTypes(process.cwd(), new Set(['@hono/node-server', '@mastra/hono']));
  },
});
