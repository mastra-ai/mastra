---
'@mastra/libsql': patch
'@mastra/pg': patch
---

Knowledge now initializes on databases where an earlier release created its tables but never stored anything in them. Those empty tables are replaced automatically. If they hold rows, carry extra indexes, or have views or triggers depending on them, initialization stops without changing anything, and the error names `dangerouslyReset()` as the way to replace Knowledge storage.

On PostgreSQL, first-time Knowledge initialization runs as one locked transaction: replacing the empty tables, creating the new ones, and recording completion either all happen or none do, and several processes starting at once no longer fail while one of them initializes.
