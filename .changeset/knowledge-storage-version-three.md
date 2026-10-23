---
'@mastra/core': patch
'@mastra/libsql': patch
'@mastra/pg': patch
---

Knowledge storage now reports contract and schema version 3, so the version keeps increasing past the version 2 that `@mastra/core` 1.79.0 shipped. LibSQL and PostgreSQL databases created by pre-release snapshots with the same layout keep their rows and have their schema marker updated to 3.
