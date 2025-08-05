import { defineConfig } from 'tsup';
import { generateTypes } from '@internal/types-builder';

export default defineConfig({
  entry: ['src/index.ts', 'src/file/index.ts', 'src/upstash/index.ts', 'src/http/index.ts'],
  format: ['esm', 'cjs'],
  clean: true,
  dts: false,
  splitting: true,
  treeshake: {
    preset: 'smallest',
  },
  sourcemap: true,
  onSuccess: async () => {
    await generateTypes(process.cwd());
  },
});
