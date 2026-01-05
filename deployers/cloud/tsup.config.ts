import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateTypes } from '@internal/types-builder';
import { copy } from 'fs-extra';
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  clean: true,
  dts: false,
  splitting: true,
  treeshake: {
    preset: 'smallest',
  },
  sourcemap: true,
  onSuccess: async () => {
    const playgroundPath = dirname(fileURLToPath(import.meta.resolve('@internal/playground/package.json')));

    await copy(join(playgroundPath, 'dist'), 'dist/playground');
    await generateTypes(process.cwd());
  },
});
