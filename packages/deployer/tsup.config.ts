import { generateTypes } from '@internal/types-builder';
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/build/index.ts',
    'src/server/index.ts',
    'src/services/index.ts',
    'src/bundler/index.ts',
    'src/build/analyze.ts',
    'src/validator/loader.ts',
    'src/build/bundler.ts',
    'src/validator/custom-resolver.ts',
  ],
  format: ['esm', 'cjs'],
  clean: true,
  dts: false,
  splitting: true,
  treeshake: {
    preset: 'smallest',
  },
  sourcemap: true,
  publicDir: true,
  onSuccess: async () => {
    await generateTypes(process.cwd());
  },
});
