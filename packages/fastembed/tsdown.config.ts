import { defineConfig } from 'tsdown';
import { generateTypes } from '@internal/types-builder';

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
    alwaysBundle: ['@internal/ai-sdk-v4', '@internal/ai-sdk-v5', '@internal/ai-v6'],
  },
  onSuccess: async () => {
    await generateTypes(process.cwd(), new Set(['@internal/ai-sdk-v4', '@internal/ai-sdk-v5', '@internal/ai-v6']));
  },
});
