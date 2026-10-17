import { generateTypes } from '@internal/types-builder';
import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts', 'src/hooks.ts', 'src/processors/index.ts'],
  format: ['esm', 'cjs'],
  fixedExtension: false,
  nodeProtocol: 'strip',
  clean: true,
  dts: false,
  treeshake: true,
  sourcemap: true,
  deps: {
    alwaysBundle: ['tokenx'],
  },
  onSuccess: async () => {
    await generateTypes(process.cwd(), new Set(['tokenx']));
  },
});
