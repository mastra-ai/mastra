---
'@mastra/libsql': patch
---

Fixed `prune()` to use one cutoff instant across all retained tables so rows near the retention boundary are handled consistently.
