---
'@mastra/core': patch
---

Replace `js-tiktoken` with `tokenx` in `@mastra/core` to reduce bundle size by removing the bundled BPE rank tables. Token limiting and truncation now use heuristic token estimates, which is appropriate for output limiting and truncation.
