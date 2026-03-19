---
'@mastra/pg': patch
---

Fixed PostgreSQL transaction query execution in `@mastra/pg`.

Message save/delete operations now run transaction queries one at a time on the same client. This removes the pg deprecation warning in 8.19+ and prevents failures in pg 9.0.
