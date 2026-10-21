---
'@mastra/core': patch
---

Fixed trace query validation errors for an oversized `in` / `notIn` set pointing at the whole `where` predicate instead of its `set`. Zod 4.6.7 stopped reporting which union branch failed in this case.
