import { defineConfig } from 'tsdown';

/**
 * Single-bundle build for the `create-factory` bin. Dependencies stay
 * external (regular npm deps); only src/ is bundled so `bin/cli.mjs` can
 * import one file.
 */
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  clean: true,
  dts: false,
  sourcemap: false,
  fixedExtension: false,
});
