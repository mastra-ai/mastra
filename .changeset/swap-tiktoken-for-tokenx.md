---
'@mastra/core': patch
'mastracode': patch
---

Replace `js-tiktoken` with `tokenx` in `@mastra/core` and `mastracode` to drop the heavy BPE rank tables (`o200k_base` ~2MB) and reduce bundle size. Token counts are now estimated heuristically (~96% accuracy) which is appropriate for output limiting and truncation.

The `encoding` option on `TokenLimiterProcessor` is now deprecated and ignored — token counts are estimated by `tokenx` and no longer require a BPE encoder. Existing code that passes `encoding` will continue to work without changes.

`packages/rag` continues to use `js-tiktoken` since the `'token'` chunk strategy needs exact-token-boundary splitting to fit chunks within model context windows.
