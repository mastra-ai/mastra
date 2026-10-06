---
'@mastra/pg': patch
---

Knowledge schema resets in PostgreSQL no longer use `CASCADE`. If another table, view, or constraint depends on a Knowledge table, the reset now fails and leaves everything in place instead of silently dropping the dependent object.
