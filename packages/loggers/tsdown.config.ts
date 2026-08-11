import { generateTypes } from '@internal/types-builder';
import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts', 'src/file/index.ts', 'src/upstash/index.ts', 'src/http/index.ts'],
  format: ['esm', 'cjs'],
  fixedExtension: false,
  nodeProtocol: 'strip',
  clean: true,
  dts: false,
  treeshake: true,
  sourcemap: true,
  onSuccess: async () => {
    await generateTypes(process.cwd());
  },
});
