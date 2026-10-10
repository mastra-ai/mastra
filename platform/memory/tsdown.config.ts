import { generateTypes } from '@internal/types-builder';
import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts', 'src/ai-sdk.ts', 'src/langchain.ts'],
  format: ['esm', 'cjs'],
  fixedExtension: false,
  nodeProtocol: 'strip',
  clean: true,
  dts: false,
  treeshake: true,
  sourcemap: true,
  deps: {
    neverBundle: ['@mastra/core', '@ai-sdk/provider', /^@langchain\/core/],
  },
  onSuccess: async () => {
    await generateTypes(process.cwd());
  },
});
