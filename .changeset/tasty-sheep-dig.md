---
'@mastra/pg': patch
---

Fixed a Top-Level Await deadlock in `MemoryPG.init()` that occurred when `@mastra/pg` was inlined by a custom `bundler.externals` config. The dynamic `await import('@mastra/core/storage')` call in `init()` is replaced with the synchronous `createRequire` path already established at module scope, so the module can never produce a TLA cycle in an ESM bundle.
