---
'@mastra/libsql': patch
---

Deprecated the Knowledge curation cursor methods `getCurationCursor()` and `advanceCurationCursor()`. Both now throw because observation-time curate needs no cursor, and the adapter no longer creates the cursor table or collection. Existing cursor tables are left in place. Current `@mastra/memory` no longer calls these methods, but `@mastra/memory` 1.27.0 through 1.28.1 call them during experimental Subconscious curate and learn passes, so those passes throw with this store version. If you use experimental Subconscious, upgrade to `@mastra/memory` 1.28.2 or later. No peer dependency ranges change.
