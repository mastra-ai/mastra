import { defineConfig } from 'tsdown';

/**
 * Single-bundle build for the `create-factory` bin. Dependencies stay
 * external (regular npm deps); only src/ is bundled so `bin/cli.mjs` can
 * import one file.
 */
export default defineConfig({
  entry: ['src/index.ts', 'src/api.ts'],
  format: ['esm'],
  clean: true,
  dts: true,
  sourcemap: false,
  fixedExtension: false,
});
