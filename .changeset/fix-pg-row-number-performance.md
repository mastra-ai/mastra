---
"@mastra/pg": patch
---

Fix severe performance issue with semantic recall on large message tables

The `_getIncludedMessages` method was using `ROW_NUMBER() OVER (ORDER BY createdAt)` which scanned all messages in a thread to assign row numbers. On tables with 1M+ rows, this caused 5-10 minute query times.

Replaced with cursor-based pagination using the existing `(thread_id, createdAt)` index:

```sql
-- Before: scans entire thread
ROW_NUMBER() OVER (ORDER BY "createdAt" ASC)

-- After: uses index, fetches only needed rows  
WHERE createdAt <= (target) ORDER BY createdAt DESC LIMIT N
```

Performance improvement: ~49x faster (832ms → 17ms) for typical semantic recall queries.
