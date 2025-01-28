import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/file/index.ts', 'src/upstash/index.ts'],
  treeshake: true,
  format: ['esm'],
  dts: true,
  clean: true,
});
