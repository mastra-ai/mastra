import { generateTypes } from '@internal/types-builder';
import esbuildCompileZod from '@internal/types-builder/compile-zod';
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'scorers/prebuilt/index': 'src/scorers/prebuilt/index.ts',
    'scorers/utils': 'src/scorers/utils.ts',
    checks: 'src/checks.ts',
  },
  format: ['esm', 'cjs'],
  clean: true,
  dts: false,
  splitting: true,
  treeshake: {
    preset: 'smallest',
  },
  sourcemap: true,
  esbuildPlugins: [esbuildCompileZod()],
  onSuccess: async () => {
    await generateTypes(process.cwd());
  },
});
