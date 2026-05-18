import { cp, mkdir } from 'node:fs/promises';
import { generateTypes } from '@internal/types-builder';
import { defineConfig } from 'tsup';

const runtimeAssetPath = 'src/transforms/temporal-workflow-runtime.mjs';
const runtimeDistPath = 'dist/temporal-workflow-runtime.mjs';

export default defineConfig([
  {
    entry: ['src/index.ts', 'src/worker.ts'],
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
      await mkdir('dist', { recursive: true });
      await cp(runtimeAssetPath, runtimeDistPath);
    },
  },
]);
