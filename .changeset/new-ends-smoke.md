---
'@mastra/pg': patch
---

Fixed semantic recall latency that scaled linearly with message count. The \_getIncludedMessages() query now batch-fetches target message metadata and uses createdAt directly (instead of COALESCE) for cursor-based pagination, enabling the existing (thread_id, createdAt) composite index to be used. Also skips the unnecessary COUNT(\*) query when only included messages are needed (perPage=0 path). This reduces semantic recall time from ~30s to <500ms for threads with 7k+ messages. (Fixes #11702)
