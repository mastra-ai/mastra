---
'@mastra/libsql': patch
'@mastra/pg': patch
---

Fixed `prune()` to use one cutoff instant across all retained tables so rows near the retention boundary are handled consistently. Requires `@mastra/core` 1.68 or newer.
