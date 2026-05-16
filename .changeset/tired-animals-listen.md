---
'@mastra/core': patch
---

Fixed RequestContext serialization so cycles between contexts are skipped instead of recursing indefinitely. Fixes #16685.
