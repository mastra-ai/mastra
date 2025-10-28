import { generateTypes } from '@internal/types-builder';
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    'scorers/llm/index': 'src/scorers/llm/index.ts',
    'scorers/code/index': 'src/scorers/code/index.ts',
    'scorers/utils': 'src/scorers/utils.ts',
  },
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
