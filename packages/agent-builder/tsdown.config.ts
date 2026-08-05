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
    alwaysBundle: ['@internal/ai-sdk-v5'],
    neverBundle: ['typescript'],
  },
  onSuccess: async () => {
    await generateTypes(process.cwd());
  },
});
