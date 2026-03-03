import { cp } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateTypes } from '@internal/types-builder';
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
    const studioPath = dirname(fileURLToPath(import.meta.resolve('@internal/playground/package.json')));

    await cp(join(studioPath, 'dist'), join('dist', 'studio'), { recursive: true });
    await generateTypes(process.cwd());
  },
});
