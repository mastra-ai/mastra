---
'@mastra/core': patch
---

fix(core): Restore AI SDK v6 provider option typings for vector embeddings

The vendored AI SDK v6 declaration build now re-exports `ProviderOptions` after type bundling renames it to `ProviderOptions_2`. This fixes `TS2724` errors in `@mastra/core` when vector embeddings import AI SDK v6 provider option types.
