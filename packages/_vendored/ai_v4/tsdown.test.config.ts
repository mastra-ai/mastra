import { defineConfig } from 'tsdown';

// Builds `src/test.ts` (Node-only test tooling) separately from the main entries.
// See the note in tsdown.config.ts: bundling test.ts together with index.ts leaks
// eager Node-only `createRequire` interop into chunks shared with browser-consumable
// code. Keep options here in sync with tsdown.config.ts (target, treeshake, define).
//
// Must run BEFORE the main config (so it owns `clean: true`): the main config's
// onSuccess only copies test.d.ts when dist/test.js already exists.
export default defineConfig({
  entry: ['src/test.ts'],
  format: ['esm'],
  fixedExtension: false,
  nodeProtocol: 'strip',
  target: 'node22',
  clean: true,
  dts: false,
  treeshake: true,
  sourcemap: true,
  deps: {},
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
});
