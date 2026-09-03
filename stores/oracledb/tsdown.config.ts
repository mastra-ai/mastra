import { generateTypes } from '@internal/types-builder';
import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  fixedExtension: false,
  nodeProtocol: 'strip',
  clean: true,
  dts: false,
  treeshake: {
    moduleSideEffects: false,
    propertyReadSideEffects: false,
    unknownGlobalSideEffects: false,
  },
  sourcemap: true,
  deps: {
    alwaysBundle: ['@internal/observability'],
  },
  onSuccess: async () => {
    await generateTypes(process.cwd(), new Set(['@internal/observability']));
  },
});
