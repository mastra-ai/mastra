import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/schema.ts', 'src/test.ts'],
  format: ['esm'],
  clean: true,
  dts: true,
  splitting: true,
  treeshake: {
    preset: 'smallest',
  },
  metafile: true,
  sourcemap: true,
});
