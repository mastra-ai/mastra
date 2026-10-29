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
  // Decorator transforms (experimentalDecorators, emitDecoratorMetadata) come from tsconfig.json.
  tsconfig: 'tsconfig.json',
  onSuccess: async () => {
    await generateTypes(process.cwd(), new Set(['rxjs']));
  },
});
