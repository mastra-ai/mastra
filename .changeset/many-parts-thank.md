---
'@mastra/pg': minor
---

Spans now store their time to first chunk in a new `timeToFirstChunkMs` column, ready for filtering and sorting by how fast a model started responding. Existing databases get the column automatically when the store starts. It stays empty for spans written before the upgrade or with an older `@mastra/core`.
