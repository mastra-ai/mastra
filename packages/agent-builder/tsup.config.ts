import { generateTypes } from '@internal/types-builder';
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  treeshake: true,
  format: ['esm'],
  publicDir: './src/public',
  dts: false,
  clean: true,
  sourcemap: true,
  onSuccess: async () => {
    await generateTypes(process.cwd());
  },
});
