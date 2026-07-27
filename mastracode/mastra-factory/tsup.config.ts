import { defineConfig } from 'tsup';

/**
 * Single-bundle build for the `create-factory` bin. Dependencies stay
 * external (regular npm deps); only src/ is bundled so `bin/cli.mjs` can
 * import one file.
 */
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  bundle: true,
  clean: true,
  dts: false,
  splitting: false,
  sourcemap: false,
});
