import { defineConfig } from 'tsup';
import { bundleTypes } from './scripts/bundle-types';

export default defineConfig({
  entry: ['src/schema.ts'],
  format: ['esm'],
  clean: true,
  dts: true,
  splitting: true,
  treeshake: {
    preset: 'smallest',
  },
  metafile: true,
  sourcemap: true,
  onSuccess: async () => {
    await new Promise(resolve => setTimeout(resolve, 2000));
    for (const input of ['schema.d.ts']) {
      await bundleTypes(input);
    }
  },
});
