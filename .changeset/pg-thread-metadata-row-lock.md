---
'@mastra/pg': patch
---

Fixed lost thread metadata updates when several processes share one Postgres database. `updateThread` now merges metadata atomically in SQL, and `updateThreadMetadata` locks the thread row for the whole read-modify-write, so concurrent writers no longer drop each other's keys.
