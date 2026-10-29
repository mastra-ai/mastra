---
'@mastra/libsql': patch
---

Added `batchUpdateUnendedSpans()`, so `MastraStorageExporter` can end spans that a different process started, such as the spans a durable agent ends after recovering a run. Spans that already ended aren't overwritten. Part of the fix for [#27479](https://github.com/mastra-ai/mastra/issues/27479).
