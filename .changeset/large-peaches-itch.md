---
'@mastra/clickhouse': patch
---

Spans now store their time to first chunk in a new `timeToFirstChunkMs` column, ready for filtering and sorting by how fast a model started responding. Existing databases get the column automatically when the store starts; spans written before the upgrade leave it empty. Requires `@mastra/core` `1.78.0` or newer.
