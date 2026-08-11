import { generateTypes } from '@internal/types-builder';
import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts', 'src/blob/index.ts'],
  format: ['esm', 'cjs'],
  fixedExtension: false,
  nodeProtocol: 'strip',
  clean: true,
  dts: false,
  treeshake: true,
  sourcemap: true,
  deps: {
    neverBundle: ['@mastra/core', '@azure/storage-blob', '@azure/identity'],
  },
  onSuccess: async () => {
    await generateTypes(process.cwd());
  },
});
