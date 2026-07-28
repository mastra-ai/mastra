import { defineConfig } from 'tsdown';

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
  fixedExtension: false,
  nodeProtocol: 'strip',
  clean: true,
  dts: true,
  treeshake: true,
  sourcemap: true,
});
