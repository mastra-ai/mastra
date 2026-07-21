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
  esbuildOptions(options) {
    // Disable auto tsconfig detection so we can use tsconfigRaw
    options.tsconfig = undefined;
    options.tsconfigRaw = JSON.stringify({
      compilerOptions: {
        experimentalDecorators: true,
        emitDecoratorMetadata: true,
      },
    });
  },
  onSuccess: async () => {
    await generateTypes(process.cwd(), new Set(['rxjs']));
  },
});
