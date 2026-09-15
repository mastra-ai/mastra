import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateTypes } from '@internal/types-builder';
import { copy } from 'fs-extra';
import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts', 'src/client/index.ts'],
  format: ['esm', 'cjs'],
  fixedExtension: false,
  nodeProtocol: 'strip',
  clean: true,
  dts: false,
  treeshake: true,
  sourcemap: true,
  onSuccess: async () => {
    const studioPath = dirname(fileURLToPath(import.meta.resolve('@internal/playground/package.json')));

    await copy(join(studioPath, 'dist'), join('dist', 'studio'));
    await generateTypes(process.cwd());
  },
});
