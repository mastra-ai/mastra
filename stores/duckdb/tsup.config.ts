import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  outDir: 'dist',
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  minify: false,
  treeshake: true,
  external: ['@mastra/core', 'duckdb'],
  esbuildOptions(options) {
    options.platform = 'node';
    options.target = 'node18';
  },
  onSuccess: async () => {
    console.log('✅ Build completed for @mastra/duckdb');
  },
});
