---
'@mastra/pg': patch
---

`queryTraces()` now builds trace previews in PostgreSQL and reads payloads only for the rows it returns, so only short previews leave the database.

Fixed `inputPreview` being empty when a trace's input was text that starts with `[` or `{`.
