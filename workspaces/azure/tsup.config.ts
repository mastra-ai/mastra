import { generateTypes } from '@internal/types-builder';
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/blob/index.ts'],
  format: ['esm', 'cjs'],
  clean: true,
  dts: false,
  splitting: true,
  treeshake: {
    preset: 'smallest',
  },
  sourcemap: true,
  external: ['@mastra/core', '@azure/storage-blob', '@azure/identity'],
  onSuccess: async () => {
    await generateTypes(process.cwd());
  },
});
