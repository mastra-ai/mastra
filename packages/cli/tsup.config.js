import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/analytics/index.ts', 'src/commands/create/create.ts'],
  treeshake: true,
  format: 'esm',
  dts: true,
  clean: true,
});
