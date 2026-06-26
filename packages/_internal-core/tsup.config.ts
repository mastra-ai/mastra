import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/storage/index.ts',
    'src/base/index.ts',
    'src/error/index.ts',
    'src/logger/index.ts',
    'src/types/index.ts',
    'src/request-context/index.ts',
    'src/routes/index.ts',
  ],
  format: ['esm', 'cjs'],
  clean: true,
  dts: true,
  splitting: true,
  treeshake: {
    preset: 'smallest',
  },
  sourcemap: true,
});
