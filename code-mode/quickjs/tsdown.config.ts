import { generateTypes } from '@internal/types-builder';
import { defineConfig } from 'tsdown';

const shared = {
  entry: ['src/index.ts'],
  fixedExtension: false,
  nodeProtocol: 'strip' as const,
  dts: false,
  treeshake: true,
  sourcemap: true,
};

// The ESM and CJS builds must bundle dependencies differently.
//
// `ts-blank-space` (and its `typescript` dependency) are ESM-only from CJS's
// point of view: `ts-blank-space` is `"type": "module"` with no `require`
// export, and importing it from the CJS bundle emits
// `__toESM(require("ts-blank-space"), 1)`, which on Node >=22.12 leaves
// `.default` pointing at the namespace object rather than the function — so
// every program fails with `(0, ts_blank_space.default) is not a function`.
//
// The fix is per-format: the ESM build keeps them external (lean, and they
// load natively), while the CJS build bundles them in so no `require()` of an
// ESM-only package survives at runtime.
export default defineConfig([
  {
    ...shared,
    format: ['esm'],
    clean: true,
    deps: {
      neverBundle: ['@mastra/core', 'quickjs-emscripten', 'ts-blank-space', 'typescript'],
    },
    onSuccess: async () => {
      await generateTypes(process.cwd());
    },
  },
  {
    ...shared,
    format: ['cjs'],
    clean: false,
    deps: {
      neverBundle: ['@mastra/core', 'quickjs-emscripten'],
      alwaysBundle: ['ts-blank-space', 'typescript'],
    },
  },
]);
