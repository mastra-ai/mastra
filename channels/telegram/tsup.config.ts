import { defineConfig } from 'tsup';

// @chat-adapter/telegram (Vercel Chat SDK) is ESM-only — its package `exports`
// declares only an `import` condition (no `require`/`default`), so a CJS
// `require()` of it throws ERR_PACKAGE_PATH_NOT_EXPORTED.
//
// tsup externalises `dependencies` by default. The single-config approach used by
// channels/slack therefore leaves its (equally ESM-only) adapter external in the CJS
// output, which is why `require('@mastra/slack')` currently throws
// ERR_PACKAGE_PATH_NOT_EXPORTED. We deliberately diverge so we don't ship the same
// broken `require` entry:
//   - ESM: adapter stays external (lean; deduped by the consumer's resolver).
//   - CJS: adapter is bundled via `noExternal`, so `require('@mastra/telegram')`
//     never touches the adapter's ESM-only entry.
// Only @mastra/core stays external in both.
const ADAPTER = ['@chat-adapter/telegram', '@chat-adapter/shared', 'chat'];

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['esm'],
    dts: true,
    clean: true,
    sourcemap: true,
    external: ['@mastra/core'],
  },
  {
    entry: ['src/index.ts'],
    format: ['cjs'],
    dts: false,
    clean: false,
    sourcemap: true,
    external: ['@mastra/core'],
    noExternal: ADAPTER,
  },
]);
