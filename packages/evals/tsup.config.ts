import { generateTypes } from '@internal/types-builder';
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/scorers/llm/index.ts', 'src/scorers/code/index.ts', 'src/scorers/utils.ts'],
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
