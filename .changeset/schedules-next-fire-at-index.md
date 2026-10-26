---
'@mastra/pg': patch
'@mastra/libsql': patch
---

The scheduler finds the next due schedule quickly in PostgreSQL and libSQL, even when there are many schedules.
