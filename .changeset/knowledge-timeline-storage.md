---
'@mastra/core': patch
'@mastra/libsql': patch
---

Knowledge stores can now hold timelines: a page whose dated entries, such as chat messages, are stored as rows keyed by the source's own ID instead of one page per entry. `store.timelines` marks a leaf page as a timeline and upserts entries by `(timelineId, externalId)`. Replaying an identical entry changes nothing, and an older edit can't overwrite a newer one. Deletes are tombstones that a replay can't bring back. Entries are read newest or oldest first with a cursor, filtered by time range or thread. An entry is visible only when its timeline page is live and readable. Entries of a deleted timeline are purged in bounded batches. This covers the in-memory and LibSQL stores. Nothing writes timelines yet.
