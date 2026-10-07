---
'@mastra/libsql': patch
'@mastra/pg': patch
---

Knowledge now initializes on databases where an earlier release created its tables. Knowledge v1 was experimental and its data is not migrated: on first use, unmodified v1 Knowledge tables are dropped, deleting any rows they hold, and the current schema is created. Other storage is untouched. Back up the v1 Knowledge tables first if you need their contents. If the Knowledge tables are missing pieces, carry extra indexes, or have views or triggers depending on them, initialization stops without changing anything, and the error names `dangerouslyReset()` as the way to replace Knowledge storage.

On PostgreSQL, first-time Knowledge initialization runs as one locked transaction: replacing the v1 tables, creating the new ones, and recording completion either all happen or none do, and several processes starting at once no longer fail while one of them initializes.
