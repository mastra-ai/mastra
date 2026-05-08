---
'@mastra/core': patch
'mastracode': patch
---

Stop logging "Detected invalid provider-types in global cache" / "Detected corrupted global cache" warnings when `~/.cache/mastra/` contains stale content from another Mastra version. The corrupted file is still deleted on read so it can't propagate into a project's `dist/`, and the next gateway sync rewrites a valid file — the warning was just noise that surfaced repeatedly when running mastracode and `mastra dev` side-by-side.

`mastracode`'s gateway sync helper now delegates to `@mastra/core`'s `GatewayRegistry.syncGateways`, removing a duplicate copy of the provider-fetch / type-generation / atomic-write logic so both code paths stay in lockstep.
