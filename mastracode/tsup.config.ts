import { readFileSync } from 'node:fs';

import { generateTypes } from '@internal/types-builder';
import { defineConfig } from 'tsup';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    cli: 'src/main.ts',
    tui: 'src/tui/index.ts',
  },
  format: ['esm', 'cjs'],
  clean: true,
  dts: false,
  splitting: true,
  treeshake: {
    preset: 'smallest',
  },
  define: {
    MASTRACODE_VERSION: JSON.stringify(pkg.version),
  },
  sourcemap: true,
  onSuccess: async () => {
    await generateTypes(process.cwd());
  },
});
