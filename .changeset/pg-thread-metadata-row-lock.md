---
'@mastra/pg': patch
---

Fixed thread metadata updates being lost when several processes share one Postgres database. Concurrent `updateThread` and `updateThreadMetadata` calls on the same thread now keep every metadata key.
