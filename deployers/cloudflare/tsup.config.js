import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/secrets-manager/index.ts'],
  treeshake: true,
  format: 'esm',
  dts: true,
  clean: true,
});
