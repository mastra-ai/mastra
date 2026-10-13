import { defineConfig } from 'tsdown';

// @chat-adapter/discord (Vercel Chat SDK) is ESM-only — its package `exports`
// declares only an `import` condition (no `require`/`default`), so a CJS
// `require()` of it throws ERR_PACKAGE_PATH_NOT_EXPORTED.
//
// ESM: adapter stays external (lean; deduped by the consumer's resolver).
// CJS: adapter is bundled via `alwaysBundle`, so `require('@mastra/discord')`
//      never touches the adapter's ESM-only entry.
// Only @mastra/core stays external in both.
//
// Declarations: ESM emits `dist/index.d.ts`; a post-step (see `package.json`'s
// `build` script) copies its contents verbatim to `dist/index.d.cts` so
// TypeScript resolves the same declarations under CJS module semantics
// (avoiding TS7062 / TS1479 when the `require` types condition points at an
// ESM-authored `.d.ts` under `"type": "module"`). Running a second dts pass
// through the CJS build itself pulls `discord.js` / `@discordjs/formatters`
// type graphs in for re-emission and their dts entries mis-report exports
// today.
const ADAPTER = ['@chat-adapter/discord', '@chat-adapter/shared', 'chat'];

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['esm'],
    fixedExtension: false,
    nodeProtocol: 'strip',
    dts: true,
    clean: true,
    sourcemap: true,
    deps: {
      neverBundle: ['@mastra/core'],
    },
  },
  {
    entry: ['src/index.ts'],
    format: ['cjs'],
    fixedExtension: false,
    nodeProtocol: 'strip',
    dts: false,
    clean: false,
    sourcemap: true,
    deps: {
      alwaysBundle: ADAPTER,
      onlyBundle: false,
      neverBundle: ['@mastra/core'],
    },
  },
]);
