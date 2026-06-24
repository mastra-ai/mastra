---
'@mastra/server': patch
---

Extend `datasetItemSourceSchema` enum with `'candidate-screener'`.

The server's Zod schema for dataset item sources mirrored the closed `DatasetItemSource['type']` union from `@mastra/core`. Now that core extends the union with `'candidate-screener'`, the server schema follows so HTTP handlers can compile against the new core types and the API can round-trip externally-materialized items.
