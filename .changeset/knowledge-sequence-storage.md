---
'@mastra/core': patch
'@mastra/libsql': patch
---

Knowledge stores can now hold sequences: a page whose dated items, such as chat messages, are stored as rows keyed by the source's own ID instead of one page per item. `store.sequences` marks a leaf page as a sequence and upserts items by `(sequenceId, externalId)`. Replaying an identical item changes nothing, and an older edit can't overwrite a newer one. Deletes are tombstones that a replay can't bring back. Items are read newest or oldest first with a cursor, filtered by time range or thread. An item is visible only when its sequence page is live and readable. Items of a deleted sequence are purged in bounded batches. This covers the in-memory and LibSQL stores. Nothing writes sequences yet.
