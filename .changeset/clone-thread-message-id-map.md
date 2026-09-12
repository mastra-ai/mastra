---
'@mastra/redis': patch
'@mastra/valkey': patch
'@mastra/elasticsearch': patch
---

`cloneThread()` now returns `messageIdMap` (source message id → copied message id), matching the other storage adapters. `Memory.copyThread()` uses it to embed copied messages by id instead of paging the destination thread.
