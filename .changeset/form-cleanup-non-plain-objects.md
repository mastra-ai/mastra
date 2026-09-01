---
'@internal/playground': patch
---

Fixed Studio-generated forms silently dropping `Date`, `File`, `Blob`, `Map`, and other non-plain object values before validation and submission. The empty-value cleanup now only recurses into arrays and plain objects, so typed schema fields such as `z.date()` receive their values intact. Fixes [#22736](https://github.com/mastra-ai/mastra/issues/22736).
