---
'@mastra/core': patch
---

Fixed trace, span and thread query validation errors for oversized membership sets. An `in`/`notIn` predicate with more than 100 values points at the set again (for example `where.set` or `where.spans.some.set`). Since the zod 4.6.7 upgrade, the error pointed only at `where`.
