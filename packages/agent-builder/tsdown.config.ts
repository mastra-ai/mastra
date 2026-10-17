import { generateTypes } from '@internal/types-builder';
import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  treeshake: true,
  format: ['esm'],
  fixedExtension: false,
  nodeProtocol: 'strip',
  dts: false,
  clean: true,
  sourcemap: true,
  deps: {
    neverBundle: ['typescript'],
  },
  onSuccess: async () => {
    await generateTypes(process.cwd());
  },
});
