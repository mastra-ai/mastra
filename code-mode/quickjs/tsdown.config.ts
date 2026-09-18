import { generateTypes } from '@internal/types-builder';
import { defineConfig } from 'tsdown';

const shared = {
  entry: ['src/index.ts'],
  fixedExtension: false,
  nodeProtocol: 'strip' as const,
  clean: true,
  dts: false,
  treeshake: true,
  sourcemap: true,
  onSuccess: async () => {
    await generateTypes(process.cwd());
  },
};

export default defineConfig([
  {
    ...shared,
    format: ['esm'],
    deps: {
      neverBundle: ['@mastra/core', 'quickjs-emscripten', 'ts-blank-space', 'typescript'],
    },
  },
  {
    ...shared,
    // ts-blank-space (and the `typescript` API it runs on) are ESM-only:
    // externalising them breaks the CJS build because require() interop
    // leaves .default unusable (#24357), so the CJS output bundles them.
    format: ['cjs'],
    deps: {
      neverBundle: ['@mastra/core', 'quickjs-emscripten'],
      alwaysBundle: ['ts-blank-space', 'typescript'],
    },
  },
]);
