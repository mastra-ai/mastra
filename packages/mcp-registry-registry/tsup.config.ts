import { defineConfig } from 'tsup';
import { generateTypes } from '@internal/types-builder';

export default defineConfig({
  entry: ['src/index.ts', 'src/stdio.ts'],
  format: ['esm'],
  clean: true,
  dts: false,
  splitting: true,
  treeshake: {
    preset: 'smallest',
  },
  sourcemap: true,
  onSuccess: async () => {
    await generateTypes(process.cwd());
  },
});
