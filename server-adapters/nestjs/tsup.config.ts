import { generateTypes } from '@internal/types-builder';
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  clean: true,
  dts: false,
  splitting: true,
  treeshake: {
    preset: 'smallest',
  },
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
    await generateTypes(process.cwd());
  },
});
