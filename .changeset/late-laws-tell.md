---
'@mastra/pg': patch
---

Fixed Postgres trace queries so equality filters (for example `spanType` or `entityName`) can use column indexes. Results are unchanged. Fixes #27335.
