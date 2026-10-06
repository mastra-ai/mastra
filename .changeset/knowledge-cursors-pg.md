---
'@mastra/pg': patch
---

Deprecated the Knowledge curation cursor methods `getCurationCursor()` and `advanceCurationCursor()`. Both now throw because observation-time curate needs no cursor, and the adapter no longer creates the cursor table or collection. Existing cursor tables are left in place. Nothing in Mastra calls these methods, and no peer dependency ranges change.
